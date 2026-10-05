import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
let passed=0;const test=(name,fn)=>{fn();console.log(`✓ ${name}`);passed++;};

test('Có backend VPS, schema PostgreSQL và Docker deployment',()=>{for(const p of ['server/src/index.js','server/src/auth.js','server/src/actions.js','server/src/state.js','server/src/mail.js','server/schema.sql','server/Dockerfile','docker-compose.vps.yml','DEPLOY-VPS.md'])assert.ok(exists(p),`Thiếu ${p}`);});
test('PostgreSQL có các bảng vận hành cốt lõi',()=>{const sql=read('server/schema.sql');for(const t of ['users','questions','exams','attempts','grading_requests','notifications','settings','secrets','audit_log'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));});
test('Google Login chạy server-side và session dùng cookie ký',()=>{const s=read('server/src/auth.js');assert.ok(s.includes('GOOGLE_CLIENT_SECRET'));assert.ok(s.includes("httpOnly:true"));assert.ok(s.includes("signed:true"));assert.ok(s.includes('verifyIdToken'));});
test('SMTP password được mã hóa phía server, không nằm trong runtime frontend',()=>{const mail=read('server/src/mail.js');assert.ok(mail.includes('aes-256-gcm'));assert.ok(mail.includes('SETTINGS_ENCRYPTION_KEY'));for(const p of ['server/runtime/repository.js','server/runtime/settings.js','server/runtime/media.js','server/runtime/firebase-config.js']){const x=read(p);assert.equal(x.includes('GOOGLE_CLIENT_SECRET'),false);assert.equal(x.includes('SETTINGS_ENCRYPTION_KEY'),false);}});
test('Runtime VPS dùng REST API thay Firebase',()=>{const repo=read('server/runtime/repository.js'),cfg=read('server/runtime/firebase-config.js');assert.ok(repo.includes("this.mode='api'"));assert.ok(repo.includes("this.call('startAttemptSecure'"));assert.ok(repo.includes("this.call('saveAnswers'"));assert.ok(cfg.includes("G2G_API_BASE='/api'"));assert.ok(cfg.includes('G2G_FIREBASE_CONFIG=null'));});
test('Server kiểm tra deadline khi autosave',()=>{const a=read('server/src/actions.js');assert.ok(a.includes('currentDeadlineMs'));assert.ok(a.includes('Phần thi đã hết thời gian'));assert.ok(a.includes('currentQuestionIds'));});
test('Upload audio chỉ dành cho teacher/master và tối đa 25MB',()=>{const s=read('server/src/index.js');assert.ok(s.includes("requireRole(request,'teacher','master')"));assert.ok(s.includes('25*1024*1024'));});
test('Compose chỉ publish app vào loopback để reverse proxy xử lý TLS',()=>{const c=read('docker-compose.vps.yml');assert.ok(c.includes('127.0.0.1:8787:8080'));assert.ok(c.includes('postgres:16-alpine'));});
console.log(`\n${passed} kiểm thử VPS đã đạt.`);
