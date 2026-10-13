import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {scoreQuestion} from '../src/domain/question-score.js';
import {calculateAutomaticScores} from '../src/domain/attempts.js';
import {loadStudentReview} from '../src/controllers/student-review.js';
import {buildAttemptReview} from '../src/domain/attempt-review.js';
import {provisionalResult} from '../src/domain/provisional-result.js';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
// Both runtimes must retain one owner for grading arithmetic.
assert.match(read('server/src/actions/shared.js'),/export \{scoreQuestion\} from .*question-score/);
assert.match(read('src/domain/attempts.js'),/import \{scoreQuestion\} from .*question-score/);
const choice={id:'q',type:'single',autoGrade:true,correctAnswer:0,maxScore:5};
for(const type of ['single','truefalse','cloze']){
  for(const [answer,expected] of [[0,5],['0',5],[1,0],[null,0],[undefined,0],['',0]]){
    assert.equal(scoreQuestion({...choice,type},answer),expected);
  }
}
for(const q of [undefined,{...choice,example:true},{...choice,autoGrade:false},{...choice,type:'writing'},{...choice,maxScore:0}])assert.equal(scoreQuestion(q,0),0);
const matching={id:'m',type:'matching',autoGrade:true,maxScore:5,pairs:[['a','A'],['b','B'],['c','C']]};
for(const [answer,expected] of [[['A','B','C'],5],[['A','x','C'],3.33],[['A'],1.67],[[],0],[{},0],[null,0]])assert.equal(scoreQuestion(matching,answer),expected);
assert.equal(scoreQuestion({...matching,pairs:[]},[]),0);
const questions=[choice,matching,{...choice,id:'example',example:true}];
const exam={id:'exam',provider:'GOETHE',level:'A1',sections:[{name:'Đọc 1',questionIds:questions.map(q=>q.id)}]};
const attempt={id:'mine',studentId:'student',examId:exam.id,status:'published',answers:{q:0,m:['A','x','C'],example:0}};
assert.deepEqual(calculateAutomaticScores({exams:[exam],questions},attempt),{autoScore:8.33,sectionScores:{'Đọc 1':8.33}});

const student={id:'student',name:'Học viên'};
const data={attempts:[attempt],exams:[exam],questions};
const local=await loadStudentReview({repo:{mode:'local'},data,user:student,attemptId:'mine'});
assert.equal(local.attempt.id,'mine');
for(const id of ['missing','mine'])await assert.rejects(loadStudentReview({repo:{mode:'local'},data,user:{id:'other'},attemptId:id}),/Không tìm thấy/);
const snapshot={...exam,title:'Frozen title',questionSnapshot:questions};
const frozen=await loadStudentReview({repo:{mode:'local'},data:{...data,attempts:[{...attempt,examSnapshot:snapshot}],exams:[],questions:[]},user:student,attemptId:'mine'});
assert.equal(frozen.attempt.examTitle,'Frozen title');
const apiResult={from:'server'};
assert.equal(await loadStudentReview({repo:{mode:'api',call:async(name,args)=>{assert.equal(name,'getAttemptReview');assert.deepEqual(args,{attemptId:'mine'});return apiResult;}},user:student,attemptId:'mine'}),apiResult);
await assert.rejects(loadStudentReview({repo:{mode:'api',call:async()=>{throw new Error('offline');}},attemptId:'mine'}),/offline/);

// Exercise the actual server handler with a DB double, without a live database.
const context=vm.createContext({buildAttemptReview,provisionalResult,query:()=>{throw new Error('Unexpected database access');},appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})});
vm.runInContext(read('server/src/actions/attempt-review.js').replace(/^import .*;\n/gm,'').replace('export async function','async function'),context);
for(const missing of [true,false]){
  let calls=0;
  await assert.rejects(context.getAttemptReview({id:'other'},{attemptId:'mine'},{runQuery:async()=>{calls++;return {rowCount:missing?0:1,rows:missing?[]:[{student_id:'student'}]};}}),error=>error.statusCode===404);
  assert.equal(calls,1,'Unauthorized requests must not load the exam or answer keys');
}
for(const status of ['published','ready','grading','submitted']){
  let calls=0;
  const row={student_id:student.id,status,exam_id:exam.id,public_data:{...attempt,status:'published'},private_data:{examSnapshot:snapshot,feedback:'Private feedback'}};
  const review=await context.getAttemptReview(student,{attemptId:'mine'},{runQuery:async()=>++calls===1?{rowCount:1,rows:[row]}:{rows:[]}});
  assert.equal(calls,2,'A frozen snapshot should not query the question bank');
  assert.equal(review.attempt.status,status);
  assert.equal(review.sections[0].questions[0].correct,status==='published'?0:null);
  assert.equal(review.score?.feedback??null,status==='published'?'Private feedback':null);
}
console.log('Maintainability: shared scoring, review loading, ownership, frozen snapshots and publication privacy passed.');
for(const status of ['grading','published','in_progress','incomplete']){
  let calls=0;
  const row={student_id:student.id,status,public_data:{...attempt,status:'published'},private_data:{examSnapshot:snapshot,feedback:'PRIVATE'}};
  const progress=await context.getAttemptReview(student,{attemptId:'mine',progressOnly:true},{runQuery:async()=>++calls===1?{rowCount:1,rows:[row]}:{rows:[]}});
  assert.equal(progress.status,status);
  assert.equal(Boolean(progress.provisional),status==='grading');
  assert.doesNotMatch(JSON.stringify(progress),/answers|correctAnswer|PRIVATE|questionSnapshot/);
}
await assert.rejects(context.getAttemptReview({id:'other'},{attemptId:'mine',progressOnly:true},{runQuery:async()=>({rowCount:1,rows:[{student_id:'student'}]})}),e=>e.statusCode===404);
