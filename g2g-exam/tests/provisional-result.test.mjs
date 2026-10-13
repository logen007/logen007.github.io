import assert from 'node:assert/strict';
import {buildAttemptReview} from '../src/domain/attempt-review.js';
import {provisionalResult} from '../src/domain/provisional-result.js';
import {attemptResultHtml,resultShareText} from '../src/views/attempt-result.js';
import {startResultRefresh} from '../src/controllers/result-refresh.js';

const exam={provider:'GOETHE',level:'A1',sections:[
  {name:'Đọc',questionIds:['example','a','b']},
  {name:'Viết 1',key:'writing-1',questionIds:['form']},
  {name:'Viết 2',questionIds:['w','pending','failed','missing']},
]};
const questions=[{id:'example',example:true,maxScore:10,autoGrade:true,type:'single',correctAnswer:0},
  {id:'a',type:'single',autoGrade:true,maxScore:3,correctAnswer:1},
  {id:'b',type:'single',autoGrade:true,maxScore:2,correctAnswer:0},
  {id:'form',type:'writing',writingFormVersion:1,maxScore:1,rubric:[{type:'text',maxScore:1,answers:'Anna'}]},
  ...['w','pending','failed','missing'].map(id=>({id,type:'writing',maxScore:10,aiGradingRules:'PRIVATE RULE',title:'PRIVATE RULE'}))];
const attempt={id:'mine',status:'grading',answers:{a:1,b:1,form:{0:'anna'},w:'essay',pending:'essay',failed:'essay',missing:''}};
const privateData={manualScores:{Viết:99},totalScore:999,feedback:'PRIVATE FEEDBACK',aiWritingSuggestions:{
  w:{status:'completed',suggestedScore:7,findings:[{text:'PRIVATE FINDING'}]},
  failed:{status:'failed',error:'PRIVATE ERROR'},
}};
const before=JSON.stringify({attempt,privateData}),review=buildAttemptReview({exam,questions,attempt,privateData});
assert.deepEqual(review.provisional.parts.slice(0,2),[{label:'Đọc',score:3,max:5,source:'automatic'},{label:'Viết 1',score:1,max:1,source:'automatic'}]);
assert.deepEqual(review.provisional.parts.slice(2).map(p=>p.score),[7,null,null,null]);
assert.deepEqual(review.provisional.parts.slice(2).map(p=>p.status),['completed','pending','failed','unavailable']);
assert.equal(review.score,null);assert.equal(review.sections[0].questions[0].correct,null);
assert.doesNotMatch(JSON.stringify(review),/PRIVATE|999/);
assert.equal(JSON.stringify({attempt,privateData}),before);
const html=attemptResultHtml({review});
assert.match(html,/– điểm tạm tính/);assert.match(html,/Chờ điểm/);assert.match(html,/provisional-score/);
assert.doesNotMatch(html,/AI|Đạt|Chưa đạt|Đáp án đúng|PRIVATE|điểm dự kiến/);
assert.equal(resultShareText(review),null);
for(const status of ['in_progress','incomplete','abandoned','published'])assert.equal(provisionalResult(exam,questions,{...attempt,status},privateData),null);
for(const value of [null,'',Infinity,'bad']){
  assert.equal(provisionalResult(exam,questions,attempt,{aiWritingSuggestions:{w:{status:'completed',suggestedScore:value}}}).parts[2].score,null);
}
for(const [value,expected] of [[0,0],[-3,0],[100,10]])assert.equal(provisionalResult(exam,questions,attempt,{aiWritingSuggestions:{w:{status:'completed',suggestedScore:value}}}).parts[2].score,expected);

// Refreshes do not overlap, do not fetch hidden/inactive pages, and discard late responses.
const oldDocument=globalThis.document;globalThis.document={addEventListener(){},removeEventListener(){}};
let clock=0,active=true,hidden=false,current=review,calls=0,updates=0,published=0,release;
const refresh=startResultRefresh({now:()=>clock,isActive:()=>active,hidden:()=>hidden,getReview:()=>current,
  refresh:async()=>{calls++;return new Promise(resolve=>release=resolve);},onResult:p=>{updates++;current={...current,provisional:p};},onPublished:async()=>{published++;active=false;}});
try{
  clock=15000;hidden=true;await refresh.tick();assert.equal(calls,0);
  hidden=false;const first=refresh.tick();await refresh.tick();assert.equal(calls,1);
  release({status:'grading',provisional:review.provisional});await first;assert.equal(updates,0);
  clock=30000;const second=refresh.tick();current={...current,attempt:{id:'another'}};release({status:'grading',provisional:{parts:[]}});await second;assert.equal(updates,0);
  clock=45000;const third=refresh.tick();release({status:'published'});await third;assert.equal(published,1);
  clock=200000;await refresh.tick();assert.equal(calls,3);
}finally{refresh.stop();globalThis.document=oldDocument;}
console.log('Temporary scores: private projection, forms, missing/zero AI marks, publication boundaries, UI and refresh races passed.');
