import assert from 'node:assert/strict';
import {animateResultBadge} from '../src/ui/result-badge-motion.js';
const saved={document:globalThis.document,matchMedia:globalThis.matchMedia};
const calls=[],listeners=new Map();
globalThis.document={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
globalThis.matchMedia=()=>({matches:false});
const element=()=>({animate(frames,options){
  const call={frames,options,canceled:false};
  calls.push(call);
  return {finished:Promise.resolve(),cancel(){call.canceled=true;}};
}});
const elements=new Map([
  ['[data-medal-cluster="shell"]',element()],
  ['[data-medal-cluster="symbol"]',element()],
  ['[data-medal-cluster="plate"]',element()],
  ['.result-medal-label',element()]
]);
const node={...element(),querySelector:selector=>elements.get(selector)};
const stop=animateResultBadge(node);
assert.equal(calls.length,4);
assert.deepEqual(calls.map(call=>call.options.delay),[0,170,340,340],'Intact clusters arrive in readable order');
assert.deepEqual(calls[2].frames,calls[3].frames,'Plate and label move together');
assert.deepEqual(calls[2].options,calls[3].options);
assert.ok(calls.every(call=>call.frames.at(-1).transform==='none'));
assert.ok(calls.every(call=>!JSON.stringify(call.frames).includes('rotate')));
globalThis.document.hidden=true;
listeners.get('visibilitychange')();
assert.ok(calls.every(call=>call.canceled),'Background tabs stop the complete assembly');
stop();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(listeners.size,0,'Completed/canceled badges leave no document listeners');
globalThis.matchMedia=()=>({matches:true});
const count=calls.length;
animateResultBadge(node);
assert.equal(calls.length,count,'Reduced motion keeps the finished, readable badge');
Object.assign(globalThis,saved);
console.log('Badge motion: grouped assembly, attached label, hidden-tab cleanup and reduced motion passed.');
