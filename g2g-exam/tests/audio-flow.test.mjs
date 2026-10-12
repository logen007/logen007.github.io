import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getExamSpec} from '../src/exam-specs/index.js';
import {partAudioSegments,partAudioQuestions,normalizeAudioFlow} from '../src/domain/part-audio.js';
import {audioFlowFields,audioFlowPreview} from '../src/ui/skill-settings.js';
import {createExam,updateSection,duplicateExam} from '../src/domain/exams.js';
import {ensureExamMatchesConfiguredSpec,createExamDraft} from '../src/controllers/exam-factory.js';
import {seedState} from '../src/seed.js';

const expanded=(s,qs)=>partAudioSegments(s,qs).flatMap(segment=>Array(segment.repeat).fill(segment.url));
// Every configured listening part retains its approved default sequence.
for(const [provider,levels] of [['GOETHE',['A1','A2','B1','B2']],['FID',['A1','A2']],['TELC',['B1','B2']]]){
  for(const level of levels)for(const part of getExamSpec(provider,level).skills.find(s=>s.key==='listening').parts){
    const p=part.audioPolicy,section={...part,instructionAudioUrl:'intro'};
    const qs=[{id:'ex',example:true,audioUrl:'ex'},...Array.from({length:part.questionLimit},(_,i)=>({id:'q'+i,audioUrl:'q'+i,maxScore:1}))];
    const tasks=p.questionsPerSegment===2?qs.slice(1).filter((_,i)=>i%2===0):p.sharedPart?qs.slice(1,2):qs.slice(1);
    assert.deepEqual(expanded(section,qs),['intro','ex',...tasks.flatMap(q=>Array(p.segmentRepeat).fill(q.id))],provider+level+part.key);
  }
}
const qs=[{id:'ex',example:true,audioUrl:'ex'},...Array.from({length:4},(_,i)=>({id:String(i+1),audioUrl:String(i+1),maxScore:1}))];
const flow={source:'question',segmentRepeat:2,instructionRepeat:1,exampleRepeat:1,repeatOrder:'round'};
const section={id:'s',skill:'Nghe',skillKey:'listening',instructionAudioUrl:'intro',questionIds:qs.map(q=>q.id),audioPolicy:{mode:'per_question_segment',segmentRepeat:2},audioFlow:flow};
assert.deepEqual(expanded(section,qs),['intro','ex','1','2','3','4','1','2','3','4']);
assert.deepEqual(expanded({...section,audioFlow:{...flow,repeatOrder:'consecutive'}},qs),['intro','ex','1','1','2','2','3','3','4','4']);
assert.deepEqual(expanded({...section,audioFlow:{...flow,source:'part',exampleRepeat:2,instructionRepeat:2}},qs),['intro','intro','ex','ex','1','1']);
assert.deepEqual(partAudioQuestions({...section,audioFlow:{...flow,source:'pair'}},qs).map(q=>q.id),['ex','1','3']);
assert.equal(audioFlowPreview({...section,instructionAudioUrl:''},[]),'Chưa có audio.');
assert.match(audioFlowPreview(section,qs),/Đề bài → Ví dụ → Câu 1 → Câu 2/);
assert.doesNotMatch(audioFlowFields(section,qs),/defaultQuestionScore|Điểm mặc định/);
assert.throws(()=>normalizeAudioFlow({...flow,segmentRepeat:1000}));
assert.throws(()=>normalizeAudioFlow({...flow,exampleRepeat:0}));
assert.throws(()=>normalizeAudioFlow({...flow,source:'invalid'}));
assert.equal(normalizeAudioFlow(null),null);
const state=structuredClone(seedState),teacher=state.users.find(u=>u.role==='teacher')||state.users.find(u=>u.role==='master');
const exam=createExam(state,teacher,{title:'Flow',sections:[section]});
assert.deepEqual(exam.sections[0].audioFlow,flow);
updateSection(state,teacher,exam.id,'s',{name:'Renamed'});
assert.deepEqual(exam.sections[0].audioFlow,flow);
const configured=createExamDraft(state,teacher,{provider:'GOETHE',level:'A1',title:'Configured'});
configured.sections[0].audioFlow=flow;
ensureExamMatchesConfiguredSpec(state,teacher,configured.id);
assert.deepEqual(configured.sections[0].audioFlow,flow,'Opening builder preserves custom flow');
assert.deepEqual(duplicateExam(state,teacher,configured.id).sections[0].audioFlow,flow,'Copies preserve flow');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
assert.doesNotMatch(app,/id="defaultQuestionScore"/);
assert.match(app,/openSkillSettings/);
console.log('Audio flow: all default providers, repeats, rounds, groups, missing audio, persistence, copies and UI passed.');
