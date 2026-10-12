import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {ApiRepository} from '../src/repositories/api.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const subscription=source.slice(source.indexOf('repo.subscribe(next=>'),source.indexOf("window.addEventListener('online'"));
const begin=source.slice(source.indexOf('async function beginAttempt('),source.indexOf('let movingAttemptSection'));
const original=globalThis.fetch;
try{
  const repo=new ApiRepository();repo.user={id:'s',role:'student'};repo.state.scope='catalog';repo.pollScope='catalog';
  let started=false;
  const attempt={id:'server-a',studentId:'s',examId:'e',status:'in_progress'};
  globalThis.fetch=async url=>{
    if(url.includes('/actions/')){started=true;return {ok:true,json:async()=>({attemptId:attempt.id})};}
    if(started)await new Promise(resolve=>setTimeout(resolve,150));
    return {ok:true,json:async()=>({scope:'full',exams:[{id:'e'}],attempts:started?[attempt]:[]})};
  };
  const context={repo,ui:{view:'student-home'},user:repo.user,data:repo.state,startingAttempt:false,realtimeRenderTimer:null,
    startupGate:{isReady:()=>true},ATTEMPT_STATUS:{IN_PROGRESS:'in_progress'},byId:(items,id)=>items.find(x=>x.id===id),
    clearTimeout,setTimeout,document:{getElementById:()=>null,querySelector:()=>null},window:{scrollTo(){}},
    withExamTransition:async fn=>fn(Promise.resolve()),
    startAttempt:state=>{const local={...attempt,id:'local-a'};state.attempts.push(local);return local;},
    notify:message=>{throw Error(message);},
  };
  context.render=()=>{if(!context.startingAttempt)repo.setPollingScope(context.ui.view==='exam'?'full':'catalog');};
  context.act=async fn=>{const result=await fn();context.data=await repo.getState();return result;};
  vm.createContext(context);vm.runInContext(subscription+'\n'+begin,context);
  await context.beginAttempt('e',false,null);
  assert.equal(context.ui.view,'exam','Background catalog render must not cancel the start response');
  assert.equal(context.ui.attemptId,'server-a');
  assert.equal(context.startingAttempt,false);
  clearTimeout(context.realtimeRenderTimer);
  context.act=async()=>{throw Error('network');};
  await assert.rejects(context.beginAttempt('e',false,null),/network/);
  assert.equal(context.startingAttempt,false,'A failed start releases the transition guard');
}finally{globalThis.fetch=original;}
console.log('Start transition survives a slow state response without returning to catalog.');
