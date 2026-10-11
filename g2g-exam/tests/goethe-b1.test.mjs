import assert from 'node:assert/strict';
import {seedState} from '../src/seed.js';
import {createExamDraft,ensureExamMatchesConfiguredSpec} from '../src/controllers/exam-factory.js';
import {examDurationSeconds} from '../src/domain/exam-clock.js';
import {manualGroups} from '../src/domain/manual-grading.js';
import {oralMaximum} from '../src/domain/gradebook.js';
import {partAudioSegments,partAudioQuestions} from '../src/domain/part-audio.js';
import {letterAnswerError} from '../src/domain/letter-answers.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {examHtml} from '../src/views/student.js';
import {validateExamForPublish,startAttempt,submitAttempt,saveManualScore} from '../src/core.js';
const state=structuredClone(seedState),teacher=state.users.find(u=>u.id==='teacher-lan'),student=state.users.find(u=>u.id==='student-a');
const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'B1',title:'B1 regression'});
const rows=section=>section.questionIds.map(id=>state.questions.find(q=>q.id===id));
const legacyExam=structuredClone(exam);
for(const name of ['Đọc 1','Đọc 2','Đọc 3','Đọc 4','Đọc 5','Nghe 2','Nghe 3','Nghe 4']){
  const sectionIndex=exam.sections.findIndex(s=>s.name===name),split=name.startsWith('Đọc');
  assert.equal(exam.sections[sectionIndex].questionProfile.splitLayout,split);
  // Old exams may have no reading flag, or a previously saved listening split.
  if(split)delete legacyExam.sections[sectionIndex].questionProfile.splitLayout;
  else legacyExam.sections[sectionIndex].questionProfile.splitLayout=true;
  for(const preview of [true,false]){
    const html=examHtml({exam:legacyExam,sectionIndex,questions:[],attempt:{id:'split-test',answers:{}},online:true,preview});
    assert.equal(html.includes('class="exam-reading-split"'),split,name);
  }
}
assert.equal(exam.sections.length,12);
assert.equal(examDurationSeconds(exam),165*60);
assert.equal(oralMaximum(exam),100);
assert.deepEqual(manualGroups(exam,state.questions).map(g=>[g.key,g.max]),[['Viết 1',40],['Viết 2',40],['Viết 3',20]]);
assert.deepEqual(exam.sections.map(s=>rows(s).filter(q=>!q.example).length),[6,6,7,7,4,10,5,7,8,1,1,1]);
for(const section of exam.sections){
  const qs=rows(section);
  qs.forEach((q,i)=>{q.title='Question '+i;if(q.type==='single'&&!section.questionProfile.uniqueLetters)q.choices=['Option A','Option B','Option C'];if(section.questionProfile.uniqueLetters)q.correctAnswer=i;});
  if(section.audioPolicy){
    const selected=partAudioQuestions(section,qs);
    selected.forEach((q,i)=>q.audioUrl='/uploads/'+section.id+'-'+i+'.mp3');
    const expected={'Nghe 1':[1,2,2,2,2,2],'Nghe 2':[1,1,1,1,1,1],'Nghe 3':[1,1,1,1,1,1,1,1],'Nghe 4':[2]};
    assert.deepEqual(partAudioSegments(section,qs).map(s=>s.repeat),expected[section.name]);
    const html=renderBuilder({data:state,exam,section});
    assert.equal((html.match(/data-field="audio"/g)||[]).length,selected.length+1);
  }
}
const pairSection=exam.sections.find(s=>s.name==='Nghe 1'),paired=rows(pairSection);
assert.deepEqual(paired.map(q=>q.type),Array.from({length:6},()=>['truefalse','single']).flat());
assert.equal((renderBuilder({data:state,exam,section:pairSection}).match(/class="paired-question-group"/g)||[]).length,6);
assert.doesNotMatch(renderBuilder({data:state,exam,section:pairSection}),/<h3>Text \d+<\/h3>/);
assert.match(renderBuilder({data:state,exam,section:pairSection}),/<h3>Beispiel<\/h3>/);
const reading=exam.sections.find(s=>s.name==='Đọc 3'),letters=rows(reading);
assert.deepEqual(letters[0].choices,[...'ABCDEFGHIJ','X']);
const answers=Object.fromEntries(letters.filter(q=>!q.example).map((q,i)=>[q.id,i+1]));
answers[letters[1].id]=10;answers[letters[2].id]=10;
assert.match(letterAnswerError(reading,letters,answers),/einmal/);
assert.deepEqual(validateExamForPublish(state,exam),[]);
const before=JSON.stringify(exam);assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,exam.id),false);assert.equal(JSON.stringify(exam),before);
exam.status='published';
const attempt=startAttempt(state,student,exam.id);
submitAttempt(state,student,attempt.id);
assert.equal(attempt.autoScore,0);
assert.throws(()=>saveManualScore(state,teacher,attempt.id,{scores:{'Viết 3':21}}),/0–20/);
saveManualScore(state,teacher,attempt.id,{scores:{'Viết 1':30,'Viết 2':30,'Viết 3':15}});
console.log('Goethe B1: structure, timing, paired audio, unique X, authoring and grading passed.');
