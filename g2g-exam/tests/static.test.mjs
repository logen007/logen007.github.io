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

test('Trang Quản trị có Cài đặt cho Google Login, email và vận hành', () => {
  const html = read('vi.html');
  const source = read('src/settings.js');
  assert.match(html, /src=["']\.\/src\/settings\.js/);
  for (const text of ['Cài đặt hệ thống','Thông tin hệ thống','Đăng nhập bằng Google','Gửi email kết quả','Quyền làm bài','Vận hành / bảo trì','Kết nối hạ tầng']) {
    assert.ok(source.includes(text), `Thiếu nội dung Cài đặt: ${text}`);
  }
  for (const text of ['settingGoogleLogin','settingAllowNewStudents','settingSenderEmail','settingReplyTo','settingEmailSubject','settingEmailBody','sendTestEmail']) {
    assert.ok(source.includes(text), `Thiếu điều khiển Cài đặt: ${text}`);
  }
});

test('Cài đặt production chỉ được ghi qua backend của Quản trị cấp cao', () => {
  const fn = read('functions/settings.js');
  const rules = read('firestore.rules');
  assert.ok(fn.includes("user.role!=='master'"));
  assert.ok(fn.includes('update_system_settings'));
  assert.ok(fn.includes('sendTestEmail'));
  assert.match(rules, /match \/settings\/\{id\}/);
  assert.match(rules, /match \/settings\/\{id\}[\s\S]*?allow write: if false;/);
});

test('Đăng ký học viên mới tuân theo Google Login và cài đặt đăng ký', () => {
  const rules = read('firestore.rules');
  assert.ok(rules.includes('registrationAllowed'));
  assert.ok(rules.includes('googleLoginEnabled'));
  assert.ok(rules.includes('allowNewStudents'));
});

test('Backend công bố kết quả dùng cấu hình email mới và giữ tương thích dữ liệu cũ', () => {
  const source = read('functions/concurrency.js');
  for (const text of ['maintenanceMode','allowRetake','allowRestart','email.enabled','email.resultSubject','email.resultBody','senderEmail','replyTo','notifyResultEmail']) {
    assert.ok(source.includes(text), `Backend chưa dùng setting: ${text}`);
  }
});

test('Secret không được đặt trong cấu hình giao diện', () => {
  const source = read('src/settings.js');
  assert.equal(/clientSecret\s*[:=]/i.test(source), false);
  assert.equal(/smtpPassword\s*[:=]/i.test(source), false);
  assert.equal(/serviceAccount\s*[:=]/i.test(source), false);
  assert.ok(source.includes('Secret Manager'));
});

test('Trang có trình xử lý lỗi runtime để tránh màn hình trắng', () => {
  const html = read('vi.html');
  assert.ok(html.includes('window.addEventListener'));
  assert.ok(html.includes('Hệ thống chưa tải được'));
  assert.ok(html.includes('Tải lại'));
});

console.log(`\n${passed} kiểm thử tĩnh đã đạt.`);
