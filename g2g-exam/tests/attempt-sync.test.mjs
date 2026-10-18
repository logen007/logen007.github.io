import assert from 'node:assert/strict';
import {ApiRepository} from '../src/repositories/api.js';
import {ExamOutbox} from '../src/repositories/exam-outbox.js';
const saved={fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,document:globalThis.document};
let tick,resolve,calls=0;
globalThis.setInterval=fn=>(tick=fn,1);globalThis.clearInterval=()=>{};
globalThis.document={hidden:false};
try{
  const repo=new ApiRepository();repo.user={id:'s'};
  repo.state.attempts=[{id:'a',answers:{q:0}}];repo.state.questions=[{id:'q'}];
  repo.outboxAttempt='a';repo.setPollingScope('full',{attemptId:'a'});repo.startPolling();
  globalThis.fetch=async(url,options)=>{
    calls++;assert.equal(url,'/api/attempts/a/sync');
    if(options.headers['If-None-Match'])return {status:304};
    return {ok:true,json:async()=>({revision:'r1',attempt:{id:'a',answers:{q:1}}})};
  };
  await tick();assert.equal(repo.state.attempts[0].answers.q,1);assert.equal(repo.state.questions.length,1);
  await tick();assert.equal(calls,2);
  globalThis.document.hidden=true;await tick();assert.equal(calls,2);globalThis.document.hidden=false;
  globalThis.fetch=()=>new Promise(r=>resolve=r);
  const pending=tick();await tick();
  ++repo.generation;repo.state.attempts[0].answers.q=2;
  resolve({ok:true,json:async()=>({revision:'old',attempt:{id:'a',answers:{q:0}}})});await pending;
  assert.equal(repo.state.attempts[0].answers.q,2,'Old sync cannot overwrite an acknowledged save');
  const leaving=tick();repo.setPollingScope('catalog');
  resolve({ok:true,json:async()=>({revision:'old',attempt:{id:'a',answers:{q:0}}})});await leaving;
  assert.equal(repo.state.attempts[0].answers.q,2);
  console.log('Attempt-only polling, hidden tabs, unchanged state and stale response guards passed.');
}finally{Object.assign(globalThis,saved);}
// Leave/logout cannot close IndexedDB or hand off the editing lock while an old
// network write can still persist its acknowledgement.
const savedWindow=globalThis.window;
globalThis.window={removeEventListener(){}};
try{
 for(const rejected of [false,true]){
  const repo=new ApiRepository();let settleWrite,closed=0,released=0,stopped=0;
  const running=new Promise((resolve,reject)=>{settleWrite=()=>rejected?reject(Error('synthetic save failure')):resolve();});
  repo.outbox={persisted:Promise.resolve(),running,close(){stopped++;}};
  repo.outboxAttempt='a';repo.draftStore={close(){closed++;}};repo.releaseDraft=()=>released++;
  repo.closeExamDraft();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stopped,1);assert.equal(repo.outbox,null);
  assert.equal(closed,0,'In-flight save must settle before closing its store');
  assert.equal(released,0,'Editing lock cannot be handed off before the old write settles');
  repo.closeExamDraft();settleWrite();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,1);assert.equal(released,1);
 }
 const repo=new ApiRepository();let finishSend,closed=false,released=0,stored;
 const store={read:async()=>null,write:async(_key,value)=>{assert.equal(closed,false,'Receipt cannot write to a closed store');stored=structuredClone(value);},close(){closed=true;}};
 const box=await new ExamOutbox({store,key:'student:attempt',send:changes=>new Promise(resolve=>{finishSend=()=>resolve({versions:{q:changes.q.operation}});})}).init();
 repo.outbox=box;repo.outboxAttempt='a';repo.draftStore=store;repo.releaseDraft=()=>released++;
 box.edit('q','Grüße aus Köln');const writing=box.flush();
 while(!finishSend)await new Promise(resolve=>setImmediate(resolve));
 repo.closeExamDraft();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(closed,false);assert.equal(released,0);
 finishSend();await writing;await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(stored.pending,{});assert.equal(stored.inflight,null);
 assert.equal(closed,true);assert.equal(released,1);
}finally{if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;}
console.log('Draft handoff: stop retries, settle active writes, close store/release lock once on success or failure passed.');
