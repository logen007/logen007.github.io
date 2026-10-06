import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0;
const test=(name,fn)=>{fn();console.log(`✓ ${name}`);passed++;};

test('Có backend VPS, schema PostgreSQL và Docker deployment',()=>{
  for(const p of ['server/src/index.js','server/src/auth.js','server/src/actions.js','server/src/actions/attempts.js','server/src/actions/grading.js','server/src/actions/settings.js','server/src/state.js','server/src/mail.js','server/schema.sql','server/Dockerfile','docker-compose.vps.yml','DEPLOY-VPS.md']){
    assert.ok(exists(p),`Thiếu ${p}`);
  }
});

test('PostgreSQL có các bảng vận hành cốt lõi',()=>{
  const sql=read('server/schema.sql');
  for(const table of ['users','questions','exams','attempts','grading_requests','notifications','settings','secrets','audit_log']){
    assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('Google Login chạy server-side và session dùng cookie ký',()=>{
  const source=read('server/src/auth.js');
  assert.ok(source.includes('GOOGLE_CLIENT_SECRET'));
  assert.ok(source.includes('httpOnly:true'));
  assert.ok(source.includes('signed:true'));
  assert.ok(source.includes('verifyIdToken'));
});

test('SMTP password được mã hóa phía server và không có trong frontend',()=>{
  const mail=read('server/src/mail.js');
  const frontend=[
    'src/repository.js','src/repositories/api.js','src/settings.js','src/settings/api.js','src/media.js','server/runtime/runtime-config.js'
  ].map(read).join('\n');
  assert.ok(mail.includes('aes-256-gcm'));
  assert.ok(mail.includes('SETTINGS_ENCRYPTION_KEY'));
  assert.equal(frontend.includes('GOOGLE_CLIENT_SECRET'),false);
  assert.equal(frontend.includes('SETTINGS_ENCRYPTION_KEY'),false);
});

test('Runtime VPS dùng REST API cùng origin',()=>{
  const repository=read('src/repositories/api.js');
  const config=read('server/runtime/runtime-config.js');
  assert.ok(repository.includes("this.mode='api'"));
  assert.ok(repository.includes("this.call('startAttemptSecure'"));
  assert.ok(repository.includes("this.call('saveAnswers'"));
  assert.ok(config.includes("G2G_API_BASE='/api'"));
});

test('Server kiểm tra deadline khi autosave',()=>{
  const actions=read('server/src/actions/attempts.js');
  assert.ok(actions.includes('currentDeadlineMs'));
  assert.ok(actions.includes('Phần thi đã hết thời gian'));
  assert.ok(actions.includes('currentQuestionIds'));
});

test('Upload audio chỉ dành cho teacher/master và tối đa 25MB',()=>{
  const source=read('server/src/index.js');
  assert.ok(source.includes("requireRole(request,'teacher','master')"));
  assert.ok(source.includes('25*1024*1024'));
});

test('Compose chỉ publish app vào loopback khi không dùng Traefik',()=>{
  const compose=read('docker-compose.vps.yml');
  assert.ok(compose.includes('127.0.0.1:8787:8080'));
  assert.ok(compose.includes('postgres:16-alpine'));
});

test('Production Docker dùng source modules trực tiếp, không overlay runtime logic',()=>{
  const dockerfile=read('server/Dockerfile');
  assert.ok(dockerfile.includes('COPY src /app/public/src'));
  assert.ok(dockerfile.includes('server/runtime/runtime-config.js'));
  assert.equal(dockerfile.includes('server/runtime/repository.js'),false);
  assert.equal(dockerfile.includes('sed -i'),false);
});

test('Auto-deploy gọi shell rõ ràng, không phụ thuộc quyền thực thi của checkout',()=>{
  const installer=read('server/install-auto-deploy.sh');
  assert.ok(installer.includes('ExecStart=/bin/sh $APP_DIR/server/auto-deploy.sh'));
});

console.log(`\n${passed} kiểm thử VPS đã đạt.`);
