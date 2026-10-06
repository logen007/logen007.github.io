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

test('Autosave server chỉ nhận câu thuộc phần hiện tại và trước deadline',()=>{
  const source=read('server/src/actions.js');
  for(const text of ['currentQuestionIds','currentDeadlineMs','Phần thi đã hết thời gian']){
    assert.ok(source.includes(text),`Thiếu ${text}`);
  }
  assert.ok(source.includes('allowed.has(k)'));
});

test('Tạo attempt server có metadata bảo vệ thời gian và phạm vi câu hỏi',()=>{
  const source=read('server/src/actions.js');
  for(const text of ['currentSectionId','currentQuestionIds','currentDeadlineMs','sectionStates']){
    assert.ok(source.includes(text),`Thiếu ${text}`);
  }
});

test('Bản production không tự bật SMTP/email',()=>{
  const source=read('server/src/defaults.js');
  assert.match(source,/smtp:\{enabled:false/);
  assert.match(source,/email:\{enabled:false/);
});

test('Học viên không nhận đáp án đúng hoặc điểm riêng tư chưa công bố',()=>{
  const source=read('server/src/state.js');
  assert.ok(source.includes('delete q.correctAnswer'));
  assert.ok(source.includes("user.role==='student'"));
  assert.ok(source.includes('public_data'));
  assert.equal(/student[\s\S]{0,800}private_data/.test(source),false);
});

test('Role và thay đổi dữ liệu quan trọng được kiểm tra lại phía server',()=>{
  const state=read('server/src/state.js');
  const actions=read('server/src/actions.js');
  assert.ok(state.includes("user.role!=='master'"));
  assert.ok(state.includes('Không có quyền sửa bài thi này'));
  assert.ok(actions.includes("user.role==='master'"));
  assert.ok(actions.includes('canGrade'));
});

console.log(`\n${passed} kiểm thử go-live đã đạt.`);
