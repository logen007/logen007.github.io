import {clone,normalizeState} from '../core.js';
import {ExamOutbox,openExamStore} from './exam-outbox.js';
import {initialStateScope} from './state-scope.js';

const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');

async function request(path,{method='GET',body,form,timeoutMs=15000,headers={}}={}){
  const controller=timeoutMs>0?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  const options={method,credentials:'include',headers:{...headers},signal:controller?.signal};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  if(form)options.body=form;
  try{
    const res=await fetch(`${API}${path}`,options);
    if(res.status===304)return null;
    let data={};
    try{data=await res.json();}catch{}
    if(!res.ok)throw Object.assign(new Error(data?.error||`Máy chủ trả về lỗi ${res.status}.`),{status:res.status});
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
const MUTABLE_COLLECTIONS=['users','questions','exams'];
const statePath=scope=>scope==='catalog'?'/exam-catalog':scope==='summary'?'/state-summary':'/state';

export class ApiRepository{
  constructor(){this.mode='api';this.state=normalizeState({});this.user=null;this.listeners=new Set();this.poll=null;this.pollScope='full';this.generation=0;this.pollBusy=false;this.fullLoad=null;this.writing=false;}

  async init(){
    // Resolve identity first; authenticated deep links require state before render.
    // Both requests are bounded. Failure must not fall back to local demo state.
    const me=await request('/auth/me',{timeoutMs:7000});
    this.user=me.user||null;
    this.pollScope=initialStateScope(this.user);
    const route=new URL(globalThis.location?.href||'https://local.invalid/').searchParams;
    if(this.user?.role==='student'&&route.get('view')==='exam')this.pollingAttempt=route.get('attempt');
    if(this.user)await this.reload();
    this.startPolling();
    return this;
  }

  startPolling(){
    clearInterval(this.poll);
    this.poll=setInterval(async()=>{
      if(!this.user||document.hidden||this.pollBusy||this.writing||this.fullLoad||this.stateLoad||this.outbox?.running)return;
      const scope=this.pollScope,generation=this.generation;
      this.pollBusy=true;
      try{
        if(this.outboxAttempt&&this.pollingAttempt===this.outboxAttempt){
          const id=this.outboxAttempt;
          const next=await request(`/attempts/${encodeURIComponent(id)}/sync`,{timeoutMs:10000,headers:this.attemptRevision?{'If-None-Match':'"'+this.attemptRevision+'"'}:{}});
          if(generation!==this.generation||id!==this.outboxAttempt||id!==this.pollingAttempt||!this.user||!next)return;
          const attempt=this.state.attempts.find(a=>a.id===id);
          if(attempt){Object.assign(attempt,next.attempt);this.attemptRevision=next.revision;this.emit();}
          return;
        }
        const headers=(this.state.scope||'full')===scope?{'If-None-Match':'"'+this.state.revision+'"'}:{};
        const next=await request(statePath(scope),{timeoutMs:10000,headers});
        if(generation!==this.generation||scope!==this.pollScope||!this.user||!next)return;
        if(next.revision!==this.state.revision){
          this.state=normalizeState(next);
          this.emit();
        }
      }catch{}finally{this.pollBusy=false;}
    },15000);
  }

  snapshot(){const state=clone(this.state);this.outbox?.overlay(state.attempts.find(a=>a.id===this.outboxAttempt));return state;}
  emit(){for(const fn of this.listeners)fn(this.snapshot());}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  async getState(){return this.snapshot();}

  async prepareExamDraft(attemptId,onStatus){
    if(this.outboxAttempt===attemptId&&this.outbox)return;
    if(this.preparingDraft)return this.preparingDraft;
    this.preparingDraft=(async()=>{
      this.closeExamDraft();
      if(!navigator.locks)throw new Error('Trình duyệt chưa hỗ trợ lưu bài an toàn. Hãy cập nhật trình duyệt.');
      let release;
      const held=new Promise(resolve=>release=resolve);
      await new Promise((resolve,reject)=>{
        navigator.locks.request('g2g-exam-'+this.user.id+'-'+attemptId,{ifAvailable:true},async lock=>{
          if(!lock){reject(new Error('Bài thi đang mở ở tab khác. Hãy đóng tab đó rồi thử lại.'));return;}
          this.releaseDraft=release;resolve();await held;
        }).catch(reject);
      });
      try{
        this.draftStore=await openExamStore();
        this.outbox=await new ExamOutbox({store:this.draftStore,key:this.user.id+':'+attemptId,onStatus,
          send:async changes=>{
            ++this.generation;
            const result=await this.call('saveAnswers',{attemptId,changes});
            ++this.generation;
            const attempt=this.state.attempts.find(a=>a.id===attemptId);
            if(attempt&&result.attempt)Object.assign(attempt,result.attempt);
            return result;
          }}).init();
        this.outboxAttempt=attemptId;this.outbox.schedule();
        this.onlineDraft=()=>this.outbox?.flush().catch(()=>{});
        window.addEventListener('online',this.onlineDraft);
      }catch(error){this.closeExamDraft();throw error;}
    })();
    try{await this.preparingDraft;}finally{this.preparingDraft=null;}
  }
  closeExamDraft(){
    ++this.generation;this.attemptRevision=null;
    const outbox=this.outbox,store=this.draftStore,release=this.releaseDraft;
    outbox?.close();this.outbox=null;this.outboxAttempt=null;
    if(this.onlineDraft)window.removeEventListener('online',this.onlineDraft);
    Promise.resolve(outbox?.persisted).catch(()=>{}).finally(()=>{store?.close();release?.();});this.releaseDraft=null;this.draftStore=null;
  }
  saveDraftAnswer(attemptId,qid,value){
    if(this.outboxAttempt!==attemptId||!this.outbox)throw new Error('Bản lưu trên máy chưa sẵn sàng.');
    const attempt=this.state.attempts.find(a=>a.id===attemptId);
    const current=Object.hasOwn(this.outbox.draft.pending,qid)?this.outbox.draft.pending[qid].value:attempt?.answers?.[qid];
    if(JSON.stringify(current)===JSON.stringify(value))return;
    this.outbox.edit(qid,value,attempt?.answerVersions?.[qid]??null);
  }
  async flushDraft(){await this.outbox?.flush();}

  async getCurrentUser(){
    if(this.user)return clone(this.user);
    const me=await request('/auth/me',{timeoutMs:7000});
    this.user=me.user||null;
    return clone(this.user);
  }

  async reload(){
    if(!this.user){this.state=normalizeState({});this.emit();return this.state;}
    const scope=this.pollScope;
    const path=this.user.role==='student'&&scope==='full'&&this.pollingAttempt?`/attempts/${encodeURIComponent(this.pollingAttempt)}/session`:statePath(scope);
    if(this.stateLoad?.path===path&&this.stateLoad.generation===this.generation)return this.stateLoad.promise;
    const generation=++this.generation,load={path,generation};
    load.promise=(async()=>{
      const next=await request(path,{timeoutMs:10000});
      if(generation!==this.generation)return this.state;
      this.state=normalizeState(next);this.emit();return this.state;
    })().finally(()=>{if(this.stateLoad===load)this.stateLoad=null;});
    this.stateLoad=load;return load.promise;
  }

  setPollingScope(scope,{attemptId=null}={}){
    if(this.pollScope!==scope||this.pollingAttempt!==attemptId)++this.generation;
    this.pollingAttempt=attemptId;
    this.pollScope=scope;
  }

  async ensureFull({refresh=false}={}){
    this.setPollingScope('full');
    if(!refresh&&!['catalog','summary'].includes(this.state.scope))return;
    if(!this.fullLoad)this.fullLoad=this.reload().finally(()=>{this.fullLoad=null;});
    await this.fullLoad;
    if(['catalog','summary'].includes(this.state.scope))throw new Error('Chưa tải được nội dung. Vui lòng thử lại.');
  }

  async signInGoogle(){
    const ret=`${location.pathname}${location.search}${location.hash}`;
    location.assign(`${API}/auth/google?return=${encodeURIComponent(ret)}`);
    return new Promise(()=>{});
  }

  async signOut(){
    ++this.generation;
    await request('/auth/logout',{method:'POST',timeoutMs:7000});
    this.closeExamDraft();
    this.user=null;
    this.state=normalizeState({});
    this.emit();
  }

  async switchTestRole(role){
    const result=await request('/auth/test-role',{method:'POST',body:{role},timeoutMs:7000});
    this.user=result.user||null;
    this.setPollingScope('catalog');
    await this.reload();
    return clone(this.user);
  }

  async call(name,payload={}){
    return request(`/actions/${encodeURIComponent(name)}`,{method:'POST',body:payload});
  }

  async transaction(mutator){
    const task=(this.writeQueue||Promise.resolve()).then(()=>this.runTransaction(mutator));
    this.writeQueue=task.catch(()=>{});
    return task;
  }

  async runTransaction(mutator){
    await this.ensureFull();
    this.writing=true;
    ++this.generation;
    try{return await this.writeTransaction(mutator);}
    finally{this.writing=false;}
  }

  async writeTransaction(mutator){
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
      secure.push({type:'start',examId:fresh.examId,restart:Boolean(previous),localId:fresh.id});
      if(previous)handled.add(previous.id);
    }

    for(const previous of before.attempts||[]){
      if(previous.status==='in_progress'&&!handled.has(previous.id)&&!(next.attempts||[]).some(attempt=>attempt.id===previous.id))secure.push({type:'abandon',id:previous.id});
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

    if(!ops.length&&!secure.length)return result;
    const answerOnly=!ops.length&&secure.every(op=>op.type==='answers');
    let patchedAnswers=answerOnly;
    for(const op of secure){
      if(op.type==='start'){
        const x=await this.call('startAttemptSecure',{examId:op.examId,restart:op.restart});
        if(x?.attemptId)localMap.set(op.localId,x.attemptId);
      }else if(op.type==='answers'){
        const saved=await this.call('saveAnswers',{attemptId:op.id,answers:op.answers});
        const attempt=this.state.attempts.find(a=>a.id===op.id);
        if(answerOnly&&saved?.attempt&&attempt)Object.assign(attempt,saved.attempt);
        else patchedAnswers=false;
      }
      else if(op.type==='section')await this.call('setAttemptSectionSecure',{attemptId:op.id,index:op.index});
      else if(op.type==='abandon')await this.call('abandonAttemptSecure',{attemptId:op.id});
      else if(op.type==='submit')await this.call('submitAttempt',{attemptId:op.id});
      else if(op.type==='grade')await this.call('saveManualGrade',{attemptId:op.id,scores:op.scores,feedback:op.feedback});
      else if(op.type==='publish')await this.call('publishAttemptResult',{attemptId:op.id});
    }

    if(answerOnly&&patchedAnswers)return result?.id?this.state.attempts.find(a=>a.id===result.id)||result:result;
    this.setPollingScope('full');
    await this.reload();
    if(result?.id&&localMap.has(result.id))return this.state.attempts.find(a=>a.id===localMap.get(result.id))||null;
    if(result?.id)return this.state.attempts.find(a=>a.id===result.id)||result;
    return result;
  }

  async replaceState(next){
    await this.ensureFull();
    if(['catalog','summary'].includes(next.scope))throw new Error('Không thể lưu bản danh sách thay cho nội dung đầy đủ.');
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

  async submitAttemptSecure(id){
    ++this.generation;
    const result=await this.call('submitAttempt',{attemptId:id});
    const attempt=this.state.attempts.find(a=>a.id===id);
    if(!attempt)throw new Error('Không tìm thấy lượt thi đã nộp.');
    this.closeExamDraft();
    Object.assign(attempt,result.attempt||{status:result.status});
    this.setPollingScope('full');
    return clone(attempt);
  }
  async startAttemptSecure(examId,{restart=false,code}={}){
    const result=await this.call('startAttemptSecure',{examId,restart,code});
    this.setPollingScope('full',{attemptId:result.attemptId});
    await this.reload();
    return this.state.attempts.find(attempt=>attempt.id===result.attemptId);
  }
  async saveManualGradeSecure(id,scores,feedback){await this.call('saveManualGrade',{attemptId:id,scores,feedback});await this.reload();return this.state.attempts.find(a=>a.id===id);}
  async publishAttemptSecure(id){await this.call('publishAttemptResult',{attemptId:id});await this.reload();return this.state.attempts.find(a=>a.id===id);}
  async setUserRoleSecure(userId,role){await this.call('setUserRole',{userId,role});await this.reload();return this.state.users.find(u=>u.id===userId);}
}
