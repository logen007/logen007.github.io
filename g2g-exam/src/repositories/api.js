import {clone,normalizeState} from '../core.js';

const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');

async function request(path,{method='GET',body,form,timeoutMs=15000}={}){
  const controller=timeoutMs>0?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  const options={method,credentials:'include',headers:{},signal:controller?.signal};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  if(form)options.body=form;
  try{
    const res=await fetch(`${API}${path}`,options);
    let data={};
    try{data=await res.json();}catch{}
    if(!res.ok)throw new Error(data?.error||`Máy chủ trả về lỗi ${res.status}.`);
    return data;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Máy chủ phản hồi quá chậm. Vui lòng tải lại trang.');
    throw error;
  }finally{
    if(timer)clearTimeout(timer);
  }
}

function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function mapById(list=[]){return new Map(list.map(x=>[x.id,x]));}
const MUTABLE_COLLECTIONS=['users','questions','exams','gradingRequests'];

export class ApiRepository{
  constructor(){this.mode='api';this.state=normalizeState({});this.user=null;this.listeners=new Set();this.poll=null;}

  async init(){
    // Resolve identity first; authenticated deep links require state before render.
    // Both requests are bounded. Failure must not fall back to local demo state.
    const me=await request('/auth/me',{timeoutMs:7000});
    this.user=me.user||null;
    if(this.user)await this.reload();
    this.startPolling();
    return this;
  }

  startPolling(){
    clearInterval(this.poll);
    this.poll=setInterval(async()=>{
      if(!this.user||document.hidden)return;
      try{
        const next=await request('/state',{timeoutMs:10000});
        if(next.revision!==this.state.revision||!same(next,this.state)){
          this.state=normalizeState(next);
          this.emit();
        }
      }catch{}
    },15000);
  }

  emit(){for(const fn of this.listeners)fn(clone(this.state));}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  async getState(){return clone(this.state);}

  async getCurrentUser(){
    if(this.user)return clone(this.user);
    const me=await request('/auth/me',{timeoutMs:7000});
    this.user=me.user||null;
    return clone(this.user);
  }

  async reload(){
    if(!this.user){this.state=normalizeState({});this.emit();return this.state;}
    this.state=normalizeState(await request('/state',{timeoutMs:10000}));
    this.emit();
    return this.state;
  }

  async signInGoogle(){
    const ret=`${location.pathname}${location.search}${location.hash}`;
    location.assign(`${API}/auth/google?return=${encodeURIComponent(ret)}`);
    return new Promise(()=>{});
  }

  async signOut(){
    await request('/auth/logout',{method:'POST',timeoutMs:7000});
    this.user=null;
    this.state=normalizeState({});
    this.emit();
  }

  async call(name,payload={}){
    return request(`/actions/${encodeURIComponent(name)}`,{method:'POST',body:payload});
  }

  async transaction(mutator){
    const before=clone(this.state),next=clone(this.state),result=await mutator(next);
    const ops=[];

    if(this.user?.role!=='student'){
      for(const collection of MUTABLE_COLLECTIONS){
        const a=mapById(before[collection]||[]),b=mapById(next[collection]||[]);
        for(const [id,item] of b){if(!a.has(id)||!same(a.get(id),item))ops.push({collection,id,kind:'upsert',item});}
        for(const id of a.keys())if(!b.has(id))ops.push({collection,id,kind:'delete'});
      }
    }
    if(ops.length)await request('/commit',{method:'POST',body:{operations:ops}});

    const secure=[];
    const beforeAttempts=mapById(before.attempts||[]);
    const localMap=new Map();
    const handled=new Set();

    for(const fresh of next.attempts||[]){
      if(beforeAttempts.has(fresh.id))continue;
      const previous=(before.attempts||[]).find(a=>a.studentId===fresh.studentId&&a.examId===fresh.examId&&a.status==='in_progress');
      const afterPrev=previous&&(next.attempts||[]).find(a=>a.id===previous.id);
      secure.push({type:'start',examId:fresh.examId,restart:Boolean(previous&&afterPrev?.status==='abandoned'),localId:fresh.id});
      if(previous)handled.add(previous.id);
    }

    for(const changed of next.attempts||[]){
      const prev=beforeAttempts.get(changed.id);
      if(!prev||handled.has(changed.id))continue;
      if(prev.status==='in_progress'&&!same(prev.answers||{},changed.answers||{}))secure.push({type:'answers',id:changed.id,answers:changed.answers||{}});
      if(prev.status==='in_progress'&&changed.status!=='in_progress'){
        secure.push(changed.status==='abandoned'?{type:'abandon',id:changed.id}:{type:'submit',id:changed.id});
        handled.add(changed.id);
        continue;
      }
      const sectionChanged=prev.currentSectionIndex!==changed.currentSectionIndex||!same(prev.sectionStates||{},changed.sectionStates||{});
      if(prev.status==='in_progress'&&sectionChanged){secure.push({type:'section',id:changed.id,index:Number(changed.currentSectionIndex||0)});handled.add(changed.id);continue;}
      const gradeChanged=!same(prev.manualScores||{},changed.manualScores||{})||prev.feedback!==changed.feedback;
      if(gradeChanged){secure.push({type:'grade',id:changed.id,scores:changed.manualScores||{},feedback:changed.feedback||''});handled.add(changed.id);continue;}
      if(prev.status==='ready'&&changed.status==='published'){secure.push({type:'publish',id:changed.id});handled.add(changed.id);}
    }

    for(const op of secure){
      if(op.type==='start'){
        const x=await this.call('startAttemptSecure',{examId:op.examId,restart:op.restart});
        if(x?.attemptId)localMap.set(op.localId,x.attemptId);
      }else if(op.type==='answers')await this.call('saveAnswers',{attemptId:op.id,answers:op.answers});
      else if(op.type==='section')await this.call('setAttemptSectionSecure',{attemptId:op.id,index:op.index});
      else if(op.type==='abandon')await this.call('abandonAttemptSecure',{attemptId:op.id});
      else if(op.type==='submit')await this.call('submitAttempt',{attemptId:op.id});
      else if(op.type==='grade')await this.call('saveManualGrade',{attemptId:op.id,scores:op.scores,feedback:op.feedback});
      else if(op.type==='publish')await this.call('publishAttemptResult',{attemptId:op.id});
    }

    await this.reload();
    if(result?.id&&localMap.has(result.id))return this.state.attempts.find(a=>a.id===localMap.get(result.id))||null;
    if(result?.id)return this.state.attempts.find(a=>a.id===result.id)||result;
    return result;
  }

  async replaceState(next){
    const before=clone(this.state),after=clone(next),ops=[];
    for(const collection of MUTABLE_COLLECTIONS){
      const a=mapById(before[collection]||[]),b=mapById(after[collection]||[]);
      for(const[id,item]of b)if(!a.has(id)||!same(a.get(id),item))ops.push({collection,id,kind:'upsert',item});
      for(const id of a.keys())if(!b.has(id))ops.push({collection,id,kind:'delete'});
    }
    if(ops.length)await request('/commit',{method:'POST',body:{operations:ops}});
    await this.reload();
    return clone(this.state);
  }

  async submitAttemptSecure(id){await this.call('submitAttempt',{attemptId:id});await this.reload();return this.state.attempts.find(a=>a.id===id);}
  async saveManualGradeSecure(id,scores,feedback){await this.call('saveManualGrade',{attemptId:id,scores,feedback});await this.reload();return this.state.attempts.find(a=>a.id===id);}
  async publishAttemptSecure(id){await this.call('publishAttemptResult',{attemptId:id});await this.reload();return this.state.attempts.find(a=>a.id===id);}
  async setUserRoleSecure(userId,role){await this.call('setUserRole',{userId,role});await this.reload();return this.state.users.find(u=>u.id===userId);}
}
