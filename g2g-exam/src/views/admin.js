import {
  ATTEMPT_STATUS,byId,isMaster,canEditExam,gradebookRows
} from '../core.js';
import {esc,fmtDate,statusClass,statusText} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';

export function adminShellHtml({content}){
  return `<div class="khung-quan-tri"><main class="noi-dung-quan-tri">${content}</main></div>`;
}

const bytes=value=>{const size=Math.max(0,Number(value)||0),units=['B','KB','MB','GB','TB'];let index=0,current=size;while(current>=1024&&index<units.length-1){current/=1024;index++;}return `${current>=10||index===0?Math.round(current):current.toFixed(1)} ${units[index]}`;};
const compactBytes=value=>bytes(value).replace(/\s+/g,'');
const compactPair=(used,total)=>`${bytes(used).replace(/\s*[A-Z]+$/,'')}/${compactBytes(total)}`;

export function dashboardHtml({data,infrastructure=null}){
  const students=data.users.filter(u=>u.role==='student'),teachers=data.users.filter(u=>u.role==='teacher');
  const exams=data.exams.filter(ex=>ex.status!=='trash');
  const pending=data.attempts.filter(a=>[ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(a.status));
  const published=data.attempts.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const months=Array.from({length:6},(_,index)=>{const date=new Date();date.setDate(1);date.setMonth(date.getMonth()+index-5);return {key:date.toISOString().slice(0,7),label:`${date.getMonth()+1}/${date.getFullYear()}`};});
  const studentBars=months.map(month=>({...month,count:students.filter(u=>String(u.createdAt||'').startsWith(month.key)).length}));
  const biggest=Math.max(1,...studentBars.map(item=>item.count));
  const graders=teachers.map(t=>({name:t.name,picture:t.picture||'',count:published.filter(a=>a.reviewerId===t.id).length})).sort((a,b)=>b.count-a.count);
  const graderHtml=item=>{const initials=String(item.name||'GV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();return `<div class="dashboard-row"><span class="dashboard-person"><span class="dashboard-avatar">${item.picture?`<img src="${esc(item.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span>${esc(item.name)}</span><b>${item.count} bài</b></div>`;};
  const types=Object.entries(exams.reduce((out,ex)=>{const key=[ex.provider,ex.level].filter(Boolean).join(' ')||'Khác';out[key]=(out[key]||0)+1;return out;},{})).sort((a,b)=>b[1]-a[1]);
  const resources=infrastructure?.resources,disk=resources?.disk,usage=resources?.usage||{},tables=resources?.databaseTables||{},examStorage=infrastructure?.examStorage||[];
  const gc=resources?.mediaGarbageCollection||{};
  const gcText=gc.error?`Lỗi lần quét gần nhất: ${esc(gc.error)}`:gc.lastSuccessAt?`Quét gần nhất ${new Date(gc.lastSuccessAt).toLocaleString('vi-VN')} · đã dọn ${gc.deleted||0} tệp (${bytes(gc.deletedBytes||0)})`:'Đang chờ lượt quét đầu tiên';
  const infrastructureHtml=!infrastructure?'<section class="the dashboard-infrastructure"><h2>Tài nguyên hệ thống</h2><p class="phu-de">Đang tải…</p></section>':`<section class="the dashboard-infrastructure"><h2>Tài nguyên hệ thống</h2><div class="resource-grid"><div><span>CPU</span><b>${resources.cpu.loadPercent}%</b></div><div><span>RAM</span><b>${compactPair(resources.memory.usedBytes,resources.memory.totalBytes)}</b></div><div><span>Disk</span><b>${disk?`${compactPair(disk.usedBytes,disk.totalBytes)}`:'—'}</b></div><div><span>Data</span><b>${compactBytes((usage.databaseBytes||0)+(usage.uploadsBytes||0)+(usage.applicationBytes||0))}</b></div><div><span>Dọn Rác</span><b>${gc.deletedBytes?compactBytes(gc.deletedBytes):gc.error?'Lỗi':'Sạch'}</b><small>${gcText}</small></div></div><div class="resource-breakdown"><div class="dashboard-row"><span>PostgreSQL</span><b>${bytes(usage.databaseBytes)}</b></div><div class="dashboard-row"><span>Audio, hình ảnh tải lên</span><b>${bytes(usage.uploadsBytes)}</b></div><div class="dashboard-row"><span>Mã nguồn</span><b>${bytes(usage.applicationBytes)}</b></div><div class="dashboard-row"><span>Bài làm</span><b>${bytes(tables.attempts)}</b></div><div class="dashboard-row"><span>Câu hỏi</span><b>${bytes(tables.questions)}</b></div><div class="dashboard-row"><span>Nhật ký</span><b>${bytes(tables.audit_log)}</b></div></div></section><section class="the dashboard-exam-storage"><h2>Dung lượng từng đề thi</h2><p class="phu-de">Gồm cấu trúc đề, câu hỏi và các tệp media được đề sử dụng.</p><div class="table-wrap"><table class="bang"><thead><tr><th>Đề thi</th><th>Câu</th><th>Media</th><th>Dữ liệu</th><th>Tổng</th></tr></thead><tbody>${examStorage.map(item=>`<tr><td><b>${esc(item.title)}</b><span class="phu">${esc([item.provider,item.level].filter(Boolean).join(' '))}</span></td><td>${item.questions}</td><td>${item.mediaFiles} tệp · ${bytes(item.mediaBytes)}</td><td>${bytes(item.dataBytes)}</td><td><b>${bytes(item.totalBytes)}</b></td></tr>`).join('')||'<tr><td colspan="5" class="rong">Chưa có đề thi.</td></tr>'}</tbody></table></div></section>`;
  return `<div class="tieu-de-trang"><h1>Tổng quan</h1></div><div class="hang-thong-ke dashboard-stats"><div class="thong-ke"><span>Học viên</span><b>${students.length}</b></div><div class="thong-ke"><span>Giáo viên</span><b>${teachers.length}</b></div><div class="thong-ke"><span>Bộ đề</span><b>${exams.length}</b></div><div class="thong-ke"><span>Bài cần chấm</span><b>${pending.length}</b></div></div><div class="dashboard-grid"><section class="the"><h2>Học viên mới · 6 tháng</h2><div class="dashboard-bars">${studentBars.map(item=>`<div><b>${item.count}</b><span style="height:${Math.max(4,item.count/biggest*100)}%"></span><small>${item.label}</small></div>`).join('')}</div></section><section class="the"><h2>Loại đề hiện có</h2>${types.map(([name,count])=>`<div class="dashboard-row"><span>${esc(name)}</span><b>${count}</b></div>`).join('')||'<p>Chưa có bộ đề.</p>'}<h2>Giáo viên chấm nhiều nhất</h2>${graders.slice(0,5).map(graderHtml).join('')||'<p>Chưa có giáo viên.</p>'}</section></div>${infrastructureHtml}`;
}

export function examAdminHtml({data,user}){
  const exams=data.exams.filter(x=>x.status!=='trash');
  return `<div class="tieu-de-trang"><div><h1>Bài thi</h1></div><button class="nut chinh" data-action="new-exam">+ Tạo bài thi</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Loại đề</th><th>Người tạo</th><th>Lượt thi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${exams.map(ex=>{const own=canEditExam(user,ex),attempts=data.attempts.filter(a=>a.examId===ex.id&&a.status!=='abandoned').length;return `<tr><td><button class="table-link" data-action="edit-exam" data-id="${esc(ex.id)}">${esc(ex.title)}</button></td><td>${esc([ex.provider,ex.level].filter(Boolean).join(' ')||ex.level)}</td><td>${esc(ex.ownerName)}</td><td>${attempts}</td><td><span class="nhan ${ex.status==='published'?'xanh':'xam'}">${ex.status==='published'?'Đã xuất bản':'Bản nháp'}</span></td><td><div class="hanh-dong-bang">${own&&ex.status!=='published'?`<button class="nut nho chinh" data-action="publish-exam" data-id="${esc(ex.id)}">Xuất bản</button>`:''}<button class="icon-btn" data-action="duplicate-exam" data-id="${esc(ex.id)}" aria-label="Nhân bản ${esc(ex.title)}" title="Nhân bản">${iconHtml('copy')}</button>${own?`<button class="icon-btn" data-action="delete-exam" data-id="${esc(ex.id)}" aria-label="Xóa ${esc(ex.title)}" title="Xóa">${iconHtml('trash')}</button>`:''}</div></td></tr>`;}).join('')}</tbody></table></div>`;
}

export function gradingAdminHtml({data,user}){
  const attempts=data.attempts.filter(a=>[ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY,ATTEMPT_STATUS.PUBLISHED].includes(a.status)).sort((a,b)=>String(b.submittedAt||b.startedAt).localeCompare(String(a.submittedAt||a.startedAt)));
  const pending=attempts.filter(a=>a.status!==ATTEMPT_STATUS.PUBLISHED).length,done=attempts.length-pending;
  return `<div class="tieu-de-trang"><h1>Chấm bài</h1></div><div class="hang-thong-ke"><div class="thong-ke"><span>Cần chấm</span><b>${pending}</b></div><div class="thong-ke"><span>Đã chấm</span><b>${done}</b></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Thời gian nộp</th><th>Lần thi</th><th>Điểm</th><th>Người chấm</th><th>Trạng thái</th><th></th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.studentName)}</b><span class="phu">${esc(a.studentEmail)}</span></td><td>${esc(a.examTitle)}</td><td>${fmtDate(a.submittedAt)}</td><td>#${a.attemptNo}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?a.totalScore??'—':a.autoScore??'—'}</td><td>${esc(a.status===ATTEMPT_STATUS.PUBLISHED?a.reviewerName||'—':'—')}</td><td><span class="nhan ${statusClass(a.status)}">${a.status===ATTEMPT_STATUS.PUBLISHED?'Đã chấm':'Cần chấm'}</span></td><td><button class="nut nho ${a.status===ATTEMPT_STATUS.PUBLISHED?'':'chinh'}" data-action="grade-attempt" data-id="${esc(a.id)}">${a.status===ATTEMPT_STATUS.PUBLISHED?'Xem':'Chấm bài'}</button></td></tr>`).join('')||'<tr><td colspan="8" class="rong">Chưa có bài làm.</td></tr>'}</tbody></table></div>`;
}

export function gradesAdminHtml({data,ui}){
  if(ui.gradeMode==='all'){
    const attempts=data.attempts.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED).sort((a,b)=>String(b.publishedAt||b.startedAt).localeCompare(String(a.publishedAt||a.startedAt)));
    return `<div class="tieu-de-trang"><div><h1>Bảng điểm</h1><p>Toàn bộ các lần thi đã được công bố.</p></div></div>${gradeModeButtonsHtml(ui.gradeMode)}<div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Lần</th><th>Ngày</th><th>Tổng điểm</th><th>Kết quả</th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.studentName)}</b></td><td>${esc(a.examTitle)}</td><td>#${a.attemptNo}</td><td>${fmtDate(a.publishedAt||a.submittedAt)}</td><td><b>${a.totalScore??'—'}</b></td><td>${esc(a.result||'—')}</td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có kết quả đã công bố.</td></tr>'}</tbody></table></div>`;
  }
  const rows=gradebookRows(data,ui.gradeMode);
  return `<div class="tieu-de-trang"><div><h1>Bảng điểm</h1><p>Xem điểm cao nhất, điểm gần nhất hoặc toàn bộ lịch sử.</p></div></div>${gradeModeButtonsHtml(ui.gradeMode)}<div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Tổng điểm</th><th>Kết quả</th><th>Số lần thi</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.user.name)}</b><span class="phu">${esc(r.user.email)}</span></td><td>${esc(r.attempt?.examTitle||'—')}</td><td>${r.attempt?.totalScore??'—'}</td><td>${esc(r.attempt?.result||'—')}</td><td>${r.attempts.length}</td><td><button class="nut nho" data-action="student-grade-detail" data-id="${r.user.id}">Chi tiết</button></td></tr>`).join('')}</tbody></table></div>`;
}

export function gradeModeButtonsHtml(mode){
  return `<div class="nhom-nut" style="margin-bottom:14px"><button class="nut ${mode==='best'?'chinh':''}" data-action="grade-mode" data-mode="best">Điểm cao nhất</button><button class="nut ${mode==='latest'?'chinh':''}" data-action="grade-mode" data-mode="latest">Điểm gần nhất</button><button class="nut ${mode==='all'?'chinh':''}" data-action="grade-mode" data-mode="all">Tất cả lần thi</button></div>`;
}

export function teachersAdminHtml({data,user}){
  if(!isMaster(user))return '<div class="rong">Không có quyền.</div>';
  return `<div class="tieu-de-trang"><div><h1>Giáo viên & tài khoản</h1><p>Học viên cần đăng nhập Google ít nhất một lần trước khi được nâng quyền thành giáo viên.</p></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>${data.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${u.role==='master'?'Quản trị cấp cao':u.role==='teacher'?'Giáo viên':'Học viên'}</td><td>${u.id===user.id?'—':`<button class="nut nho" data-action="toggle-teacher" data-id="${u.id}">${u.role==='teacher'?'Chuyển về Học viên':'Đặt làm Giáo viên'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}

export function trashAdminHtml({data}){
  const exams=data.exams.filter(x=>x.status==='trash'),qs=data.questions.filter(x=>x.status==='trash');
  return `<div class="tieu-de-trang"><div><h1>Thùng rác</h1><p>Chỉ Quản trị cấp cao nhìn thấy và xóa vĩnh viễn. Dữ liệu đã có lịch sử thi sẽ được bảo vệ.</p></div></div><h3>Bài thi</h3>${trashTableHtml(exams,'exam')}<h3 style="margin-top:20px">Câu hỏi</h3>${trashTableHtml(qs,'question')}`;
}

export function trashTableHtml(items,type){
  return `<div class="table-wrap"><table class="bang"><tbody>${items.map(x=>`<tr><td><b>${esc(x.title)}</b></td><td>${esc(x.ownerName||'')}</td><td><div class="hanh-dong-bang"><button class="nut nho" data-action="restore-${type}" data-id="${x.id}">Khôi phục</button><button class="nut nho nguy" data-action="permanent-${type}" data-id="${x.id}">Xóa vĩnh viễn</button></div></td></tr>`).join('')||'<tr><td class="rong">Trống</td></tr>'}</tbody></table></div>`;
}
