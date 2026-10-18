import assert from 'node:assert/strict';
import {ExamOutbox} from '../src/repositories/exam-outbox.js';
let durable;
const store={read:async()=>structuredClone(durable),write:async(key,value)=>{durable=structuredClone(value);}};
const sent=[],statuses=[];
const box=await new ExamOutbox({store,key:'user:attempt',onStatus:s=>statuses.push(s),send:async changes=>{
  sent.push(changes);return {versions:Object.fromEntries(Object.entries(changes).map(([id,item])=>[id,item.operation]))};
}}).init();
box.edit('q',1);box.move(2);await box.persisted;
const restored=await new ExamOutbox({store,key:'user:attempt',send:box.send}).init();
const attempt={answers:{q:0},currentSectionIndex:0};restored.overlay(attempt);
assert.equal(attempt.answers.q,1);assert.equal(attempt.currentSectionIndex,2);
restored.close();
await box.flush();assert.equal(sent.length,1);assert.deepEqual(box.draft.pending,{});
assert.deepEqual(durable.pending,{});
box.send=async()=>{throw Object.assign(new Error('conflict'),{status:409});};
box.edit('q',2,'old');await assert.rejects(()=>box.flush(),/conflict/);
assert.equal(box.draft.pending.q.value,2);assert.equal(statuses.at(-1),'conflict');
let release,calls=0;
box.send=async changes=>{calls++;if(calls===1)await new Promise(resolve=>release=resolve);return {versions:{q:changes.q.operation}};};
const flight=box.flush();while(!release)await new Promise(resolve=>setTimeout(resolve,0));
box.edit('q',3);release();await flight;
assert.equal(calls,2);assert.deepEqual(box.draft.pending,{});
box.close();
let network=0;
const failed=await new ExamOutbox({store:{read:async()=>null,write:async()=>{throw Error('disk full');}},key:'u:a',send:async()=>{network++;}}).init();
failed.edit('x',1);await assert.rejects(()=>failed.flush(),/disk full/);
assert.equal(network,0);failed.close();
// Losing connectivity must retain the exact write and operation id on disk.
// Recovering/reloading must replay it, not silently replace it with server state.
for(const status of [undefined,429,503]){
 let disk,online=false,retryDelay,attempts=0;
 const history=[],answer='Liebe Anna,\nGrüße aus Köln! äöü ß <script>not markup</script>';
 const storage={read:async()=>structuredClone(disk),write:async(_key,value)=>{disk=structuredClone(value);}};
 const send=async changes=>{
  attempts++;
  if(!online)throw Object.assign(new Error('network unavailable'),{status});
  return {versions:{writing:changes.writing.operation}};
 };
 const offline=await new ExamOutbox({store:storage,key:'student:writing',send,onStatus:s=>history.push(s)}).init();
 offline.schedule=delay=>{retryDelay=delay;};
 offline.edit('writing',answer,'server-version');
 await assert.rejects(()=>offline.flush(),/network unavailable/);
 assert.equal(history.at(-1),'offline');assert.equal(retryDelay,5000);
 assert.equal(disk.pending.writing.value,answer);
 const operation=disk.pending.writing.operation;
 offline.close();online=true;
 const resumed=await new ExamOutbox({store:storage,key:'student:writing',send,onStatus:s=>history.push(s)}).init();
 const hydrated={answers:{writing:'old server value'}};resumed.overlay(hydrated);
 assert.equal(hydrated.answers.writing,answer);
 assert.equal(resumed.draft.pending.writing.operation,operation);
 await resumed.flush();assert.equal(attempts,2);
 assert.equal(history.at(-1),'saved');assert.deepEqual(disk.pending,{});resumed.close();
}
console.log('Durable outbox: restore, navigation, ack, conflict, in-flight edits and storage failure passed.');
console.log('Offline writing: durable Unicode text, network/429/503 failures, reload, operation replay and acknowledged cleanup passed.');
