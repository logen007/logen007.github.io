import assert from 'node:assert/strict';
import {ApiRepository} from '../src/repositories/api.js';
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
