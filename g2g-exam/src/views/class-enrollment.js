import {mountDialog} from './classes.js';
import {esc} from '../ui/format.js';

export function openClassEnrollment({repo,user,onSaved,initialCode=''}){
  const modal=mountDialog('Xác nhận lớp',`<form class="profile-form">
    <p>Nhập mã đã được giáo viên cung cấp</p>
    <label><input aria-label="Mã xác nhận" value="${esc(initialCode)}" name="code" required minlength="5" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" autocapitalize="characters" placeholder="ABCDE"></label>
    <div data-class-choice hidden></div><p data-error role="alert"></p>
    <button class="nut chinh" type="submit">Xác nhận mã</button></form>`,{compact:true});
  const form=modal.querySelector('form'),choice=form.querySelector('[data-class-choice]'),button=form.querySelector('button');
  let verifiedCode=null;
  form.elements.code.addEventListener('input',()=>{verifiedCode=null;choice.hidden=true;choice.innerHTML='';button.textContent='Xác nhận mã';});
  form.onsubmit=async event=>{
    event.preventDefault();button.disabled=true;form.querySelector('[data-error]').textContent='';
    try{
      if(repo.mode!=='api')throw new Error('Chọn lớp bằng mã cần kết nối máy chủ.');
      const code=form.elements.code.value.trim().toUpperCase();
      if(verifiedCode!==code){
        const result=await repo.call('verifyClassCode',{code});
        if(!result.classes.length)throw new Error('Chưa có lớp để chọn. Vui lòng liên hệ giáo viên.');
        verifiedCode=code;
        choice.innerHTML=`<label>Lớp học<select name="classId" required><option value="">Chọn lớp</option>${result.classes.map(item=>`<option value="${esc(item.id)}">${esc(item.code)}${item.description?' — '+esc(item.description):''}</option>`).join('')}</select></label><p class="phu-de">Mã chỉ dùng một lần. Kiểm tra đúng lớp trước khi xác nhận.</p>`;
        choice.hidden=false;button.textContent='Xác nhận chọn lớp';choice.querySelector('select').focus();
      }else{
        await repo.call('enrollInClass',{code,classId:form.elements.classId.value});
        await repo.reload();modal.remove();await onSaved();
      }
    }catch(error){form.querySelector('[data-error]').textContent=error.message;}
    finally{button.disabled=false;}
  };
  if(initialCode)form.requestSubmit();
}
