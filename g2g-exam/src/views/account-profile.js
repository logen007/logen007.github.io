import {mountDialog} from './classes.js';
import {openClassEnrollment} from './class-enrollment.js';
import {validateStudentName} from '../domain/student-profile.js';
import {esc} from '../ui/format.js';

export function openAccountProfile({repo,user,onSaved}){
  const modal=mountDialog('Profile',`<form class="profile-form"><label>Họ và tên<input name="name" required maxlength="120" autocomplete="name" value="${esc(user.name)}"></label>${user.role==='student'?'<label>Mã xác nhận lớp<input name="code" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" placeholder="Nhập mã giáo viên cung cấp"></label>':''}<p data-error role="alert"></p><button type="submit" class="nut chinh">Lưu</button></form>`,{compact:true});
  const form=modal.querySelector('form'),button=form.querySelector('button');
  form.onsubmit=async event=>{
    event.preventDefault();button.disabled=true;
    try{
      const name=validateStudentName(form.elements.name.value),code=form.elements.code?.value.trim().toUpperCase();
      if(name!==user.name){
        if(repo.mode==='api'){await repo.call('saveAccountName',{name});await repo.reload();}
        else await repo.transaction(state=>{state.users.find(item=>item.id===user.id).name=name;});
      }
      modal.remove();await onSaved();
      if(code)openClassEnrollment({repo,user,onSaved,initialCode:code});
    }catch(error){form.querySelector('[data-error]').textContent=error.message;}
    finally{button.disabled=false;}
  };
}
