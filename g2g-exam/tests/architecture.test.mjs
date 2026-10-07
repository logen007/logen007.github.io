import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getExamSpec,getProviderLevels,buildSectionsFromSpec,groupSectionsBySkill} from '../src/exam-specs/index.js';
import {clone,byId,softDeleteQuestionGroup,restoreQuestionGroup,permanentlyDeleteQuestionGroup} from '../src/core.js';
import {seedState} from '../src/seed.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
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
  const index=fs.readFileSync(path.join(root,'server/src/index.js'),'utf8');
  const gc=fs.readFileSync(path.join(root,'server/src/media-gc.js'),'utf8');
  assert.ok(index.includes('startMediaGarbageCollector'));
  assert.ok(gc.includes('MEDIA_GC_GRACE_HOURS'));
  assert.ok(gc.includes('referencedUploadNames'));
});

console.log(`\n${passed} kiểm thử kiến trúc đã đạt.`);
