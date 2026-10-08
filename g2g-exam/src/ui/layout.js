import {isMaster,isStudent} from '../core.js';
import {esc} from './format.js';
import {iconHtml} from './icons.js';

export function topbarHtml({user,mode,online,ui={}}){
  const role=isStudent(user)?'Học viên':isMaster(user)?'Quản trị cấp cao':'Giáo viên';
  const tabs=user&&!isStudent(user)
    ?[['exams','Bài thi','exams'],['grading','Chấm bài','grading'],['grades','Bảng điểm','grades'],...(isMaster(user)?[['teachers','Người dùng','users'],['trash','Thùng rác','trash']]:[])]
    :[];
  const navigation=tabs.length?`<nav class="thanh-ben" aria-label="Điều hướng quản trị">${tabs.map(([key,label,icon])=>`<button class="muc-ben ${ui.adminTab===key?'active':''}" data-action="admin-tab" data-tab="${key}" ${ui.adminTab===key?'aria-current="page"':''}>${iconHtml(icon)}<span>${label}</span></button>`).join('')}</nav>`
    :isStudent(user)?`<nav class="site-nav" aria-label="Điều hướng học viên"><button class="muc-ben ${ui.view==='student-home'?'active':''}" data-action="student-home" ${ui.view==='student-home'?'aria-current="page"':''}>${iconHtml('exams')}<span>Bài thi</span></button><button class="muc-ben ${ui.view==='student-results'?'active':''}" data-action="student-results" ${ui.view==='student-results'?'aria-current="page"':''}>${iconHtml('grades')}<span>Kết quả</span></button></nav>`:'';
  const initials=String(user?.name||'G2G').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();
  const demo=mode==='local'
    ? '<div class="canh-bao-che-do">Đang chạy bản demo cục bộ trên trình duyệt; dữ liệu không phải dữ liệu thật.</div>'
    : '';
  const offline=!online
    ? '<div class="offline">Mất kết nối mạng. Hãy giữ trang mở; dữ liệu sẽ tiếp tục đồng bộ khi có mạng.</div>'
    : '';
  return `<header class="thanh-dau"><div class="thuong-hieu"><div class="logo">G2G</div><div class="ten-he-thong"><strong>Thi thử tiếng Đức</strong><small>G2G Career</small></div></div>${navigation}<div class="header-account"><span class="nhan"${isMaster(user)?' hidden':''}>${role}</span><span class="account-avatar" title="${esc(user?.name||role)}">${esc(initials)}</span><button class="icon-btn header-logout" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">${iconHtml('logout')}</button></div></header>${demo}${offline}`;
}
