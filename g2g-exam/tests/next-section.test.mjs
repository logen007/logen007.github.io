import assert from 'node:assert/strict';
import {scrollExamToTop} from '../src/ui/exam-scroll.js';
for(const reduced of [false,true]){
  let options;
  scrollExamToTop({matchMedia:()=>({matches:reduced})},{querySelector:selector=>{assert.equal(selector,'.exam-paper');return {scrollIntoView:value=>{options=value;}};}});
  assert.deepEqual(options,{block:'start',behavior:reduced?'instant':'smooth'});
}
scrollExamToTop({}, {querySelector:()=>null});
import {ApiRepository} from '../src/repositories/api.js';
const repo=new ApiRepository();
repo.state.attempts=[{id:'a',answers:{},status:'in_progress'}];repo.state.scope='full';repo.user={role:'student'};
repo.reload=()=>{throw new Error('Autosave must not reload all state');};
repo.call=async(name,payload)=>{assert.equal(name,'saveAnswers');return {attempt:{...repo.state.attempts[0],answers:payload.answers}};};
await repo.transaction(state=>{state.attempts[0].answers.q=2;return true;});
assert.equal(repo.state.attempts[0].answers.q,2);
let calls=0;repo.call=async()=>{calls++;return {};};
await repo.transaction(()=>true);assert.equal(calls,0);
console.log('Autosave acknowledgement and no-op request elimination passed.');
