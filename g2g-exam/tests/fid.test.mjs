import assert from 'node:assert/strict';
import {seedState} from '../src/seed.js';
import {createExamDraft} from '../src/controllers/exam-factory.js';
import {getExamSpec,getProviderLevels} from '../src/exam-specs/index.js';
import {oralMaximum,skillScores} from '../src/domain/gradebook.js';
import {examDurationSeconds} from '../src/domain/exam-clock.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {duplicateExam} from '../src/core.js';

assert.deepEqual(getProviderLevels('FID'),['A1','A2']);
assert.equal(getExamSpec('FID','B1'),null);
assert.deepEqual({...getExamSpec('FID','A2'),provider:'GOETHE'},getExamSpec('GOETHE','A2'));
const state=structuredClone(seedState),teacher=state.users.find(u=>u.id==='teacher-lan');
const original=JSON.stringify(state.exams);
for(const level of ['A1','A2']){
  const exam=createExamDraft(state,teacher,{provider:'FID',level,title:'FID '+level});
  assert.equal(exam.provider,'FID');
  assert.equal(duplicateExam(state,teacher,exam.id).provider,'FID');
  const scores=skillScores(exam,state.questions,{});
  if(level==='A1'){
    assert.deepEqual(exam.sections.map(s=>s.questionLimit),[6,6,6,6,1]);
    assert.deepEqual(['listening','reading','writing'].map(key=>scores[key].max),[18,12,12]);
    assert.equal(oralMaximum(exam),18);
    assert.equal(examDurationSeconds(exam),3600);
    assert.deepEqual(exam.sections.slice(0,2).map(s=>s.audioPolicy.segmentRepeat),[2,2]);
    assert.deepEqual(exam.sections[2].questionProfile.choices,['A','B','C']);
    assert.deepEqual(exam.sections[3].questionProfile.choices,['Richtig','Falsch']);
  }else{
    assert.equal(oralMaximum(exam),25);
    assert.equal(examDurationSeconds(exam),5400);
  }
  for(const section of exam.sections)assert.ok(renderBuilder({data:state,exam,section}).length);
}
assert.equal(JSON.stringify(state.exams.filter(e=>e.provider!=='FID')),original);
console.log('FID provider, structures, scores, durations, cloning and builder checks passed.');
