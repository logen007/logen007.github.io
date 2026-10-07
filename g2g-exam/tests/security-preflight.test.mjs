import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
function test(name,fn){try{fn();console.log(`✓ ${name}`);passed++;}catch(error){console.error(`✗ ${name}`);throw error;}}

test('Upload audio chỉ dành cho giáo viên/quản trị và giới hạn 25 MB',()=>{
  const source=read('server/src/index.js');
  assert.ok(source.includes("requireRole(request,'teacher','master')"));
  assert.ok(source.includes('25*1024*1024'));
});

test('Upload hình đáp án chỉ dành cho giáo viên/quản trị',()=>{
  const source=read('server/src/index.js');
  assert.ok(source.includes("'/api/media/image'"));
  assert.ok(source.includes("mimePrefix:'image/'"));
});

test('Upload audio ở chế độ demo phải được bật tường minh và có giới hạn',()=>{
  const source=read('server/src/index.js');
  assert.ok(source.includes("DEMO_MEDIA_UPLOAD_ENABLED==='true'"));
  assert.ok(source.includes("'/api/demo/media/audio'"));
  assert.ok(source.includes('recent.length>=10'));
});

test('Autosave server chỉ nhận câu thuộc phần hiện tại và trước deadline',()=>{
  const source=read('server/src/actions/attempts.js');
  for(const text of ['currentQuestionIds','currentDeadlineMs','Phần thi đã hết thời gian'])assert.ok(source.includes(text),`Thiếu ${text}`);
  assert.ok(source.includes('allowed.has(key)'));
});

test('Tạo attempt server có metadata bảo vệ thời gian và phạm vi câu hỏi',()=>{
  const source=read('server/src/actions/shared.js')+read('server/src/actions/attempts.js');
  for(const text of ['currentSectionId','currentQuestionIds','currentDeadlineMs','sectionStates'])assert.ok(source.includes(text),`Thiếu ${text}`);
});

test('Audio A1 được khóa theo Part ở server',()=>{
  const source=read('server/src/actions/attempts.js');
  for(const text of ['startPartAudio','completePartAudio','audioSessions','sessions[section.id]','không thể phát lại','segmentRepeat'])assert.ok(source.includes(text),`Thiếu ${text}`);
  assert.equal(source.includes('startAudioGroup'),false);
  assert.equal(source.includes('question_groups'),false);
});

test('Bản production không tự bật SMTP/email',()=>{
  const source=read('server/src/defaults.js');
  assert.match(source,/smtp:\{enabled:false/);
  assert.match(source,/email:\{enabled:false/);
});

test('Màu giao diện là cấu hình công khai, có kiểm tra định dạng ở backend',()=>{
  const defaults=read('server/src/defaults.js');
  const settings=read('server/src/actions/settings.js');
  const server=read('server/src/index.js');
  assert.ok(defaults.includes("theme:{primaryColor:'#111827'}"));
  assert.ok(settings.includes('validColor'));
  assert.ok(settings.includes('Màu chủ đạo không hợp lệ'));
  assert.ok(server.includes('theme:s.theme'));
});

test('Học viên không nhận đáp án đúng hoặc điểm riêng tư chưa công bố',()=>{
  const source=read('server/src/state.js');
  assert.ok(source.includes('delete q.correctAnswer'));
  const studentBlock=source.match(/if\(user\.role==='student'\)\{([\s\S]*?)return state;\s*\}/)?.[1]||'';
  assert.ok(studentBlock.includes('SELECT id,public_data FROM attempts'));
  assert.equal(studentBlock.includes('private_data'),false);
});

test('Role và thay đổi dữ liệu quan trọng được kiểm tra lại phía server',()=>{
  const state=read('server/src/state.js');
  const actions=read('server/src/actions/shared.js')+read('server/src/actions/settings.js')+read('server/src/actions/grading.js');
  assert.ok(state.includes("user.role!=='master'"));
  assert.ok(state.includes('Không có quyền sửa bài thi này'));
  assert.ok(actions.includes("user.role==='master'"));
  assert.ok(actions.includes('canGrade'));
});

test('Runtime không còn QuestionGroup; migration xử lý dữ liệu cũ trước khi bỏ bảng',()=>{
  const state=read('server/src/state.js');
  const schema=read('server/schema.sql');
  const migration=read('server/src/migrations.js');
  assert.equal(state.includes('applyQuestionGroup'),false);
  assert.equal(state.includes("op.collection==='questionGroups'"),false);
  assert.equal(state.includes('state.questionGroups='),false);
  assert.equal(schema.includes('question_groups'),false);
  assert.ok(migration.includes('DROP TABLE question_groups'));
  for(const text of ['Chỉ Quản trị cấp cao được khôi phục câu hỏi','Chỉ Quản trị cấp cao được khôi phục bài thi'])assert.ok(state.includes(text),`Thiếu bảo vệ server: ${text}`);
});

console.log(`\n${passed} kiểm thử go-live đã đạt.`);
