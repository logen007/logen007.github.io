import {
  ATTEMPT_STATUS,byId,isMaster,isTeacher,canEditQuestion,canEditExam,getVisibleQuestions,
  pendingGradingAttempts,gradebookRows,summarizeExam
} from '../core.js';
import {esc,fmtDate,statusClass,statusText,typeLabel} from '../ui/format.js';

export function adminShellHtml({content,user,ui}){
  const tabs=[['exams','Bài thi'],['bank','Ngân hàng câu hỏi'],['grading','Chấm bài'],['grades','Bảng điểm'],...(isMaster(user)?[['teachers','Giáo viên'],['trash','Thùng rác']]:[])];
  return `<div class="khung-quan-tri"><aside class="thanh-ben">${tabs.map(([k,l])=>`<button class="muc-ben ${ui.adminTab===k?'active':''}" data-action="admin-tab" data-tab="${k}">${l}</button>`).join('')}</aside><main class="noi-dung-quan-tri">${content}</main></div>`;
}

export function examAdminHtml({data,user}){
  const exams=data.exams.filter(x=>x.status!=='trash');
  return `<div class="tieu-de-trang"><div><h1>Bài thi</h1><p>Giáo viên xem được bài của nhau; chỉ chủ bài hoặc Quản trị cấp cao được thay đổi.</p></div><button class="nut chinh" data-action="new-exam">+ Tạo bài thi</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Người tạo</th><th>Cấu trúc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${exams.map(ex=>{const s=summarizeExam(ex,data),own=canEditExam(user,ex),req=data.gradingRequests.find(r=>r.examId===ex.id&&r.requesterId===user.id&&r.status==='pending');return `<tr><td><b>${esc(ex.title)}</b><span class="phu">${esc(ex.level)} · phiên bản ${ex.version||1}${ex.locked?' · đã khóa cấu trúc':''}</span></td><td>${esc(ex.ownerName)}</td><td>${s.sections} phần · ${s.questions} câu</td><td><span class="nhan ${ex.status==='published'?'xanh':'xam'}">${ex.status==='published'?'Đã xuất bản':'Bản nháp'}</span></td><td><div class="hanh-dong-bang">${own?`<button class="nut nho" data-action="edit-exam" data-id="${ex.id}">${ex.locked&&!isMaster(user)?'Xem cấu trúc':'Chỉnh sửa'}</button>${ex.status!=='published'?`<button class="nut nho chinh" data-action="publish-exam" data-id="${ex.id}">Xuất bản</button>`:''}<button class="nut nho nguy" data-action="delete-exam" data-id="${ex.id}">Xóa</button>`:`<button class="nut nho" data-action="view-exam" data-id="${ex.id}">Xem</button>${isTeacher(user)&&!isMaster(user)?`<button class="nut nho" data-action="request-grade" data-id="${ex.id}" ${req?'disabled':''}>${req?'Đã xin chấm':'Xin chấm'}</button>`:''}`}</div></td></tr>`;}).join('')}</tbody></table></div>`;
}

export function bankAdminHtml({data,user}){
  const qs=getVisibleQuestions(data,user),skills=[...new Set(qs.map(q=>q.skill))].sort();
  return `<div class="tieu-de-trang"><div><h1>Ngân hàng câu hỏi</h1><p>Mọi giáo viên có thể xem và dùng lại. Chỉ chủ câu chưa khóa hoặc Quản trị cấp cao được sửa/xóa.</p></div><button class="nut chinh" data-action="new-question">+ Tạo câu hỏi</button></div><div class="hang-thong-ke"><div class="thong-ke"><span>Tổng câu</span><b>${qs.length}</b></div><div class="thong-ke"><span>Câu của tôi</span><b>${qs.filter(q=>q.ownerId===user.id).length}</b></div><div class="thong-ke"><span>Đã khóa</span><b>${qs.filter(q=>q.locked).length}</b></div><div class="thong-ke"><span>B1 / B2</span><b>${qs.filter(q=>q.level==='B1').length} / ${qs.filter(q=>q.level==='B2').length}</b></div></div><div class="bo-loc"><input class="truong tim" id="bankSearch" placeholder="Tìm mã hoặc tiêu đề..."><select class="truong" id="bankLevel"><option value="">Tất cả trình độ</option><option>B1</option><option>B2</option></select><select class="truong" id="bankSkill"><option value="">Tất cả kỹ năng</option>${skills.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="table-wrap"><table class="bang"><thead><tr><th>Mã</th><th>Câu hỏi</th><th>Phân loại</th><th>Người tạo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="bankRows">${questionRowsHtml(qs,user)}</tbody></table></div>`;
}

export function questionRowsHtml(qs,user){
  return qs.map(q=>`<tr data-search="${esc((q.code+' '+q.title).toLowerCase())}" data-level="${esc(q.level)}" data-skill="${esc(q.skill)}"><td><b>${esc(q.code)}</b></td><td><b>${esc(q.title)}</b><span class="phu">${typeLabel(q.type)}</span></td><td>${esc(q.level)} · ${esc(q.skill)}<span class="phu">${esc(q.part)}</span></td><td>${esc(q.ownerName)}</td><td><span class="nhan ${q.locked?'vang':'xam'}">${q.locked?'Đã khóa':'Có thể chỉnh sửa'}</span></td><td><div class="hanh-dong-bang">${canEditQuestion(user,q)?`<button class="nut nho" data-action="edit-question" data-id="${q.id}">Sửa</button><button class="nut nho nguy" data-action="delete-question" data-id="${q.id}">Xóa</button>`:`<button class="nut nho" data-action="preview-question" data-id="${q.id}">Xem</button>`}</div></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có câu hỏi.</td></tr>';
}

export function gradingAdminHtml({data,user}){
  const attempts=pendingGradingAttempts(data,user);
  const requests=data.gradingRequests.filter(r=>r.status==='pending'&&(isMaster(user)||byId(data.exams,r.examId)?.ownerId===user.id));
  return `<div class="tieu-de-trang"><div><h1>Chấm bài</h1><p>Bài đã nộp và đang chờ chấm thủ công.</p></div></div><div class="hang-thong-ke"><div class="thong-ke"><span>Chờ / đang chấm</span><b>${attempts.filter(a=>a.status===ATTEMPT_STATUS.GRADING).length}</b></div><div class="thong-ke"><span>Sẵn sàng công bố</span><b>${attempts.filter(a=>a.status===ATTEMPT_STATUS.READY).length}</b></div><div class="thong-ke"><span>Yêu cầu xin chấm</span><b>${requests.length}</b></div><div class="thong-ke"><span>Đã công bố</span><b>${data.attempts.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED).length}</b></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Lần</th><th>Điểm tự động</th><th>Trạng thái</th><th></th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.studentName)}</b><span class="phu">${esc(a.studentEmail)}</span></td><td>${esc(a.examTitle)}</td><td>#${a.attemptNo}</td><td>${a.autoScore??'—'}</td><td><span class="nhan ${statusClass(a.status)}">${statusText(a.status)}</span></td><td><button class="nut nho chinh" data-action="grade-attempt" data-id="${a.id}">${a.status===ATTEMPT_STATUS.READY?'Kiểm tra':'Chấm bài'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Không có bài nào cần chấm.</td></tr>'}</tbody></table></div>${requests.length?`<div class="the" style="margin-top:16px"><h3>Yêu cầu xin chấm bài</h3>${requests.map(r=>`<div class="cau-item"><div class="noi"><b>${esc(r.requesterName)} xin chấm ${esc(r.examTitle)}</b></div><div class="nhom-nut"><button class="nut nho chinh" data-action="resolve-request" data-id="${r.id}" data-status="approved">Duyệt</button><button class="nut nho" data-action="resolve-request" data-id="${r.id}" data-status="rejected">Từ chối</button></div></div>`).join('')}</div>`:''}`;
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
