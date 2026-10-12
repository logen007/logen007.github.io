import {
  ATTEMPT_STATUS,isMaster,canEditExam
} from '../core.js';
import {textHtml,esc,fmtDate} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {examPublishButton} from '../ui/exam-publish-button.js';

export function adminShellHtml({content}){
  return `<div class="khung-quan-tri"><main class="noi-dung-quan-tri">${content}</main></div>`;
}

export {dashboardHtml} from './dashboard.js';

export function examAdminHtml({data,user,filters={}}){
  const exams=data.exams.filter(x=>x.status!=='trash'&&(!filters.provider||x.provider===filters.provider)&&(!filters.level||x.level===filters.level));
  const picker=(key,label,values)=>`<label class="filter-field"><select aria-label="${esc(label)}" data-admin-exam-filter="${key}"><option value="">${esc(label)}</option>${values.map(value=>`<option value="${value}" ${filters[key]===value?'selected':''}>${value}</option>`).join('')}</select></label>`;
  return `<div class="tieu-de-trang exam-list-heading"><div><h1>Đề Thi</h1></div><button class="nut chinh" data-action="new-exam">+ Tạo đề thi</button></div><div class="exam-filter">${picker('provider','Loại đề',['GOETHE','TELC','FID'])}${picker('level','Trình độ',['A1','A2','B1','B2','C1','C2'])}</div><div class="table-wrap"><table class="bang"><thead><tr><th>Đề thi</th><th>Loại đề</th><th>Người tạo</th><th>Lượt thi</th><th>Last edit</th><th>Thao tác</th></tr></thead><tbody>${exams.map(ex=>{const own=canEditExam(user,ex),attempts=ex.attemptCount??data.attempts.filter(a=>a.examId===ex.id&&a.status!=='abandoned').length;return `<tr><td><button class="table-link exam-title-status ${ex.status==='published'?'is-published':'is-draft'}" title="${esc(ex.title)} — ${ex.status==='published'?'Đã xuất bản':'Bản nháp'}" aria-label="${esc(ex.title)} — ${ex.status==='published'?'Đã xuất bản':'Bản nháp'}" data-action="edit-exam" data-id="${esc(ex.id)}">${textHtml(ex.title)}</button></td><td>${esc([ex.provider,ex.level].filter(Boolean).join(' ')||ex.level)}</td><td>${esc(ex.ownerName)}</td><td>${attempts}</td><td class="exam-last-edit">${esc(fmtDate(ex.updatedAt||ex.createdAt))}</td><td><div class="hanh-dong-bang">${own?examPublishButton(ex,{compact:true}):''}${own?`<button class="icon-btn" title="Cài đặt đề" aria-label="Cài đặt đề" data-action="exam-access-settings" data-id="${esc(ex.id)}">${iconHtml('settings')}</button>`:''}<button class="icon-btn" data-action="duplicate-exam" data-id="${esc(ex.id)}" aria-label="Nhân bản ${esc(ex.title)}" title="Nhân bản">${iconHtml('copy')}</button>${own?`<button class="icon-btn" data-action="delete-exam" data-id="${esc(ex.id)}" aria-label="Xóa ${esc(ex.title)}" title="Xóa">${iconHtml('trash')}</button>`:''}</div></td></tr>`;}).join('')}</tbody></table></div>`;
}

export function teachersAdminHtml({data,user}){
  if(!isMaster(user))return '<div class="rong">Không có quyền.</div>';
  return `<div class="tieu-de-trang"><div><h1>Giáo viên & tài khoản</h1></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Họ tên</th><th>Email</th><th>Thao tác</th></tr></thead><tbody>${data.users.filter(u=>u.role!=='master').map(u=>`<tr data-user-group="${u.role==='teacher'?'teacher':u.role==='student'?(data.classes?.find(c=>c.id===u.classId)?.code==='Extend'||!u.classId?'external':'student'):'admin'}" data-user-search="${esc((u.name+' '+u.email).toLocaleLowerCase('vi'))}"><td><span class="user-role-name ${u.role==='teacher'?'user-role-name--teacher':''}"><span class="user-role-icon" title="${u.role==='teacher'?'Giáo viên':'Học viên'}" role="img" aria-label="${u.role==='teacher'?'Giáo viên':'Học viên'}">${iconHtml(u.role==='teacher'?'teacher':'student')}</span><b>${esc(u.name)}</b></span></td><td>${esc(u.email)}</td><td>${u.id===user.id?'—':`<button class="nut nho" data-action="toggle-teacher" data-id="${u.id}">${u.role==='teacher'?'Chuyển về Học viên':'Đặt làm Giáo viên'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}

export function trashAdminHtml({data}){
  const exams=data.exams.filter(x=>x.status==='trash'),qs=data.questions.filter(x=>x.status==='trash');
  return `<div class="tieu-de-trang"><div><h1>Thùng rác</h1><p>Tự xóa theo thời hạn trong Cài đặt (mặc định 30 ngày). Xóa đề sẽ xóa cả lịch sử bài làm và bảng điểm của đề. Câu hỏi, media còn được sử dụng sẽ được giữ lại.</p></div><button class="nut nguy" data-action="empty-trash" ${!exams.length&&!qs.length?'disabled':''}>Dọn sạch thùng rác</button></div><h3>Bài thi</h3>${trashTableHtml(exams,'exam')}<h3 style="margin-top:20px">Câu hỏi</h3>${trashTableHtml(qs,'question')}`;
}

export function trashTableHtml(items,type){
  return `<div class="table-wrap"><table class="bang"><tbody>${items.map(x=>`<tr><td><b>${esc(x.title)}</b></td><td>${esc(x.ownerName||'')}</td><td><div class="hanh-dong-bang"><button class="nut nho" data-action="restore-${type}" data-id="${x.id}">Khôi phục</button><button class="nut nho nguy" data-action="permanent-${type}" data-id="${x.id}">Xóa vĩnh viễn</button></div></td></tr>`).join('')||'<tr><td class="rong">Trống</td></tr>'}</tbody></table></div>`;
}
