import assert from 'node:assert/strict';
import {createExamDraft} from '../src/controllers/exam-factory.js';
import {parseGapText} from '../src/domain/inline-gaps.js';
import {partAudioQuestions} from '../src/domain/part-audio.js';
import {validateExamForPublish} from '../src/core.js';
import {startAttempt,saveAnswers,setAttemptSection,submitAttempt} from '../server/src/actions/attempts.js';
import {saveManualGrade,publishAttemptResult} from '../server/src/actions/grading.js';
import {saveOralScore} from '../server/src/actions/oral.js';
import {loadState,commitOperations} from '../server/src/state.js';

export async function b2BackendScenario({query,teacher,student}){
  const state={exams:[],questions:[],attempts:[],auditLogs:[]};
  const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'B2',title:'B2 integration'});
  const rows=s=>s.questionIds.map(id=>state.questions.find(q=>q.id===id));
  for(const section of exam.sections){
    rows(section).forEach((q,i)=>{
      q.title='Question '+i;
      if(section.questionProfile.uniqueLetters)q.correctAnswer=i;
      else if(q.type==='single'&&section.questionProfile.layout!=='letter-select')q.choices=['One','Two','Three'];
    });
    if(section.audioPolicy)partAudioQuestions(section,rows(section)).forEach(q=>q.audioUrl='/uploads/test.mp3');
  }
  const gap=exam.sections[1],parsed=parseGapText('Example [z]. Text [d] [a] [h] [b] [f] [c].',6);
  Object.assign(gap,{gapPassage:parsed.passage,gapExample:'Demo sentence',gapOptions:[...'abcdefgh'].map(k=>'Sentence '+k)});
  rows(gap).forEach((q,i)=>q.correctAnswer=parsed.keys[i]);
  gap.gapTitle='Die Geschichte des Fahrrads';
  assert.deepEqual(validateExamForPublish(state,exam),[]);
  exam.status='published';
  await commitOperations(teacher,[...state.questions.map(q=>({collection:'questions',id:q.id,item:q})),{collection:'exams',id:exam.id,item:exam}]);
  const started=await startAttempt(student,{examId:exam.id}),id=started.attemptId||started.id;
  const publicData=(await query('SELECT public_data FROM attempts WHERE id=$1',[id])).rows[0].public_data;
  assert.equal(publicData.examDeadlineMs-Date.parse(publicData.startedAt),180*60000);
  const visible=await loadState(student),publicExam=visible.exams.find(e=>e.id===exam.id);
  assert.deepEqual(publicExam.sections[1].gapPassage,parsed.passage);
  assert.equal(publicExam.sections[1].gapTitle,gap.gapTitle);
  assert.doesNotMatch(JSON.stringify(publicExam),/\[[a-h]\]/);
  for(const q of visible.questions.filter(q=>gap.questionIds.includes(q.id)))assert.equal('correctAnswer' in q,false);
  // Repeats are accepted in reading 1, but not in inline gaps.
  const r1=rows(exam.sections[0]).filter(q=>!q.example);
  await saveAnswers(student,{attemptId:id,answers:{[r1[0].id]:0,[r1[1].id]:0}});
  await setAttemptSection(student,{attemptId:id,index:1});
  const ids=gap.questionIds;
  await saveAnswers(student,{attemptId:id,answers:{[ids[0]]:0}});
  await assert.rejects(()=>saveAnswers(student,{attemptId:id,answers:{[ids[1]]:0}}),/einmal/);
  await saveAnswers(student,{attemptId:id,answers:{[ids[0]]:null,[ids[1]]:0}});
  await saveAnswers(student,{attemptId:id,answers:Object.fromEntries(ids.map((qid,i)=>[qid,parsed.keys[i]]))});
  // Editing the source cannot alter a running student's passage or grading key.
  const edited=structuredClone(exam);edited.sections[1].gapExample='Changed after start';
  await commitOperations(teacher,[{collection:'exams',id:exam.id,item:edited}]);
  assert.equal((await loadState(student)).exams.find(e=>e.id===exam.id).sections[1].gapExample,'Demo sentence');
  await setAttemptSection(student,{attemptId:id,index:3});
  const matching=rows(exam.sections[3]).filter(q=>!q.example);
  await saveAnswers(student,{attemptId:id,answers:{[matching[0].id]:8}});
  await assert.rejects(()=>saveAnswers(student,{attemptId:id,answers:{[matching[1].id]:8}}),/einmal/);
  await submitAttempt(student,{attemptId:id});
  const score=(await query('SELECT private_data FROM attempts WHERE id=$1',[id])).rows[0].private_data;
  assert.equal(score.autoScore,8); // 2 repeated reading-1 answers + all 6 inline gaps.
  await assert.rejects(()=>saveManualGrade(teacher,{attemptId:id,scores:{'Viết 1':61}}),/0–60/);
  await saveManualGrade(teacher,{attemptId:id,scores:{'Viết 1':50,'Viết 2':30}});
  await saveOralScore(teacher,{attemptId:id,score:80});
  await publishAttemptResult(teacher,{attemptId:id});
  assert.equal((await query('SELECT status FROM attempts WHERE id=$1',[id])).rows[0].status,'published');
  console.log('B2 SQL: save/reload, 180 minutes, hidden keys, repeat/unique letters, frozen passage, grading and publication passed.');
}
