import {nameChangePatch} from '../domain/account-name.js';
import {mountDialog} from './classes.js';
import {openClassEnrollment} from './class-enrollment.js';
import {validateStudentName} from '../domain/student-profile.js';
import {esc} from '../ui/format.js';
import {confirmNameChange} from '../ui/confirm.js';
import {iconHtml} from '../ui/icons.js';

export function openAccountProfile({repo,user,onSaved}){
  const modal=mountDialog('Hồ sơ',`<form class="profile-form account-profile-form"><div class="account-profile-field"><label>Họ và tên<input name="name" required maxlength="120" autocomplete="name" ${user.role==='master'?'':'aria-describedby="accountNameHint"'} value="${esc(user.name)}"></label>${user.role==='master'?'':'<p id="accountNameHint" class="account-profile-hint">Bạn có thể đổi tên 1 lần mỗi 30 ngày.</p>'}</div>${user.role==='student'?'<div class="account-profile-field"><label>Mã xác nhận lớp <span class="account-profile-optional">Không bắt buộc</span><input name="code" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" placeholder="Nhập mã giáo viên cung cấp"></label></div>':''}<p data-error role="alert"></p><button type="submit" class="nut chinh">${iconHtml('grading')}<span>Lưu thay đổi</span></button></form>`,{compact:true});
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
