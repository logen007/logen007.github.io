import {isMaster,isStudent} from '../core.js';
import {esc} from './format.js';
import {iconHtml} from './icons.js';

export function topbarHtml({user,mode,online,ui={},canSwitchRole=false}){
  const role=isStudent(user)?'Học viên':isMaster(user)?'Quản trị cấp cao':'Giáo viên';
  const tabs=user&&!isStudent(user)
    ?(isMaster(user)?[['dashboard','Tổng quan','grades'],['exams','Đề Thi','exams'],['teachers','Người dùng','users'],['trash','Thùng rác','trash']]:[['exams','Đề Thi','exams'],['grades','Bài Thi','grading'],['classes','Lớp học','users']])
    :[];
  const navigation=tabs.length?`<nav class="thanh-ben" aria-label="Điều hướng quản trị">${tabs.map(([key,label,icon])=>`<button class="muc-ben ${['teachers','trash'].includes(key)?'muc-ben--icon':''} ${ui.adminTab===key?'active':''}" data-action="admin-tab" data-tab="${key}" title="${label}" aria-label="${label}" ${ui.adminTab===key?'aria-current="page"':''}>${iconHtml(icon)}${['teachers','trash'].includes(key)?'':`<span>${label}</span>`}</button>`).join('')}</nav>`
    :isStudent(user)?`<nav class="site-nav" aria-label="Điều hướng học viên"><button class="muc-ben ${ui.view==='student-home'?'active':''}" data-action="student-home" ${ui.view==='student-home'?'aria-current="page"':''}>${iconHtml('exams')}<span>Đề Thi</span></button><button class="muc-ben ${ui.view==='student-results'?'active':''}" data-action="student-results" ${ui.view==='student-results'?'aria-current="page"':''}>${iconHtml('grades')}<span>Kết quả</span></button></nav>`:'';
  const initials=String(user?.name||'G2G').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();
  const avatar=user?.picture?`<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials);
  const demo=mode==='local'
    ? '<div class="canh-bao-che-do">Đang chạy bản demo cục bộ trên trình duyệt; dữ liệu không phải dữ liệu thật.</div>'
    : '';
  const offline=!online
    ? '<div class="offline">Mất kết nối mạng. Hãy giữ trang mở; dữ liệu sẽ tiếp tục đồng bộ khi có mạng.</div>'
    : '';
  const roleItems=[['student','Student'],['teacher','Teacher'],['master','Admin']];
  const roleMenu=`<div id="accountRoleMenu" class="account-role-menu" data-role-menu hidden><button data-action="account-profile">Profile</button>${canSwitchRole?roleItems.filter(([value])=>value!==user?.role).map(([value,label])=>`<button data-action="test-role" data-role="${value}">${label}</button>`).join(''):''}<button data-action="logout">Log out</button></div>`;
  return `<header class="thanh-dau" data-current-role="${esc(user?.role||'')}"><div class="thuong-hieu"><div class="logo">G2G</div><div class="ten-he-thong"><strong>Luyện thi tiếng Đức</strong><small>G2G Career</small></div></div>${navigation}<div class="header-account"><button class="account-avatar" data-action="toggle-role-menu" aria-expanded="false" aria-controls="accountRoleMenu" title="${esc(user?.name||role)}" aria-label="Tài khoản ${esc(user?.name||role)}">${avatar}</button>${roleMenu}</div></header>${demo}${offline}`;
}
