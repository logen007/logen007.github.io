import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {answerPresent,examCompletion,completionMessage} from '../src/domain/exam-completion.js';
import {submissionTiming} from '../src/domain/exam-clock.js';
import {isPrefilledQuestion} from '../src/domain/question-display.js';
import {submitAttempt} from '../src/domain/attempts.js';
import {submittedHtml,studentAttemptDetailHtml} from '../src/views/student.js';

const questions=Array.from({length:10},(_,i)=>({id:`q${i}`,type:'single',choices:['A','B'],correctAnswer:0,maxScore:1,autoGrade:true}));
const exam={id:'exam',sections:[{id:'read',name:'Reading',timeMinutes:1,questionIds:questions.map(q=>q.id)}]};
const answers=count=>Object.fromEntries(questions.slice(0,count).map(q=>[q.id,1]));
assert.deepEqual(examCompletion(exam,questions,answers(7)),{total:10,answered:7,minimum:8,percent:80,eligible:false});
assert.equal(examCompletion(exam,questions,answers(8)).eligible,true);
assert.equal(examCompletion({...exam,sections:[{questionIds:['q0','q1','q2']}]},questions,answers(2)).minimum,3);
const extra=[...questions,{id:'example',maxScore:0},{id:'demo',example:true,maxScore:1},{id:'oral',type:'speaking',maxScore:10}];
assert.equal(examCompletion({...exam,sections:[{questionIds:[...extra.map(q=>q.id),'q0']}]},extra,answers(8)).total,10);
for(const value of [undefined,null,'', '  ',-1,2,{},true])assert.equal(answerPresent(value,questions[0]),false);
assert.equal(answerPresent(0,questions[0]),true);
assert.equal(answerPresent('text',{type:'writing'}),true);
assert.equal(answerPresent(' ',{type:'writing'}),false);
assert.equal(answerPresent(['one',''],{type:'matching',pairs:[['a','b'],['c','d']]}),false);
const form={type:'writing',rubric:[{type:'text',maxScore:1},{type:'signature',maxScore:0}]};
assert.equal(answerPresent({0:'John'},form),true);
assert.equal(answerPresent({0:' '},form),false);

const student={id:'student',role:'student'};
const makeAttempt=(count,expired=false)=>({id:'attempt',studentId:student.id,examId:exam.id,status:'in_progress',answers:answers(count),startedAt:new Date(Date.now()-60000).toISOString(),examDeadlineMs:Date.now()+(expired?-1000:60000)});
const makeState=attempt=>({attempts:[attempt],exams:[exam],questions});
let attempt=makeAttempt(7),state=makeState(attempt);
assert.throws(()=>submitAttempt(state,student,attempt.id),/80 %/);
assert.equal(attempt.status,'in_progress');
attempt.examDeadlineMs=Date.now()-1;
submitAttempt(state,student,attempt.id);
assert.equal(attempt.status,'incomplete');assert.equal(attempt.timedOut,true);
assert.equal(attempt.totalScore,undefined);assert.deepEqual(attempt.answers,answers(7));
assert.equal(submitAttempt(state,student,attempt.id),attempt);
assert.throws(()=>submitAttempt(state,{...student,id:'other'},attempt.id),/quyền/);
assert.match(submittedHtml(attempt),/Không hoàn thành/);
assert.doesNotMatch(studentAttemptDetailHtml({review:{attempt,sections:[]}}),/sau khi giáo viên chấm xong/);
for(const expired of [true,false]){
  attempt=makeAttempt(8,expired);submitAttempt(makeState(attempt),student,attempt.id);
  assert.equal(attempt.status,'ready');assert.equal(attempt.autoScore,0,'Completion is not correctness');
}

// Execute the real server submission function with a locked-row DB double.
const source=readFileSync(new URL('../server/src/actions/attempts.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('export async function submitAttempt('),source.indexOf('export async function submitExpiredAttempts(')).replace('export ','');
let row,updates=[],scores=0;
const context=vm.createContext({
  examCompletion,completionMessage,submissionTiming,isPrefilledQuestion,
  withTx:async run=>run({query:async(sql,params)=>{if(sql.startsWith('SELECT'))return {rows:[row],rowCount:1};updates.push(params);return {rowCount:1};}}),
  appError:(status,message)=>Object.assign(new Error(message),{status}),attemptExam:async()=>exam,
  questionMap:async()=>new Map(questions.map(q=>[q.id,q])),audit:async()=>{},now:()=>new Date().toISOString(),
  isAutomaticWritingForm:()=>false,scoreQuestion:()=>{scores++;return 0;},resultFor:()=> 'Chưa đạt'
});
vm.runInContext(fn,context);
row={id:'attempt',student_id:student.id,status:'in_progress',public_data:makeAttempt(7),private_data:{examSnapshot:exam}};
await assert.rejects(()=>context.submitAttempt(student,{attemptId:row.id,percent:100,timedOut:true}),error=>error.status===409);
assert.equal(updates.length,0);assert.equal(scores,0);
await assert.rejects(()=>context.submitAttempt({id:'other'},{attemptId:row.id}),error=>error.status===403);
row.public_data.examDeadlineMs=Date.now()-1;
await context.submitAttempt(student,{attemptId:row.id});
assert.equal(updates.at(-1)[1],'incomplete');assert.equal(scores,0);
assert.equal(JSON.parse(updates.at(-1)[2]).completion.answered,7);
row.public_data=makeAttempt(8);
await context.submitAttempt(student,{attemptId:row.id});
assert.equal(updates.at(-1)[1],'ready');assert.equal(scores,10);
console.log('80% completion: rounding, examples, answers, local/server enforcement, timeout and review passed.');
