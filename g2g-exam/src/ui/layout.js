import {isMaster,isStudent} from '../core.js';
import {esc} from './format.js';
import {iconHtml} from './icons.js';
import {currentPublicSettings} from '../settings/theme.js';
import {colorModeButtonHtml} from '../settings/color-mode.js';

export function topbarHtml({user,mode,online,ui={},canSwitchRole=false,studentExamMenu=[]}){
  const general=currentPublicSettings().general||{};
  const logoUrl=general.logoUrl?`/brand/logo?v=${encodeURIComponent(general.logoUrl)}`:'/brand/logo';
  const brandLogo=mode==='local'||!general.logoUrl?'G2G':`<img src="${esc(logoUrl)}" alt="G2G Career" width="48" height="48">`;
  const role=isStudent(user)?'Học viên':isMaster(user)?'Quản trị cấp cao':'Giáo viên';
  const tabs=user&&!isStudent(user)
    ?(isMaster(user)?[['dashboard','Tổng quan','grades'],['exams','Đề Thi','exams'],['speaking','Thi Nói thử nghiệm','speaking'],['backup','Backup','backup'],['teachers','Người dùng','users'],['trash','Thùng rác','trash'],['settings','Cài đặt','settings']]:[['exams','Đề Thi','exams'],['grades','Bài Thi','grading'],['classes','Lớp học','users']])
    :[];
  const menuItems=studentExamMenu.filter(exam=>exam?.level&&['GOETHE','TELC'].includes(String(exam.provider||'').toUpperCase()));
  const levelOrder=['A1','A2','B1','B2','C1','C2'];
  const levels=[...new Set(menuItems.map(exam=>String(exam.level)))].sort((a,b)=>{
    const aOrder=levelOrder.indexOf(a),bOrder=levelOrder.indexOf(b);
    return (aOrder<0?99:aOrder)-(bOrder<0?99:bOrder)||a.localeCompare(b);
  });
  const examMenu=levels.length?`<div class="student-exam-nav-menu" aria-label="Chọn đề thi theo trình độ và loại đề"><div class="student-exam-nav-menu__list">${levels.map(level=>{
    const providers=[...new Set(menuItems.filter(exam=>String(exam.level)===level).map(exam=>String(exam.provider).toUpperCase()))];
    return `<div class="student-exam-nav-menu__level"><button type="button" class="student-exam-nav-menu__level-trigger" aria-haspopup="true"><span>${esc(level)}</span>${iconHtml('arrowRight')}</button><div class="student-exam-nav-menu__providers" role="menu" aria-label="Loại đề ${esc(level)}">${providers.map(provider=>`<button type="button" role="menuitem" data-action="student-exam-menu" data-exam-level="${esc(level)}" data-exam-provider="${esc(provider)}">${provider==='GOETHE'?'Goethe':'Telc'}</button>`).join('')}</div></div>`;
  }).join('')}</div></div>`:'';
  const navigation=tabs.length?`<nav class="thanh-ben" aria-label="Điều hướng quản trị">${tabs.map(([key,label,icon])=>`<button class="muc-ben ${['speaking','backup','teachers','trash','settings'].includes(key)?'muc-ben--icon':''} ${ui.adminTab===key?'active':''}" data-action="admin-tab" data-tab="${key}" title="${label}" aria-label="${label}" ${ui.adminTab===key?'aria-current="page"':''}>${iconHtml(icon)}${['speaking','backup','teachers','trash','settings'].includes(key)?'':`<span>${label}</span>`}</button>`).join('')}</nav>`
    :isStudent(user)?`<nav class="site-nav" aria-label="Điều hướng học viên"><div class="student-exam-nav"><button class="muc-ben ${ui.view==='student-home'?'active':''}" data-action="student-home" ${ui.view==='student-home'?'aria-current="page"':''}>${iconHtml('exams')}<span>Đề Thi</span></button>${examMenu}</div><button class="muc-ben ${ui.view==='student-results'?'active':''}" data-action="student-results" ${ui.view==='student-results'?'aria-current="page"':''}>${iconHtml('grades')}<span>Kết quả</span></button></nav>`:'';
  const initials=String(user?.name||'G2G').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();
  const avatar=user?.picture?`<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials);
  const demo=mode==='local'
    ? '<div class="canh-bao-che-do">Đang chạy bản demo cục bộ trên trình duyệt; dữ liệu không phải dữ liệu thật.</div>'
    : '';
  const offline=!online
    ? '<div class="offline">Mất kết nối mạng. Hãy giữ trang mở; dữ liệu sẽ tiếp tục đồng bộ khi có mạng.</div>'
    : '';
  const roleItems=[['student','Học viên'],['teacher','Giáo viên'],['master','Át min']];
  const roleMenu=`<div id="accountRoleMenu" class="account-role-menu" data-role-menu hidden><button data-action="account-profile">${iconHtml('profile')}<span>Hồ sơ</span></button>${canSwitchRole?roleItems.filter(([value])=>value!==user?.role).map(([value,label])=>`<button data-action="test-role" data-role="${value}">${iconHtml(value==='master'?'admin':value)}<span>${label}</span></button>`).join(''):''}<button data-action="logout">${iconHtml('logout')}<span>Đăng xuất</span></button></div>`;
return `<header class="thanh-dau" data-current-role="${esc(user?.role||'')}"><div class="thuong-hieu"><div class="logo">${brandLogo}</div><div class="ten-he-thong"><strong>Luyện thi tiếng Đức</strong><small>G2G Career</small></div></div>${navigation}<div class="header-utilities">${colorModeButtonHtml()}<div class="header-account"><button class="account-avatar" data-action="toggle-role-menu" aria-expanded="false" aria-controls="accountRoleMenu" title="${esc(user?.name||role)}${canSwitchRole?` · ${roleItems.find(([value])=>value===user?.role)?.[1]||role}`:''}" aria-label="Tài khoản ${esc(user?.name||role)}${canSwitchRole?` · ${role}`:''}">${avatar}</button>${canSwitchRole?`<span class="account-role-indicator" data-role="${esc(user.role)}" title="${roleItems.find(([value])=>value===user.role)?.[1]||role}" aria-hidden="true">${iconHtml(user.role==='master'?'admin':user.role)}</span>`:''}${roleMenu}</div></div></header>${demo}${offline}`;
}
