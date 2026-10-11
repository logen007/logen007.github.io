import assert from 'node:assert/strict';
import {withExamTransition} from '../src/ui/exam-transition.js';
const saved={document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout};
const app={inert:false,querySelector:()=>null},delays=[];
let overlay;
globalThis.window={matchMedia:()=>({matches:false})};
globalThis.setTimeout=(fn,ms)=>{delays.push(ms);queueMicrotask(fn);};
globalThis.document={getElementById:()=>app,body:{append(){}},createElement(){
  overlay={setAttribute(){},focus(){},classList:{add(){}},querySelector:()=>({textContent:''}),remove(){this.removed=true;}};return overlay;
}};
try{
  let calls=0;
  const first=withExamTransition(async()=>{calls++;assert.equal(app.inert,true);});
  await withExamTransition(async()=>{calls++;});
  await first;
  assert.equal(calls,1);assert.deepEqual(delays,[1100,1100,250]);
  assert.equal(app.inert,false);assert.equal(overlay.removed,true);
  await assert.rejects(withExamTransition(async()=>{throw Error('network');}),/network/);
  assert.equal(app.inert,false);assert.equal(overlay.removed,true);
  delays.length=0;globalThis.window.matchMedia=()=>({matches:true});
  await withExamTransition(async()=>{});
  assert.deepEqual(delays,[150,150,0]);
}finally{Object.assign(globalThis,saved);}
console.log('Exam transition timing, duplicate guard, reduced motion and cleanup passed.');
