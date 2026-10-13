import assert from 'node:assert/strict';
import {createStateCache} from '../server/src/state-cache.js';
import {createJobPump} from '../server/src/job-pump.js';
import {ApiRepository} from '../src/repositories/api.js';
import {mountExamRuntime} from '../src/part-templates/runtime.js';
import {startDashboardRefresh} from '../src/ui/dashboard-refresh.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
let revision=0,loads=0;
const read=createStateCache({revision:()=>revision});
const loader=async()=>{loads++;await settle();return {exams:[{id:'e'}]};};
const burst=await Promise.all(Array.from({length:200},()=>read('master-a',loader)));
assert.equal(loads,1);assert.ok(burst.every(item=>item.revision===burst[0].revision));
await read('master-b',loader);assert.equal(loads,2,'Cache isolates identities');
revision++;await read('master-a',loader);assert.equal(loads,3,'Committed writes invalidate immediately');
await assert.rejects(read('broken',async()=>{throw Error('offline');}),/offline/);
assert.equal((await read('broken',loader)).exams[0].id,'e','Failures do not poison cache');

let processing=0,peak=0,finished=0;const jobs=Array.from({length:200},(_,id)=>({id}));
const pump=createJobPump({concurrency:3,claim:async()=>{await settle();return jobs.shift();},processJob:async()=>{
  processing++;peak=Math.max(peak,processing);await settle();processing--;finished++;
}});
await Promise.all(Array.from({length:20},()=>pump.tick()));
for(let i=0;finished<200&&i<1000;i++){await settle();await pump.tick();}
assert.equal(finished,200);assert.ok(peak>0&&peak<=3);pump.stop();

const saved={fetch:globalThis.fetch,document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
try{
  const calls=[];globalThis.fetch=async url=>{
    calls.push(url);assert.equal(url,'/api/actions/submitAttempt');
    return {ok:true,json:async()=>({status:'grading',attempt:{id:'a',status:'grading',submittedAt:'2026-10-13T12:00:00Z',durationSeconds:60,answers:{q:'answer'}}})};
  };
  const repo=new ApiRepository();repo.user={id:'s',role:'student'};repo.state.attempts=[{id:'a',status:'in_progress',answers:{q:'answer'}}];
  const receipt=await repo.submitAttemptSecure('a');
  assert.equal(receipt.status,'grading');assert.equal((await repo.getState()).attempts[0].status,'grading');assert.equal(calls.length,1);
  const root={classList:{contains:()=>false},querySelectorAll:()=>[],isConnected:true};
  for(let i=0;i<200;i++)await mountExamRuntime({state:{questions:[]},examRoot:root});
  assert.equal(calls.length,1,'Runtime DOM refreshes issue no state requests');

  let active=true,resolver,polls=0,results=0;globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const monitor=startDashboardRefresh({isActive:()=>active,refresh:()=>{polls++;return new Promise(resolve=>resolver=resolve);},onResult:()=>results++});
  const pending=monitor.tick();await monitor.tick();assert.equal(polls,1);
  active=false;resolver({});await pending;assert.equal(results,0,'Late response cannot update another view');
  active=true;document.hidden=true;await monitor.tick();assert.equal(polls,1,'Hidden tabs do not poll');monitor.stop();
  document.hidden=false;let clock=0,requests=0,working=false;
  const adaptive=startDashboardRefresh({isActive:()=>true,now:()=>clock,refresh:async()=>{requests++;return {jobs:working?{processing:{count:1}}:{}};},onResult(){}});
  await adaptive.tick();clock=5000;await adaptive.tick();assert.equal(requests,1);
  clock=30000;working=true;await adaptive.tick();assert.equal(requests,2);
  clock=35000;await adaptive.tick();assert.equal(requests,3);
  document.hidden=true;clock=40000;await adaptive.tick();assert.equal(requests,3);adaptive.stop();
}finally{Object.assign(globalThis,saved);}
console.log('Performance regressions: 200-reader deduplication, identity/write isolation, 200 jobs at concurrency 3, submission receipt, zero runtime reads and dashboard lifecycle passed.');
