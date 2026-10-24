import {
  ATTEMPT_STATUS,isMaster,canEditExam
} from '../core.js';
import {textHtml,esc,fmtDate} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {hasApiBackend} from '../config.js';
import {speakingType,examTypeLabel} from '../speaking/catalog.js';

export function adminShellHtml({content}){
  return `<div class="khung-quan-tri"><main class="noi-dung-quan-tri">${content}</main></div>`;
}

export {dashboardHtml} from './dashboard.js';

export function examAdminHtml({data,user,filters={}}){
  const exams=data.exams.filter(x=>x.status!=='trash'&&(x.kind==='speaking'?'speaking':'written')===(filters.kind||'written')&&(!filters.provider||speakingType(x)===filters.provider)&&(!filters.level||x.level===filters.level));
  const picker=(key,label,values)=>`<label class="filter-field"><select aria-label="${esc(label)}" data-admin-exam-filter="${key}"><option value="">${esc(label)}</option>${values.map(value=>`<option value="${value}" ${filters[key]===value?'selected':''}>${esc(examTypeLabel(value))}</option>`).join('')}</select></label>`;
  const exportImages=isMaster(user)&&hasApiBackend()?'<button class="nut nho" data-action="sync-image-sheet">Đồng bộ ảnh</button>':'';
  return `<div class="tieu-de-trang exam-list-heading"><div><h1>Đề Thi</h1></div><div class="nhom-nut"><button class="nut chinh" data-action="new-exam">+ Tạo đề thi</button></div></div><div class="exam-filter"><button class="nut" data-action="toggle-exam-kind" aria-pressed="${filters.kind==='speaking'}">Kiểu đề: ${filters.kind==='speaking'?'Nói':'Viết'}</button>${picker('provider','Loại đề',['GOETHE','TELC','FID'])}${picker('level','Trình độ',['A1','A2','B1','B2','C1','C2'])}${exportImages}</div><div class="table-wrap"><table class="bang exam-catalog-table"><thead><tr><th>Đề thi</th><th>Loại đề</th><th>Người tạo</th><th>Lượt thi</th><th>Last edit</th><th>Thao tác</th></tr></thead><tbody>${exams.map(ex=>{const own=canEditExam(user,ex),attempts=ex.attemptCount??data.attempts.filter(a=>a.examId===ex.id&&a.status!=='abandoned').length;return `<tr data-ascii-key="exam-row:${esc(ex.id)}"><td><button class="table-link exam-title-status ${ex.status==='published'?'is-published':'is-draft'}" title="${esc(ex.title)} — ${ex.status==='published'?'Đã xuất bản':'Bản nháp'}" aria-label="${esc(ex.title)} — ${ex.status==='published'?'Đã xuất bản':'Bản nháp'}" data-action="edit-exam" data-id="${esc(ex.id)}" ${ex.kind==='speaking'&&!own?'disabled':''}>${textHtml(ex.title)}</button></td><td><div class="exam-card-tags"><span class="nhan exam-provider" data-provider="${esc(ex.provider||'')}">${esc(examTypeLabel(speakingType(ex))||'G2G')}</span> <span class="nhan exam-level" data-level="${esc(ex.level)}">${esc(ex.level)}</span></div></td><td>${esc(ex.ownerName)}</td><td>${attempts}</td><td class="exam-last-edit">${esc(fmtDate(ex.updatedAt||ex.createdAt))}</td><td><div class="hanh-dong-bang"><button class="icon-btn" ${ex.kind==='speaking'&&!own?'disabled':''} title="${ex.kind==='speaking'?'Mở đề':'Xem thử'}" aria-label="${ex.kind==='speaking'?'Mở đề':'Xem thử'} ${esc(ex.title)}" data-action="preview-exam" data-id="${esc(ex.id)}">${iconHtml('preview')}</button>${own&&ex.kind!=='speaking'?`<button class="icon-btn" title="Cài đặt đề" aria-label="Cài đặt đề" data-action="exam-access-settings" data-id="${esc(ex.id)}">${iconHtml('settings')}</button>`:''}<button class="icon-btn" ${ex.kind==='speaking'&&!own?'disabled':''} data-action="duplicate-exam" data-id="${esc(ex.id)}" aria-label="Nhân bản ${esc(ex.title)}" title="Nhân bản">${iconHtml('copy')}</button>${own?`<button class="icon-btn" data-action="delete-exam" data-id="${esc(ex.id)}" aria-label="Xóa ${esc(ex.title)}" title="Xóa">${iconHtml('trash')}</button>`:''}</div></td></tr>`;}).join('')}</tbody></table></div>`;
}

export function teachersAdminHtml({data,user}){
  if(!isMaster(user))return '<div class="rong">Không có quyền.</div>';
  return `<div class="tieu-de-trang"><div><h1>Giáo viên & tài khoản</h1></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Họ tên</th><th>Thao tác</th><th>Lần thi</th><th>Lớp</th></tr></thead><tbody>${data.users.filter(u=>u.role!=='master').map(u=>`<tr data-user-group="${u.role==='teacher'?'teacher':u.role==='student'?(data.classes?.find(c=>c.id===u.classId)?.code==='Extend'||!u.classId?'external':'student'):'admin'}" data-user-search="${esc((u.name+' '+u.email).toLocaleLowerCase('vi'))}"><td><span class="user-role-name ${u.role==='teacher'?'user-role-name--teacher':''}"><span class="user-role-icon" title="${u.role==='teacher'?'Giáo viên':'Học viên'}" role="img" aria-label="${u.role==='teacher'?'Giáo viên':'Học viên'}">${iconHtml(u.role==='teacher'?'teacher':'student')}</span><b>${esc(u.name)}</b></span><div class="phu">${esc(u.email)}</div></td><td>${u.id===user.id?'—':`<button class="icon-btn" data-action="toggle-teacher" data-id="${esc(u.id)}" title="${u.role==='teacher'?'Chuyển về Học viên':'Đặt làm Giáo viên'}" aria-label="${u.role==='teacher'?'Chuyển về Học viên':'Đặt làm Giáo viên'}">${iconHtml(u.role==='teacher'?'student':'teacher')}</button>`}</td><td>${u.attemptCount??(data.attempts||[]).filter(a=>a.studentId===u.id&&a.status!=='abandoned').length}</td><td>${esc(data.classes?.find(c=>c.id===u.classId)?.code||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}

export function trashAdminHtml({data,retentionDays=30}){
  const exams=data.exams.filter(x=>x.status==='trash'),qs=data.questions.filter(x=>x.status==='trash'),courses=data.trashedCourses||[];
  return `<div class="tieu-de-trang exam-list-heading"><div><h1>Thùng rác</h1></div><button class="nut nguy" data-action="empty-trash" ${!exams.length&&!qs.length?'disabled':''}>Dọn sạch</button></div><p class="phu-de">Dữ liệu xóa sau ${esc(retentionDays)} ngày. Xóa đề sẽ xóa cả lịch sử bài làm và bảng điểm của đề. Câu hỏi, media còn được sử dụng sẽ được giữ lại.</p>${trashTableHtml(exams,'exam')}${courses.length?`<h3>Khóa học</h3><p class="phu-de">Khóa học được giữ trong Thùng rác để khôi phục, không xóa lịch sử học viên.</p>${trashTableHtml(courses,'course')}`:''}${qs.length?`<h3 style="margin-top:20px">Câu hỏi</h3>${trashTableHtml(qs,'question')}`:''}`;
}

export function trashTableHtml(items,type){
  return `<div class="table-wrap"><table class="bang"><tbody>${items.map(x=>`<tr><td><b>${esc(x.title)}</b></td><td>${esc(x.ownerName||'')}</td><td><div class="hanh-dong-bang"><button class="nut nho" data-action="restore-${type}" data-id="${esc(x.id)}" data-version="${esc(x.version??0)}">Khôi phục</button>${type==='course'?'':`<button class="nut nho nguy" data-action="permanent-${type}" data-id="${esc(x.id)}">Xóa vĩnh viễn</button>`}</div></td></tr>`).join('')||'<tr><td class="rong">Trống</td></tr>'}</tbody></table></div>`;
}
