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
  assert.ok(refs.length >= 3);
  for (const ref of refs) assert.ok(existsNonEmpty(ref), `Thiếu hoặc rỗng: ${ref}`);
});

test('Chuỗi import tương đối của module chính không trỏ tới file thiếu', () => {
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

test('Trang có trình xử lý lỗi runtime để tránh màn hình trắng', () => {
  const html = read('vi.html');
  assert.ok(html.includes('window.addEventListener'));
  assert.ok(html.includes('Có lỗi khi tải hệ thống'));
});

console.log(`\n${passed} kiểm thử tĩnh đã đạt.`);
