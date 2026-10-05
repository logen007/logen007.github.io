import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const existsNonEmpty = p => fs.existsSync(path.join(root, p)) && fs.statSync(path.join(root, p)).size > 0;
let passed = 0;
function test(name, fn){
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

test('Trang tiếng Việt có vùng ứng dụng và nạp module chính', () => {
  const html = read('vi.html');
  assert.match(html, /id=["']app["']/);
  assert.match(html, /type=["']module["'][^>]+src=["']\.\/src\/app\.js/);
});

test('Các tài nguyên CSS/JS mà vi.html tham chiếu đều tồn tại và không rỗng', () => {
  const html = read('vi.html');
  const refs = [...html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)/g)].map(m => m[1]);
  assert.ok(refs.length >= 4);
  for (const ref of refs) assert.ok(existsNonEmpty(ref), `Thiếu hoặc rỗng: ${ref}`);
});

test('Chuỗi import tương đối của các module giao diện không trỏ tới file thiếu', () => {
  const seen = new Set();
  const visit = rel => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `Thiếu module: ${rel}`);
    const source = fs.readFileSync(full, 'utf8');
    assert.ok(source.trim().length > 0, `Module rỗng: ${rel}`);
    for (const m of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["'](\.\.?\/[^"']+)["']/g)) {
      let next = path.normalize(path.join(path.dirname(rel), m[1]));
      if (!path.extname(next)) next += '.js';
      visit(next);
    }
  };
  visit('src/app.js');
  visit('src/settings.js');
});

test('Giao diện chính dùng nhãn tiếng Việt ở các khu vực vận hành quan trọng', () => {
  const source = read('src/app.js');
  for (const text of ['Ngân hàng câu hỏi','Tạo câu hỏi','Bài thi','Chấm bài','Bảng điểm','Xem toàn bộ kết quả','Đang chờ kết quả']) {
    assert.ok(source.includes(text), `Thiếu nhãn tiếng Việt: ${text}`);
  }
});

test('Không còn các nhãn tiếng Anh cũ dễ lọt ra giao diện', () => {
  const source = read('src/app.js');
  for (const text of ['Question Bank','Exam Builder','Save Draft','Publish Result','Previous','Next']) {
    assert.equal(source.includes(text), false, `Còn nhãn tiếng Anh: ${text}`);
  }
});

test('Trang Quản trị có đầy đủ Cài đặt Google, SMTP, email và vận hành', () => {
  const html = read('vi.html');
  const source = read('src/settings.js');
  assert.match(html, /src=["']\.\/src\/settings\.js/);
  for (const text of ['Cài đặt hệ thống','Thông tin hệ thống','Đăng nhập Google','Máy chủ gửi thư SMTP','Email kết quả','Quyền làm bài','Vận hành và bảo trì','Kết nối hạ tầng']) {
    assert.ok(source.includes(text), `Thiếu nội dung Cài đặt: ${text}`);
  }
  for (const text of ['settingGoogleLogin','settingAllowNewStudents','settingAllowedDomain','settingSmtpHost','settingSmtpPort','settingSmtpSecurity','settingSmtpUsername','settingSmtpPassword','settingSmtpFromEmail','settingSmtpReplyTo','settingEmailSubject','settingEmailText','settingEmailHtml','testSmtp']) {
    assert.ok(source.includes(text), `Thiếu điều khiển Cài đặt: ${text}`);
  }
});

test('Cài đặt production chỉ được ghi qua backend của Quản trị cấp cao', () => {
  const fn = read('functions/settings.js');
  const rules = read('firestore.rules');
  assert.ok(fn.includes("user.role!=='master'"));
  assert.ok(fn.includes('update_system_settings'));
  assert.match(rules, /match \/settings\/\{id\}/);
  assert.match(rules, /match \/settings\/\{id\}[\s\S]*?allow write: if false;/);
});

test('Đăng ký học viên mới tuân theo cấu hình đăng nhập Google', () => {
  const rules = read('firestore.rules');
  const repository = read('src/repository.js');
  for (const text of ['googleLoginEnabled','allowNewStudents','signupDomainAllowed','allowedDomain']) assert.ok(rules.includes(text), `Rules thiếu: ${text}`);
  for (const text of ['googleLoginEnabled','allowNewStudents','allowedDomain']) assert.ok(repository.includes(text), `Repository thiếu: ${text}`);
  assert.match(rules, /match \/publicSettings\/\{id\}/);
});

test('SMTP dùng Secret Manager và Nodemailer, không dùng hàng đợi mail cũ', () => {
  const mailer = read('functions/mailer.js');
  const concurrency = read('functions/concurrency.js');
  const pkg = JSON.parse(read('functions/package.json'));
  assert.ok(mailer.includes('SecretManagerServiceClient'));
  assert.ok(mailer.includes("SMTP_SECRET_ID = 'SMTP_PASSWORD'"));
  assert.ok(mailer.includes('updateSmtpSecret'));
  assert.ok(mailer.includes('testSmtp'));
  assert.ok(mailer.includes('nodemailer'));
  assert.ok(pkg.dependencies.nodemailer);
  assert.ok(pkg.dependencies['@google-cloud/secret-manager']);
  assert.ok(concurrency.includes('sendConfiguredEmail'));
  assert.equal(concurrency.includes("collection('mail')"), false);
});

test('Công bố kết quả giữ trạng thái email idempotent và có thể gửi lại', () => {
  const source = read('functions/concurrency.js');
  for (const text of ['deliverResultEmail','queued','sending','sent','failed','retryResultEmail','alreadyPublished']) assert.ok(source.includes(text), `Thiếu trạng thái email: ${text}`);
});

test('Secret SMTP không nằm trong document Cài đặt', () => {
  const backend = read('functions/settings.js');
  const frontend = read('src/settings.js');
  assert.equal(/smtp:\s*\{[^}]*password\s*:/is.test(backend), false);
  assert.equal(/smtp:\s*\{[^}]*password\s*:/is.test(frontend), false);
  assert.ok(frontend.includes('Secret Manager'));
});

test('Trang có trình xử lý lỗi runtime để tránh màn hình trắng', () => {
  const html = read('vi.html');
  assert.ok(html.includes('window.addEventListener'));
  assert.ok(html.includes('Hệ thống chưa tải được'));
  assert.ok(html.includes('Tải lại'));
});

console.log(`\n${passed} kiểm thử tĩnh đã đạt.`);
