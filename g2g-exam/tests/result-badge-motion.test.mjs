import assert from 'node:assert/strict';
import {animateResultBadge} from '../src/ui/result-badge-motion.js';
const saved={document:globalThis.document,matchMedia:globalThis.matchMedia};
const calls=[],listeners=new Map();
globalThis.document={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
globalThis.matchMedia=()=>({matches:false});
const element=()=>({getAttribute:()=>'.35',animate(frames,options){
  const call={frames,options,canceled:false};
  calls.push(call);
  return {finished:Promise.resolve(),cancel(){call.canceled=true;}};
}});
const queries=[],target=element();
const node={...element(),dataset:{resultState:'passed'},querySelector:selector=>{queries.push(selector);return target;}};
const stop=animateResultBadge(node);
assert.equal(calls.length,1);
assert.deepEqual(queries,['[data-medal-effect="check-line"]'],'Draw only the check; label and frame stay still');
assert.equal(calls[0].frames[0].strokeDashoffset,'1');
assert.equal(calls[0].frames.at(-1).strokeDashoffset,'0');
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
globalThis.matchMedia=()=>({matches:false});
globalThis.document.hidden=false;
for(const state of ['waiting','failed','fair','good','excellent']){
  node.dataset.resultState=state;
  queries.length=0;
  const before=calls.length;
  animateResultBadge(node);
  assert.equal(calls.length,before+(state==='good'?0:state==='excellent'?2:1),'Diamond uses a projection renderer instead of flat CSS transforms');
  assert.ok(queries.every(selector=>!selector.includes('label')&&!selector.includes('cluster')));
  if(state==='good')continue;
  const animation=calls[before];
  assert.ok(calls.slice(before).every(call=>call.options.duration+(call.options.delay||0)<=(state==='fair'?2400:1200)));
  if(state==='waiting'){
    assert.equal(animation.frames.at(-1).transform,'rotate(180deg)','Hourglass visibly flips');
    assert.equal(animation.options.fill,'forwards','Do not snap back after the flip');
  }
  if(state==='failed'){
    assert.equal(animation.frames.at(-1).transform,'none');
    assert.equal(animation.frames[1].transform,'scale(.86)');
    assert.ok(!JSON.stringify(animation.frames).includes('strokeDashoffset'),'Cross stays fully visible during one scale emphasis');
  }
  if(state==='fair')assert.equal(animation.frames.at(-1).transform,'rotate(1080deg)');
  if(state==='excellent'){
    assert.equal(animation.frames.at(-1).transform,'none');
  }
  if(state==='excellent')assert.equal(calls.at(-1).frames.at(-1).opacity,0,'Radiant ring disappears completely');
}
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(listeners.size,0);
Object.assign(globalThis,saved);
console.log('Badge motion: meaningful one-shot symbol effects, static frame/label, hidden cleanup and reduced motion passed.');
