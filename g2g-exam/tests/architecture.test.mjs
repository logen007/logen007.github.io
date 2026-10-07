import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getExamSpec,getProviderLevels,buildSectionsFromSpec,groupSectionsBySkill} from '../src/exam-specs/index.js';
import {clone,byId,createExam,softDeleteQuestionGroup,restoreQuestionGroup,permanentlyDeleteQuestionGroup} from '../src/core.js';
import {seedState} from '../src/seed.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;const test=(name,fn)=>{try{fn();console.log(`✓ ${name}`);passed++;}catch(error){console.error(`✗ ${name}`);throw error;}};

test('Registry khai báo đúng dải Goethe/TELC',()=>{
  assert.deepEqual(getProviderLevels('GOETHE'),['A1','A2','B1','B2']);
  assert.deepEqual(getProviderLevels('TELC'),['B1','B2']);
});

test('Goethe A1 có cấu trúc từ registry thay vì slice vị trí',()=>{
  const spec=getExamSpec('GOETHE','A1');assert.equal(spec.configured,true);
  const sections=buildSectionsFromSpec(spec,{idFactory:i=>`s${i}`});assert.equal(sections.length,8);
  const groups=groupSectionsBySkill({sections},spec);assert.deepEqual(groups.map(([name])=>name),['Nghe','Đọc','Viết']);
  assert.equal(sections[0].templateType,'A1_LISTENING_PART_1');
  assert.equal(read('src/views/builder.js').includes('sections.slice('),false);
});

test('Goethe A1 lấy cấu trúc production từ specs/ thay vì hard-code trong registry',()=>{
  const source=read('src/exam-specs/goethe.js');
  assert.ok(source.includes("loadApprovedExamSpec('../../specs/goethe/a1/exam.json')"));
  assert.equal(source.includes("part('listening-1'"),false);
  const part=JSON.parse(read('specs/goethe/a1/listening/part-01.json'));
  assert.equal(part.status,'APPROVED');
  assert.equal(part.questionLimit,6);
  assert.equal(part.template,'A1_LISTENING_PART_1');
});

test('Metadata skillKey/templateType sống sót từ spec qua createExam',()=>{
  const state=clone(seedState),teacher=byId(state.users,'teacher-lan');
  const spec=getExamSpec('GOETHE','A1');
  const sections=buildSectionsFromSpec(spec,{idFactory:i=>`meta-${i}`});
  const exam=createExam(state,teacher,{title:'Metadata test',provider:'GOETHE',level:'A1',sections});
  assert.equal(exam.sections[0].skillKey,'listening');
  assert.equal(exam.sections[0].templateType,'A1_LISTENING_PART_1');
  assert.equal(exam.sections[1].templateType,'GENERIC');
});

test('Production image phục vụ specs JSON cùng app',()=>{
  assert.ok(read('server/Dockerfile').includes('COPY specs /app/public/specs'));
  assert.ok(read('server/src/index.js').includes("pathname.startsWith('/specs/')"));
});

test('App tạo/migrate đề qua exam factory, không hard-code GOETHE_A1_PARTS',()=>{
  const app=read('src/app.js');
  assert.ok(app.includes('createExamDraft'));
  assert.ok(app.includes('ensureExamMatchesConfiguredSpec'));
  assert.ok(app.includes('getProviderLevels'));
  assert.equal(app.includes('GOETHE_A1_PARTS'),false);
});

test('A2/B1/B2 chỉ là scaffold cho đến khi có cấu trúc được duyệt',()=>{
  for(const [provider,level] of [['GOETHE','A2'],['GOETHE','B1'],['GOETHE','B2'],['TELC','B1'],['TELC','B2']])assert.equal(getExamSpec(provider,level).configured,false);
});

test('Question group có vòng đời trash/restore/permanent delete',()=>{
  const s=clone(seedState),master=byId(s.users,'master-1'),teacher=byId(s.users,'teacher-lan');
  s.questionGroups||=[];
  const group={id:'qg-test',level:'A1',skill:'Nghe',partOrder:1,defaultScore:1,structureType:'A1_LISTENING_PART_1',audioPolicy:{maxSessions:1,segmentRepeat:2,controls:false,pauseAllowed:false,replayAllowed:false},questionIds:[],ownerId:teacher.id,ownerName:teacher.name,status:'active'};
  const q={id:'qg-q',title:'Q',type:'single',choices:['A','B'],correctAnswer:0,maxScore:1,groupId:group.id,ownerId:teacher.id,status:'active'};
  group.questionIds=[q.id];s.questionGroups.push(group);s.questions.push(q);
  softDeleteQuestionGroup(s,teacher,group.id);assert.equal(group.status,'trash');assert.equal(q.deletedByGroupId,group.id);
  restoreQuestionGroup(s,master,group.id);assert.equal(group.status,'active');assert.equal(q.status,'active');
  softDeleteQuestionGroup(s,teacher,group.id);permanentlyDeleteQuestionGroup(s,master,group.id);assert.equal(s.questionGroups.some(x=>x.id===group.id),false);assert.equal(s.questions.some(x=>x.id===q.id),false);
});

test('Media garbage collector được khởi động từ server',()=>{
  const index=read('server/src/index.js'),gc=read('server/src/media-gc.js');
  assert.ok(index.includes('startMediaGarbageCollector'));
  assert.ok(gc.includes('MEDIA_GC_GRACE_HOURS'));
  assert.ok(gc.includes('referencedUploadNames'));
});

test('Legacy Firebase và app root cũ đã được loại khỏi production tree',()=>{
  for(const rel of ['app.js','firebase-config.js','firebase.json','firestore.rules','functions'])assert.equal(fs.existsSync(path.join(root,rel)),false,`Còn legacy: ${rel}`);
});

console.log(`\n${passed} kiểm thử kiến trúc đã đạt.`);
