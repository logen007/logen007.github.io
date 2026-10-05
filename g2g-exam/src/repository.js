import { APP_CONFIG, isFirebaseConfigured } from './config.js';
import { clone, normalizeState, nowIso } from './core.js';
import { seedState } from './seed.js';

export class LocalRepository {
  constructor(){ this.mode='local'; this.listeners=new Set(); this.state=null; this.currentUserId=sessionStorage.getItem('g2g.demo.user')||null; }
  async init(){ const raw=localStorage.getItem(APP_CONFIG.storageKey); try{ this.state=raw?normalizeState(JSON.parse(raw)):normalizeState(seedState); }catch{ this.state=normalizeState(seedState); } if(!raw) this.persist(); window.addEventListener('storage',e=>{ if(e.key===APP_CONFIG.storageKey&&e.newValue){ try{this.state=normalizeState(JSON.parse(e.newValue)); this.emit();}catch{} } }); return this; }
  persist(){ this.state.revision=(this.state.revision||0)+1; localStorage.setItem(APP_CONFIG.storageKey,JSON.stringify(this.state)); localStorage.setItem(APP_CONFIG.storageRevisionKey,String(this.state.revision)); this.emit(); }
  emit(){ for(const fn of this.listeners) fn(clone(this.state)); }
  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  async getState(){ return clone(this.state); }
  async replaceState(next){ this.state=normalizeState(next); this.persist(); return clone(this.state); }
  async transaction(mutator){ const next=clone(this.state); const result=await mutator(next); this.state=normalizeState(next); this.persist(); return result; }
  async signInDemo(userId){ if(!this.state.users.some(u=>u.id===userId)) throw new Error('Tài khoản demo không tồn tại.'); this.currentUserId=userId; sessionStorage.setItem('g2g.demo.user',userId); return clone(this.state.users.find(u=>u.id===userId)); }
  async signOut(){ this.currentUserId=null; sessionStorage.removeItem('g2g.demo.user'); }
  async getCurrentUser(){ return this.currentUserId?clone(this.state.users.find(u=>u.id===this.currentUserId)||null):null; }
  async reset(){ this.state=normalizeState(seedState); this.persist(); }
}

export class FirebaseRepository {
  constructor(config){ this.mode='firebase'; this.config=config; this.listeners=new Set(); this.state=normalizeState({}); this.auth=null; this.db=null; this.functions=null; this.firebase=null; this.unsubscribe=[]; this.role=null; }
  async init(){
    const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged},{getFirestore,collection,getDocs,doc,getDoc,setDoc,deleteDoc,writeBatch,onSnapshot,query,where,enableIndexedDbPersistence},{getFunctions,httpsCallable}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js')
    ]);
    const app=initializeApp(this.config); this.auth=getAuth(app); this.db=getFirestore(app); this.functions=getFunctions(app,APP_CONFIG.functionsRegion); try{ await enableIndexedDbPersistence(this.db); }catch{}
    this.firebase={GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,doc,getDoc,setDoc,deleteDoc,writeBatch,onSnapshot,query,where,httpsCallable};
    await new Promise(resolve=>{ const off=onAuthStateChanged(this.auth,()=>{off();resolve();}); }); if(this.auth.currentUser){ await this.reload(); this.attachSnapshots(); } return this;
  }
  async list(path,filters=[]){ let ref=this.firebase.collection(this.db,path); if(filters.length) ref=this.firebase.query(ref,...filters.map(([f,op,v])=>this.firebase.where(f,op,v))); const snap=await this.firebase.getDocs(ref); return snap.docs.map(d=>({id:d.id,...d.data()})); }
  async reload(){
    const me=await this.getCurrentUser(); if(!me){ this.state=normalizeState({}); this.role=null; return this.state; } this.role=me.role;
    const next={schemaVersion:2,revision:Date.now(),users:[],questions:[],exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};
    if(me.role==='student'){ next.users=[me]; next.exams=await this.list('exams',[['status','==','published']]); next.questions=await this.list('questionPublic',[['status','==','active']]); next.attempts=await this.list('attempts',[['studentId','==',me.id]]); next.notifications=await this.list('notifications',[['studentId','==',me.id]]); }
    else { next.users=await this.list('users'); next.questions=await this.list('questions'); next.exams=await this.list('exams'); next.attempts=await this.list('attempts'); next.gradingRequests=await this.list('gradingRequests'); if(me.role==='master') next.auditLog=await this.list('auditLog'); }
    this.state=normalizeState(next); this.emit(); return this.state;
  }
  attachSnapshots(){
    for(const u of this.unsubscribe.splice(0)) try{u();}catch{} const uid=this.auth.currentUser?.uid; if(!uid||!this.role)return;
    const watch=(stateKey,path,filters=[])=>{ let ref=this.firebase.collection(this.db,path); if(filters.length) ref=this.firebase.query(ref,...filters.map(([f,op,v])=>this.firebase.where(f,op,v))); const off=this.firebase.onSnapshot(ref,snap=>{ this.state[stateKey]=snap.docs.map(d=>({id:d.id,...d.data()})); this.state.revision=Date.now(); this.emit(); }); this.unsubscribe.push(off); };
    if(this.role==='student'){ watch('questions','questionPublic',[['status','==','active']]); watch('exams','exams',[['status','==','published']]); watch('attempts','attempts',[['studentId','==',uid]]); watch('notifications','notifications',[['studentId','==',uid]]); }
    else { watch('users','users'); watch('questions','questions'); watch('exams','exams'); watch('attempts','attempts'); watch('gradingRequests','gradingRequests'); if(this.role==='master') watch('auditLog','auditLog'); }
  }
  emit(){ for(const fn of this.listeners) fn(clone(this.state)); }
  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  async getState(){ return clone(this.state); }
  async getCurrentUser(){ const authUser=this.auth.currentUser; if(!authUser)return null; const ref=this.firebase.doc(this.db,'users',authUser.uid), snap=await this.firebase.getDoc(ref); if(snap.exists()) return {id:authUser.uid,...snap.data()}; const created={name:authUser.displayName||authUser.email?.split('@')[0]||'Học viên',email:authUser.email||'',role:'student',active:true,createdAt:nowIso()}; await this.firebase.setDoc(ref,created,{merge:true}); return {id:authUser.uid,...created}; }
  async signInGoogle(){ const provider=new this.firebase.GoogleAuthProvider(); await this.firebase.signInWithPopup(this.auth,provider); const user=await this.getCurrentUser(); await this.reload(); this.attachSnapshots(); return user; }
  async signOut(){ await this.firebase.signOut(this.auth); for(const u of this.unsubscribe.splice(0)) try{u();}catch{} this.state=normalizeState({}); this.role=null; this.emit(); }
  async transaction(mutator){
    const before=clone(this.state), next=clone(this.state); const result=await mutator(next); const secure=[]; const persistNext=clone(next);
    const beforeMap=new Map((before.attempts||[]).map(a=>[a.id,a]));
    for(const changed of next.attempts||[]){ const prev=beforeMap.get(changed.id); if(!prev) continue;
      if(prev.status==='in_progress' && changed.status!=='in_progress'){ secure.push({type:'submit',id:changed.id}); replaceAttempt(persistNext,prev); continue; }
      const gradeChanged=JSON.stringify(prev.manualScores||{})!==JSON.stringify(changed.manualScores||{}) || prev.feedback!==changed.feedback;
      if(gradeChanged){ secure.push({type:'grade',id:changed.id,scores:clone(changed.manualScores||{}),feedback:changed.feedback||''}); replaceAttempt(persistNext,prev); continue; }
      if(prev.status==='ready' && changed.status==='published'){ secure.push({type:'publish',id:changed.id}); replaceAttempt(persistNext,prev); }
    }
    await this.persistDiff(before,persistNext);
    for(const op of secure){ if(op.type==='submit') await this.call('submitAttempt',{attemptId:op.id}); if(op.type==='grade') await this.call('saveManualGrade',{attemptId:op.id,scores:op.scores,feedback:op.feedback}); if(op.type==='publish') await this.call('publishAttemptResult',{attemptId:op.id}); }
    await this.reload(); return result;
  }
  async replaceState(next){ const before=clone(this.state); await this.persistDiff(before,next); this.state=normalizeState(next); this.emit(); return clone(this.state); }
  async persistDiff(before,after){
    // auditLog, notifications và mail là dữ liệu server quản lý; client không được ghi trực tiếp.
    const batch=this.firebase.writeBatch(this.db), collections=['users','questions','exams','attempts','gradingRequests'];
    for(const name of collections){ const a=new Map((before[name]||[]).map(x=>[x.id,x])), b=new Map((after[name]||[]).map(x=>[x.id,x])); for(const [id,item] of b){ const prev=a.get(id); if(!prev||JSON.stringify(prev)!==JSON.stringify(item)){ const payload=clone(item); delete payload.id; batch.set(this.firebase.doc(this.db,name,id),payload,{merge:false}); } } for(const id of a.keys()) if(!b.has(id)) batch.delete(this.firebase.doc(this.db,name,id)); }
    await batch.commit();
  }
  async call(name,payload){ const fn=this.firebase.httpsCallable(this.functions,name); return fn(payload); }
  async submitAttemptSecure(attemptId){ await this.call('submitAttempt',{attemptId}); await this.reload(); return this.state.attempts.find(a=>a.id===attemptId); }
  async saveManualGradeSecure(attemptId,scores,feedback){ await this.call('saveManualGrade',{attemptId,scores,feedback}); await this.reload(); return this.state.attempts.find(a=>a.id===attemptId); }
  async publishAttemptSecure(attemptId){ await this.call('publishAttemptResult',{attemptId}); await this.reload(); return this.state.attempts.find(a=>a.id===attemptId); }
  async setUserRoleSecure(userId,role){ await this.call('setUserRole',{userId,role}); await this.reload(); return this.state.users.find(u=>u.id===userId); }
}
function replaceAttempt(state,attempt){ const i=(state.attempts||[]).findIndex(a=>a.id===attempt.id); if(i>=0) state.attempts[i]=clone(attempt); }

export async function createRepository(){ if(isFirebaseConfigured()) return new FirebaseRepository(APP_CONFIG.firebaseConfig()).init(); return new LocalRepository().init(); }
