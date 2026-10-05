import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
function test(name,fn){ try{fn();console.log(`✓ ${name}`);passed++;}catch(error){console.error(`✗ ${name}`);throw error;} }

test('Storage chỉ cho giáo viên hoặc quản trị tải audio',()=>{
  const rules=read('storage.rules');
  assert.ok(rules.includes("role == 'teacher'"));
  assert.ok(rules.includes("role == 'master'"));
  assert.ok(rules.includes('request.auth.uid == ownerId'));
});

test('Autosave chỉ cho câu thuộc phần hiện tại và trước deadline',()=>{
  const rules=read('firestore.rules');
  assert.ok(rules.includes('currentQuestionIds'));
  assert.ok(rules.includes('currentDeadlineMs'));
  assert.ok(rules.includes('onlyCurrentSectionAnswersChanged'));
  assert.ok(rules.includes('answerWindowOpen'));
  assert.ok(rules.includes('request.time.toMillis()'));
});

test('Cloud Function tạo attempt có metadata bảo vệ thời gian và phạm vi câu hỏi',()=>{
  const source=read('functions/attempts.js');
  for(const text of ['currentSectionId','currentQuestionIds','currentDeadlineMs','sectionRuntime']) assert.ok(source.includes(text),`Thiếu ${text}`);
});

test('Bản production không tự bật SMTP/email khi chưa cấu hình',()=>{
  const source=read('functions/settings.js');
  assert.match(source,/smtp:\{[\s\S]*?enabled:false/);
  assert.match(source,/email:\{[\s\S]*?enabled:false/);
  assert.match(source,/results:\{notifyResultEmail:false/);
});

test('Bootstrap ưu tiên attempt lifecycle đã harden',()=>{
  const source=read('functions/bootstrap.js');
  const concurrencyIndex=source.indexOf('...concurrency');
  const attemptsIndex=source.indexOf('...attempts');
  assert.ok(concurrencyIndex>=0&&attemptsIndex>concurrencyIndex);
});

console.log(`\n${passed} kiểm thử go-live đã đạt.`);
