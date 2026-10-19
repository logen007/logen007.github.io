import assert from 'node:assert/strict';
import {createProviderJobPump} from '../server/src/provider-job-pump.js';
import {AI_PROVIDER_IDS} from '../src/domain/ai-providers.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
let idleReads=0;
const idle=createProviderJobPump({getProviders:async()=>['groq','gemini','grok','mistral'].map(id=>({id})),hasWork:async()=>{idleReads++;return false;},claim:()=>assert.fail('Idle queue must not query each provider'),processJob:()=>assert.fail()});
await idle.tick();assert.equal(idleReads,1);idle.stop();

for(let count=0;count<=AI_PROVIDER_IDS.length;count++){
  const ids=AI_PROVIDER_IDS.slice(0,count),jobs=Array.from({length:200},(_,id)=>({id}));
  const active=new Map(),seen=new Set(),used=new Set();let peak=0;
  const pump=createProviderJobPump({spacingMs:0,getProviders:async()=>ids.map(id=>({id,version:'v1'})),
    claim:async()=>{await settle();return jobs.shift();},
    processJob:async(job,id)=>{
      assert.equal(active.get(id)||0,0,'Each provider has only one in-flight job');
      active.set(id,1);used.add(id);peak=Math.max(peak,[...active.values()].reduce((a,b)=>a+b,0));
      assert.ok(!seen.has(job.id),'A paper must not be processed twice');seen.add(job.id);
      for(let turn=0;turn<=count;turn++)await settle();
      active.set(id,0);
    }});
  await Promise.all(Array.from({length:20},()=>pump.tick()));
  for(let turn=0;seen.size<200&&count&&turn<1200;turn++){await settle();await pump.tick();}
  await settle();pump.stop();
  assert.equal(seen.size,count?200:0);assert.equal(used.size,count);assert.equal(peak,count);
}

let time=100000,version='v1',enabled=['groq','mistral'],calls=[],finishGroq;
const queue=Array.from({length:10},(_,id)=>({id}));
const pump=createProviderJobPump({clock:()=>time,spacingMs:2000,
  getProviders:async()=>enabled.map(id=>({id,version})),claim:async()=>queue.shift(),
  processJob:async(job,id)=>{
    calls.push({job:job.id,id});
    if(id==='groq'&&version==='v1')return {cooldownMs:60000,error:'Groq quota'};
    if(id==='groq')await new Promise(resolve=>finishGroq=resolve);
  }});
await pump.tick();await settle();
assert.deepEqual(calls.map(call=>call.id),['groq','mistral']);
for(let i=0;i<3;i++){time+=2000;await pump.tick();await settle();}
assert.equal(calls.filter(call=>call.id==='groq').length,1,'Limited provider rests across ticks');
assert.equal(calls.filter(call=>call.id==='mistral').length,4,'Healthy provider keeps draining the queue');
assert.equal(pump.status().find(item=>item.id==='groq').error,'Groq quota');
version='v2';await pump.tick();await settle();
assert.equal(calls.filter(call=>call.id==='groq').length,2,'Updated credentials resume a paused lane');
assert.equal(pump.status().find(item=>item.id==='groq').error,null);
enabled=['mistral'];await pump.tick();finishGroq();await settle();time+=2000;await pump.tick();await settle();
assert.equal(calls.filter(call=>call.id==='groq').length,2,'Disabled provider stops receiving jobs');
pump.stop();const before=calls.length;time+=90000;await pump.tick();await settle();assert.equal(calls.length,before);
console.log('Provider lanes: 200 jobs with 0–4 providers, per-provider exclusivity, quota isolation, credential refresh, removal and stop passed.');
