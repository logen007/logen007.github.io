import {nameChangePatch} from '../domain/account-name.js';
import {mountDialog} from './classes.js';
import {openClassEnrollment} from './class-enrollment.js';
import {validateStudentName} from '../domain/student-profile.js';
import {esc} from '../ui/format.js';
import {confirmNameChange} from '../ui/confirm.js';
import {iconHtml} from '../ui/icons.js';

export function accountProfileHtml(user){
  const initials=String(user.name||'G2G').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();
  const avatar=user.picture?`<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials);
  return `<form class="profile-form account-profile-form">
    <div class="account-profile-identity"><span class="account-profile-avatar" aria-hidden="true">${avatar}</span><div><span class="account-profile-email-label">Email</span><p class="account-profile-email">${esc(user.email||'Chưa có email')}</p></div></div>
    <div class="account-profile-field"><label>Họ và tên<input name="name" required maxlength="120" autocomplete="name" ${user.role==='master'?'':'aria-describedby="accountNameHint"'} value="${esc(user.name)}"></label>${user.role==='master'?'':'<p id="accountNameHint" class="account-profile-hint">Đổi tên tối đa 1 lần mỗi 30 ngày.</p>'}</div>
    ${user.role==='student'?'<div class="account-profile-field"><label>Mã xác nhận lớp <span class="account-profile-optional">Tùy chọn</span><input name="code" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" autocapitalize="characters" placeholder="Mã gồm 5 ký tự"></label></div>':''}
    <p data-error role="alert"></p><button type="submit" class="nut chinh">${iconHtml('grading')}<span>Lưu thay đổi</span></button>
  </form>`;
}
export function openAccountProfile({repo,user,onSaved}){
  const modal=mountDialog('Hồ sơ',accountProfileHtml(user),{compact:true});
  modal.querySelector('.noi-hop').classList.add('account-profile-dialog');
  const form=modal.querySelector('form'),button=form.querySelector('button');
  form.onsubmit=async event=>{
    event.preventDefault();if(button.disabled)return;button.disabled=true;
    try{
      const name=validateStudentName(form.elements.name.value),code=form.elements.code?.value.trim().toUpperCase();
      if(name!==user.name){
        if(!await confirmNameChange(name,user))return;
        if(repo.mode==='api'){await repo.call('saveAccountName',{name});await repo.reload();}
        else await repo.transaction(state=>{const account=state.users.find(item=>item.id===user.id);Object.assign(account,nameChangePatch(account,name,{admin:account.role==='master'}));});
      }
      modal.remove();await onSaved();
      if(code)openClassEnrollment({repo,user,onSaved,initialCode:code});
    }catch(error){form.querySelector('[data-error]').textContent=error.message;}
    finally{button.disabled=false;}
  };
}
