import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getExamSpec,getProviderLevels,buildSectionsFromSpec,groupSectionsBySkill} from '../src/exam-specs/index.js';
import {clone,byId,createExam} from '../src/core.js';
import {seedState} from '../src/seed.js';
import {createExamDraft,ensureExamMatchesConfiguredSpec} from '../src/controllers/exam-factory.js';

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
  assert.deepEqual(sections[1].questionProfile,{type:'single',choices:['Đúng','Sai'],layout:'true-false'});
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
  const listeningPart2=JSON.parse(read('specs/goethe/a1/listening/part-02.json'));
  assert.deepEqual(listeningPart2.questionProfile.choices,['Đúng','Sai']);
});

test('Metadata skillKey/templateType sống sót từ spec qua createExam',()=>{
  const state=clone(seedState),teacher=byId(state.users,'teacher-lan');
  const spec=getExamSpec('GOETHE','A1');
  const sections=buildSectionsFromSpec(spec,{idFactory:i=>`meta-${i}`});
  const exam=createExam(state,teacher,{title:'Metadata test',provider:'GOETHE',level:'A1',sections});
  assert.equal(exam.sections[0].skillKey,'listening');
  assert.equal(exam.sections[0].templateType,'A1_LISTENING_PART_1');
  assert.deepEqual(exam.sections[1].questionProfile,{type:'single',choices:['Đúng','Sai'],layout:'true-false'});
  assert.equal(exam.sections[1].templateType,'GENERIC');
});

test('Đề Goethe A1 cũ nhận profile Đúng/Sai của Nghe 2 khi mở lại',()=>{
  const state=clone(seedState),teacher=byId(state.users,'teacher-lan');
  const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'A1',title:'Profile migration',stamp:123});
  const section=exam.sections.find(item=>item.name==='Nghe 2');
  section.questionProfile=null;
  assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,exam.id,{stamp:456}),true);
  assert.deepEqual(byId(state.exams,exam.id).sections.find(item=>item.name==='Nghe 2').questionProfile,{type:'single',choices:['Đúng','Sai'],layout:'true-false'});
});

test('Mỗi form Goethe A1 lấy bố cục authoring từ specs',()=>{
  const spec=getExamSpec('GOETHE','A1');
  const parts=Object.fromEntries(buildSectionsFromSpec(spec,{idFactory:i=>`form-${i}`}).map(section=>[section.name,section.questionProfile]));
  assert.equal(parts['Nghe 1'].choiceImages,true);
  assert.deepEqual(parts['Nghe 2'].choices,['Đúng','Sai']);
  assert.equal(parts['Nghe 3'].choiceImages,true);
  assert.equal(parts['Đọc 1'].instructionImage,true);
  assert.equal(parts['Đọc 2'].choiceImages,true);
  assert.equal(parts['Đọc 3'].choiceImages,true);
  assert.equal(parts['Viết 1'].layout,'form-fields');
  assert.equal(parts['Viết 2'].layout,'free-response');
  const state=clone(seedState),teacher=byId(state.users,'teacher-lan');
  const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'A1',title:'Form data',stamp:789});
  const writing=exam.sections.find(section=>section.name==='Viết 1');
  assert.equal(byId(state.questions,writing.questionIds[0]).rubric.length,7);
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

test('Part template A1 Nghe 1 đã tách module và bỏ legacy question bank',()=>{
  const registry=read('src/part-templates/index.js'),loader=read('src/feature-loader.js'),admin=read('src/views/admin.js'),modals=read('src/views/modals.js'),server=read('server/src/actions/attempts.js');
  assert.ok(registry.includes("./a1-listening-part-1/index.js"));
  for(const rel of ['src/part-templates/a1-listening-part-1/editor.js','src/part-templates/a1-listening-part-1/student.js','src/part-templates/a1-listening-part-1/validator.js','src/part-templates/shared/api.js'])assert.ok(fs.existsSync(path.join(root,rel)),`Thiếu module: ${rel}`);
  assert.equal(fs.existsSync(path.join(root,'src/question-groups/bootstrap.js')),false);
  assert.equal(fs.existsSync(path.join(root,'src/question-groups/picker.js')),false);
  assert.equal(admin.includes('bankAdminHtml'),false);assert.equal(modals.includes('bankPickerHtml'),false);assert.equal(loader.includes('Ngân hàng câu hỏi'),false);
  assert.ok(server.includes('getA1ListeningPart1Spec'));assert.equal(server.includes('segmentRepeat)!==2'),false);
});

test('Builder định tuyến editor theo templateType thay vì hard-code Goethe A1',()=>{
  const builder=read('src/views/builder.js'),registry=read('src/part-templates/index.js'),app=read('src/app.js');
  assert.ok(builder.includes('renderPartBuilder(section.templateType'));
  assert.equal(builder.includes("provider==='GOETHE'"),false);
  assert.equal(builder.includes('goetheA1BuilderHtml'),false);
  assert.ok(registry.includes('renderPartBuilder'));assert.ok(registry.includes('bindPartBuilder'));
  assert.ok(fs.existsSync(path.join(root,'src/part-templates/default/builder.js')));
  assert.ok(fs.existsSync(path.join(root,'src/part-templates/a1-listening-part-1/builder.js')));
  assert.ok(app.includes('bindPartBuilder(section?.templateType'));
  assert.equal(app.includes("exam.provider==='GOETHE'&&exam.level==='A1'"),false);
});

test('A1 Nghe 1 vận hành trực tiếp bằng Part',()=>{
  const editor=read('src/part-templates/a1-listening-part-1/editor.js');
  const student=read('src/part-templates/a1-listening-part-1/student.js');
  const attempts=read('server/src/actions/attempts.js');
  const actions=read('server/src/actions/index.js');
  assert.ok(editor.includes('sectionPatch'));
  assert.equal(/questionGroups|groupId|groupInstruction|groupAudioPolicy/.test(editor),false);
  assert.ok(student.includes('attempt.currentSectionId'));
  assert.ok(student.includes("/actions/startPartAudio"));
  assert.equal(/questionGroups|groupId|groupInstruction/.test(student),false);
  assert.ok(attempts.includes('sessions[section.id]'));
  assert.equal(attempts.includes('startAudioGroup'),false);
  assert.equal(actions.includes("case 'startAudioGroup'"),false);
});

test('Step 9B2 hoàn tất migration và loại bỏ QuestionGroup khỏi runtime/schema',()=>{
  const schema=read('server/schema.sql'),db=read('server/src/db.js'),migration=read('server/src/migrations.js'),pkg=read('package.json');
  assert.equal(fs.existsSync(path.join(root,'src/domain/question-groups.js')),false);
  assert.equal(schema.includes('question_groups'),false);
  assert.ok(db.includes('migrateRetiredQuestionGroups'));
  assert.ok(migration.includes('DROP TABLE question_groups'));
  assert.equal(read('server/src/actions/attempts.js').includes('question_groups'),false);
  assert.equal(read('server/src/actions/index.js').includes('AudioGroup'),false);
  assert.equal(pkg.includes('question-groups.test.mjs'),false);
  assert.ok(fs.existsSync(path.join(root,'tests/part-template-a1-listening.test.mjs')));
  assert.ok(fs.existsSync(path.join(root,'tests/migrations.test.mjs')));
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
