import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const existsNonEmpty=p=>fs.existsSync(path.join(root,p))&&fs.statSync(path.join(root,p)).size>0;
const jsTree=dir=>{
  const files=[];
  const walk=current=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const full=path.join(current,entry.name);
      if(entry.isDirectory())walk(full);
      else if(entry.isFile()&&entry.name.endsWith('.js'))files.push(fs.readFileSync(full,'utf8'));
    }
  };
  walk(path.join(root,dir));
  return files.join('\n');
};
let passed=0;
function test(name,fn){try{fn();console.log(`✓ ${name}`);passed++;}catch(error){console.error(`✗ ${name}`);throw error;}}

test('Trang tiếng Việt có vùng ứng dụng và nạp module chính',()=>{
  const html=read('vi.html');
  assert.match(html,/id=["']app["']/);
  assert.match(html,/runtime-config\.js/);
  assert.match(html,/type=["']module["'][^>]+src=["']\.\/src\/app\.js/);
  assert.match(html,/type=["']module["'][^>]+src=["']\.\/src\/feature-loader\.js/);
});

test('Các tài nguyên CSS/JS mà vi.html tham chiếu đều tồn tại và không rỗng',()=>{
  const html=read('vi.html');
  const refs=[...html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)/g)].map(match=>match[1]);
  assert.ok(refs.length>=4);
  for(const ref of refs)assert.ok(existsNonEmpty(ref),`Thiếu hoặc rỗng: ${ref}`);
});

test('Chuỗi import tương đối của frontend không trỏ tới file thiếu',()=>{
  const seen=new Set();
  const visit=rel=>{
    if(seen.has(rel))return;
    seen.add(rel);
    const full=path.join(root,rel);
    assert.ok(fs.existsSync(full),`Thiếu module: ${rel}`);
    const source=fs.readFileSync(full,'utf8');
    assert.ok(source.trim().length>0,`Module rỗng: ${rel}`);
    for(const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["'](\.\.?\/[^"']+)["']/g)){
      let next=path.normalize(path.join(path.dirname(rel),match[1]));
      if(!path.extname(next))next+='.js';
      visit(next);
    }
  };
  visit('src/app.js');
  visit('src/settings.js');
  visit('src/feature-loader.js');
});

test('Giao diện modular vẫn có đủ nhãn tiếng Việt quan trọng',()=>{
  const source=jsTree('src');
  for(const text of ['Tạo câu hỏi trực tiếp trong phần này.','Bài thi','Chấm bài','Bảng điểm','Xem toàn bộ kết quả','Đang chờ kết quả']){
    assert.ok(source.includes(text),`Thiếu nhãn tiếng Việt: ${text}`);
  }
});

test('Tạo câu hỏi trong phần không hiển thị bộ chọn loại câu',()=>{
  const styles=read('styles.css');
  const app=read('src/app.js');
  assert.ok(styles.includes('#qType'));
  assert.ok(app.includes('question-profile-row'));
});

test('Tổng điểm kỹ năng đọc đúng thuộc tính data-skill-total',()=>{
  const builder=read('src/part-templates/default/builder.js');
  assert.ok(builder.includes('total.dataset.skillTotal'));
  assert.equal(builder.includes('total.dataset.skill)'),false);
});

test('Không còn thông báo Firebase cũ trong giao diện production',()=>{
  const source=jsTree('src')+read('vi.html');
  assert.equal(source.includes('Chưa cấu hình Firebase'),false);
  assert.equal(source.includes('G2G_FIREBASE_CONFIG'),false);
  for(const text of ['Question Bank','Exam Builder','Save Draft','Publish Result'])assert.equal(source.includes(text),false,`Còn nhãn tiếng Anh: ${text}`);
});

test('Trang Quản trị có module Cài đặt Google, SMTP, email và vận hành',()=>{
  const html=read('vi.html');
  const loader=read('src/feature-loader.js');
  const controller=read('src/settings.js');
  const view=read('src/settings/view.js');
  const api=read('src/settings/api.js');
  assert.match(html,/src=["']\.\/src\/feature-loader\.js/);
  assert.ok(loader.includes("load('./settings.js')"));
  for(const text of ['Cài đặt hệ thống','Thông tin hệ thống','Đăng nhập Google','Máy chủ SMTP','Email kết quả','Quyền làm bài','Vận hành / bảo trì']){
    assert.ok(view.includes(text),`Thiếu nội dung Cài đặt: ${text}`);
  }
  for(const text of ['updateSystemSettings','updateSmtpSecret','testSmtp'])assert.ok(api.includes(text),`Thiếu API Cài đặt: ${text}`);
  assert.ok(controller.includes('loadPrivateSettings'));
});

test('Cấu hình production chỉ ghi qua REST backend của Master',()=>{
  const frontend=read('src/settings/api.js');
  const backend=read('server/src/actions/settings.js');
  assert.ok(frontend.includes('/actions/updateSystemSettings'));
  assert.ok(frontend.includes('/actions/updateSmtpSecret'));
  assert.ok(backend.includes("user.role!=='master'"));
  assert.ok(backend.includes('update_system_settings'));
});

test('Runtime có API repository và hỗ trợ demo bypass tạm thời',()=>{
  const repository=read('src/repository.js');
  const api=read('src/repositories/api.js');
  const runtime=read('server/runtime/runtime-config.js');
  const demo=read('src/demo-bypass.js');
  assert.ok(repository.includes('new ApiRepository()'));
  assert.ok(repository.includes('G2G_DEMO_BYPASS'));
  assert.ok(api.includes("this.mode='api'"));
  assert.ok(api.includes("this.call('startAttemptSecure'"));
  assert.ok(runtime.includes("G2G_API_BASE='/api'"));
  assert.ok(demo.includes('G2G_DEMO_BYPASS=true'));
});

test('Secret SMTP không được đưa xuống frontend',()=>{
  const frontend=jsTree('src');
  const mail=read('server/src/mail.js');
  assert.equal(frontend.includes('SETTINGS_ENCRYPTION_KEY'),false);
  assert.equal(frontend.includes('GOOGLE_CLIENT_SECRET'),false);
  assert.ok(mail.includes('SETTINGS_ENCRYPTION_KEY'));
  assert.ok(mail.includes('aes-256-gcm'));
});

test('Trang có trình xử lý lỗi runtime để tránh màn hình trắng',()=>{
  const html=read('vi.html');
  assert.ok(html.includes('window.addEventListener'));
  assert.ok(html.includes('Hệ thống chưa tải được'));
  assert.ok(html.includes('Tải lại'));
});

console.log(`\n${passed} kiểm thử tĩnh đã đạt.`);
