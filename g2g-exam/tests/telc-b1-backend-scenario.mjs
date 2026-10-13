import assert from 'node:assert/strict';
import {telcFixture} from './telc-b1-fixture.mjs';
import {startAttempt,saveAnswers,setAttemptSection,submitAttempt} from '../server/src/actions/attempts.js';
import {saveManualGrade,publishAttemptResult} from '../server/src/actions/grading.js';
import {saveOralScore} from '../server/src/actions/oral.js';
import {loadState,commitOperations} from '../server/src/state.js';

export async function telcB1BackendScenario({query,teacher,student}){
  const state={exams:[],questions:[],attempts:[],auditLogs:[]};
  const {exam,rows}=telcFixture(state,teacher);exam.status='published';
  await commitOperations(teacher,[...state.questions.map(q=>({collection:'questions',id:q.id,item:q})),{collection:'exams',id:exam.id,item:exam}]);
  const started=await startAttempt(student,{examId:exam.id}),id=started.attemptId||started.id;
  const stored=(await query('SELECT public_data FROM attempts WHERE id=$1',[id])).rows[0].public_data;
  assert.equal(stored.examDeadlineMs-Date.parse(stored.startedAt),150*60000);
  const visible=await loadState(student),publicExam=visible.exams.find(e=>e.id===exam.id);
  assert.deepEqual(publicExam.sections[0].headingOptions,exam.sections[0].headingOptions);
  assert.deepEqual(publicExam.sections[3].gapOptions,exam.sections[3].gapOptions);
  assert.equal(publicExam.sections[4].gapOptions.length,12);
  const ids=new Set(exam.sections.flatMap(s=>s.questionIds));
  for(const q of visible.questions.filter(q=>ids.has(q.id)&&!q.example))assert.equal('correctAnswer' in q,false);
  const head=exam.sections[0].questionIds;
  await saveAnswers(student,{attemptId:id,answers:{[head[0]]:0}});
  await assert.rejects(()=>saveAnswers(student,{attemptId:id,answers:{[head[1]]:0}}),/einmal/);
  const snapshot=(await query('SELECT private_data FROM attempts WHERE id=$1',[id])).rows[0].private_data.examSnapshot;
  for(let index=0;index<exam.sections.length;index++){
    await setAttemptSection(student,{attemptId:id,index});
    const answers=Object.fromEntries(rows(exam.sections[index]).filter(q=>!q.example).map(q=>[q.id,q.type==='writing'?'Meine Antwort':snapshot.questionSnapshot.find(item=>item.id===q.id).correctAnswer]));
    await saveAnswers(student,{attemptId:id,answers});
  }
  // Editing public bank/source keys after start must not change the active snapshot.
  const changed=structuredClone(exam);changed.sections[0].headingOptions[0]='Changed heading';
  const q=structuredClone(rows(exam.sections[0])[0]);q.correctAnswer=(q.correctAnswer+1)%5;
  await commitOperations(teacher,[{collection:'exams',id:exam.id,item:changed},{collection:'questions',id:q.id,item:q}]);
  assert.deepEqual((await loadState(student)).exams.find(e=>e.id===exam.id).sections[0].headingOptions,exam.sections[0].headingOptions);
  await submitAttempt(student,{attemptId:id});
  assert.equal((await query('SELECT private_data FROM attempts WHERE id=$1',[id])).rows[0].private_data.autoScore,180);
  await assert.rejects(()=>saveManualGrade(teacher,{attemptId:id,scores:{'Viết 1':46}}),/0–45/);
  await saveManualGrade(teacher,{attemptId:id,scores:{'Viết 1':45}});
  await saveOralScore(teacher,{attemptId:id,score:75});
  await publishAttemptResult(teacher,{attemptId:id});
  const result=(await query('SELECT public_data FROM attempts WHERE id=$1',[id])).rows[0].public_data.resultSummary;
  assert.equal(result.written.max,225);assert.equal(result.written.score,225);
  assert.equal(result.skills.grammar.max,30);assert.equal(result.total,300);assert.equal(result.passed,true);
  console.log('TELC B1 SQL: private keys, stable snapshots, save/reload, per-gap repeats, 150-minute timer and 300-point publication passed.');
}
