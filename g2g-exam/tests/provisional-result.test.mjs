import assert from 'node:assert/strict';
import {buildAttemptReview} from '../src/domain/attempt-review.js';
import {provisionalResult} from '../src/domain/provisional-result.js';
import {attemptResultHtml,resultShareText} from '../src/views/attempt-result.js';
import {startResultRefresh} from '../src/controllers/result-refresh.js';
import {provisionalSkills,provisionalResultHtml} from '../src/views/provisional-result.js';
import {bar} from '../src/views/attempt-result.js';

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
assert.deepEqual(review.provisional.parts.slice(0,2),[{skill:'reading',label:'Đọc',score:3,max:5,source:'automatic'},{skill:'writing',label:'Viết 1',score:1,max:1,source:'automatic'}]);
assert.deepEqual(review.provisional.parts.slice(2).map(p=>p.score),[7,null,null,null]);
assert.deepEqual(review.provisional.parts.slice(2).map(p=>p.status),['completed','pending','failed','unavailable']);
assert.equal(review.score,null);assert.equal(review.sections[0].questions[0].correct,1);
assert.doesNotMatch(JSON.stringify(review),/PRIVATE|999/);
assert.equal(JSON.stringify({attempt,privateData}),before);
const html=attemptResultHtml({review});
assert.match(html,/Tạm tính/);assert.match(html,/Chờ điểm/);assert.match(html,/provisional-score/);
assert.doesNotMatch(html,/AI|PRIVATE|điểm dự kiến/);
assert.match(html,/result-stats/);assert.match(html,/result-donut/);assert.match(html,/Đáp án đúng/);
assert.match(html,/data-provisional-result="writing"/);
const bars=[...html.matchAll(/<div class="result-bar">([\s\S]*?)<div class="result-track/g)].map(m=>m[1]);
assert.ok(bars.some(row=>row.includes('Đọc')&&!row.includes('Tạm tính')&&!row.includes('provisional-score')));
assert.equal(provisionalSkills(review.provisional).writing.score,null,'Missing writing parts are not zero');
assert.ok(!bars.some(row=>row.includes('Viết 1')||row.includes('Viết 2')));
const complete={parts:[
  {skill:'listening',label:'Nghe 1',score:2,max:6,source:'automatic'},
  {skill:'listening',label:'Nghe 2',score:4,max:4,source:'automatic'},
  {skill:'listening',label:'Nghe 3',score:2,max:5,source:'automatic'},
  {skill:'reading',label:'Đọc 1',score:11,max:15,source:'automatic'},
  {skill:'writing',label:'Viết 1',score:2,max:5,source:'automatic'},
  {skill:'writing',label:'Viết 2',score:0,max:10,source:'ai'},
]};
assert.deepEqual(provisionalSkills(complete).writing,{score:2,max:15,temporary:true});
const overview=provisionalResultHtml(complete,bar);
assert.match(overview,/class="score-badge score-pending temporary-badge" data-fixed-assessment>Tạm tính/);
assert.doesNotMatch(html,/<h2>Điểm từng phần/);
for(const [score,tone] of [[0,'failed'],[60,'sufficient'],[70,'satisfactory'],[80,'good'],[90,'excellent']]){
  for(const temporary of [false,true]){
    const progress=bar('Viết',{score,max:100},{showBand:false,temporary});
    assert.match(progress,new RegExp('result-track--'+tone));
    assert.doesNotMatch(progress,/score-badge score-(failed|sufficient|satisfactory|good|excellent)|result-track--temporary/);
  }
}
assert.ok(overview.indexOf('Đọc')<overview.indexOf('Nghe'));
assert.ok(overview.indexOf('Nghe')<overview.indexOf('Viết'));
assert.match(overview,/8<small> \/ 15/);
assert.match(overview,/2<small> \/ 15/);
assert.match(overview,/Nói/);
assert.equal((overview.match(/Tạm tính/g)||[]).length,1);
assert.doesNotMatch(overview,/Nghe 1|Viết 1|Viết 2/);
assert.equal(resultShareText(review),null);
for(const status of ['in_progress','incomplete','abandoned','published'])assert.equal(provisionalResult(exam,questions,{...attempt,status},privateData),null);
for(const status of ['in_progress','incomplete','abandoned']){
  const hidden=buildAttemptReview({exam,questions,attempt:{...attempt,status},privateData});
  assert.ok(hidden.sections.flatMap(s=>s.questions).every(q=>q.correct==null));
}
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
