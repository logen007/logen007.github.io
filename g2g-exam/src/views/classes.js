import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {EXTERNAL_CLASS,normalizeStudentLevel,validateStudentProfile} from '../domain/student-profile.js';

export function teacherChip(teacher){
  const initials=String(teacher.name||'GV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('');
  return `<span class="class-teacher-avatar">${teacher.picture?`<img src="${esc(teacher.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><span>${esc(teacher.name||'Giáo viên')}</span>`;
}
export function classFormHtml(current,users){
  const teachers=users.filter(user=>user.role==='teacher'&&(user.active!==false||current?.teacherIds?.includes(user.id)));
  return `<form class="profile-form class-form"><label>Mã lớp<input name="code" required maxlength="60" ${current?.code===EXTERNAL_CLASS?'readonly':''} value="${esc(current?.code||'')}" placeholder="Ví dụ: A1-2026-01"></label><label>Mô tả<textarea name="description" rows="3" maxlength="2000" placeholder="Lịch học, mục tiêu hoặc ghi chú của lớp">${esc(current?.description||'')}</textarea></label><fieldset class="class-teachers"><legend>Giáo viên</legend><p class="phu-de">Có thể chọn nhiều giáo viên. Bỏ tích để gỡ khỏi lớp.</p><div class="class-teacher-options">${teachers.map(teacher=>`<label class="class-teacher-option"><input name="teacherIds" type="checkbox" value="${esc(teacher.id)}" ${current?.teacherIds?.includes(teacher.id)?'checked':''}>${teacherChip(teacher)}${teacher.active===false?'<small>Đã ngừng hoạt động</small>':''}</label>`).join('')||'<p class="phu-de">Chưa có tài khoản giáo viên.</p>'}</div></fieldset><p data-error role="alert"></p><button class="nut chinh" type="submit">Lưu lớp</button></form>`;
}

export function studentRosterHtml(data,students,{external=false}={}){
  return `<div class="profile-form"><label>Tìm học viên<input type="search" data-student-search placeholder="Tên học viên hoặc email" autocomplete="off"></label></div>
    <div class="table-wrap"><table class="bang"><thead><tr><th>Họ và tên</th><th>Trình độ</th>${external?'<th>Mã xác nhận</th>':''}<th></th></tr></thead><tbody>
    ${students.map(student=>`<tr data-student-row data-search="${esc((student.name+' '+student.email).toLocaleLowerCase('vi'))}"><td>${esc(student.name)}<span class="phu">${esc(student.email)}</span></td><td>${esc(normalizeStudentLevel(student.level)||'A1')}</td>${external?`<td><div class="nhom-nut confirmation-copy"><strong>${esc(student.confirmationCode||'—')}</strong>${student.confirmationCode?`<button class="icon-btn" type="button" data-copy-confirmation="${esc(student.confirmationCode)}" title="Copy mã xác nhận" aria-label="Copy mã xác nhận">${iconHtml('copy')}</button><small class="confirmation-copy-tooltip" data-copy-status role="status" hidden></small>`:''}</div></td>`:''}<td><button class="nut nho" data-action="student-profile" data-id="${esc(student.id)}">Thông tin</button></td></tr>`).join('')}
    <tr data-student-empty ${students.length?'hidden':''}><td colspan="${external?4:3}">Không tìm thấy học viên.</td></tr></tbody></table></div>`;
}
export function classesHtml({data,classId=null}){
  const classes=data.classes||[],students=data.users.filter(item=>item.role==='student');
  const selected=classes.find(item=>item.id===classId);
  if(selected)return `<div class="tieu-de-trang"><div><button class="text-link" data-class-back>← Lớp học</button><h1>Lớp ${esc(selected.code)}</h1><p class="phu-de">${esc(selected.description||'')}</p></div><button class="nut" data-action="edit-class" data-id="${esc(selected.id)}">Chỉnh sửa lớp</button></div>${studentRosterHtml(data,students.filter(student=>student.classId===selected.id),{external:selected.code===EXTERNAL_CLASS})}`;
  const external=classes.find(item=>item.code===EXTERNAL_CLASS);
  return `<div class="tieu-de-trang"><h1>Lớp học</h1><button class="nut chinh" data-action="new-class">+ Thêm lớp</button></div>
    <div class="table-wrap"><table class="bang"><thead><tr><th>Mã lớp</th><th>Mô tả</th><th>Giáo viên</th><th>Học viên</th><th></th></tr></thead><tbody>${classes.map(item=>`<tr><td><button class="text-link" data-open-class="${esc(item.id)}">${esc(item.code)}</button></td><td class="class-description">${esc(item.description||'—')}</td><td><div class="class-teacher-chips">${(item.teacherIds||[]).map(id=>data.users.find(user=>user.id===id)).filter(Boolean).map(teacher=>`<span class="class-teacher-chip">${teacherChip(teacher)}</span>`).join('')||'—'}</div></td><td>${students.filter(student=>student.classId===item.id).length}</td><td><button class="nut nho" data-action="edit-class" data-id="${esc(item.id)}">Chỉnh sửa</button></td></tr>`).join('')||'<tr><td colspan="5">Chưa có lớp.</td></tr>'}</tbody></table></div>
    <h2>Học viên Extend</h2><p class="phu-de">Học viên ngoài · Gửi mã xác nhận cho đúng email để học viên chọn lớp.</p>${studentRosterHtml(data,students.filter(student=>student.classId===external?.id),{external:true})}`;
}

export function mountDialog(title,body,{required=false,compact=false}={}){
  document.getElementById('modal')?.remove();
  const modal=document.createElement('div');modal.id='modal';modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop ${compact?'noi-hop--compact':''}" role="dialog" aria-modal="true" aria-labelledby="profileDialogTitle"><div class="dau-hop"><h2 id="profileDialogTitle">${esc(title)}</h2>${required?'':'<button class="nut nho" type="button" data-dismiss aria-label="Đóng">×</button>'}</div>${body}</section>`;
  document.body.append(modal);
  modal.querySelector('[data-dismiss]')?.addEventListener('click',()=>modal.remove());
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!required)modal.remove();
    if(event.key!=='Tab')return;
    const focusable=[...modal.querySelectorAll('button,input,select,textarea')].filter(item=>!item.disabled);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  modal.querySelector('input')?.focus();return modal;
}

export function openStudentProfile({data,student,repo,onSaved,required=false}){
  const classes=data.classes||[],current=classes.find(item=>item.id===student.classId);
  const modal=mountDialog(required?'Hoàn tất thông tin':'Thông tin học viên',`<form class="profile-form"><label>${required?'':`Trình độ: ${esc(normalizeStudentLevel(student.level)||'A1')}`}<input aria-label="Họ và tên" name="name" required maxlength="120" value="${required?'':esc(student.name||'')}" autocomplete="name" placeholder="Nhập họ và tên đầy đủ"></label>${required?'<input name="confirmationCode" aria-label="Mã xác nhận (không bắt buộc)" placeholder="Mã xác nhận (không bắt buộc)" minlength="5" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" autocapitalize="characters">':`<label>Mã lớp<select name="classCode">${classes.map(item=>`<option value="${esc(item.code)}" ${current?.id===item.id?'selected':''}>${esc(item.code)}</option>`).join('')}</select></label>`}<p data-error role="alert"></p><button class="nut chinh" type="submit">Lưu thông tin</button></form>`,{required,compact:true});
  modal.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    try{
      button.disabled=true;
      const code=required?form.elements.confirmationCode.value.trim().toUpperCase():'';
      const enrollment=code?await import('./class-enrollment.js'):null;
      const selected=classes.find(item=>required?item.code===EXTERNAL_CLASS:item.code===form.elements.classCode.value);
      const payload=validateStudentProfile({name:form.elements.name.value,classId:selected?.id,level:normalizeStudentLevel(student.level)||'A1'},classes);
      if(repo.mode==='api'){await repo.call('saveStudentProfile',{studentId:student.id,...payload});await repo.reload();}
      else await repo.transaction(state=>Object.assign(state.users.find(item=>item.id===student.id),payload,{profileCompletedAt:new Date().toISOString()}));
      modal.remove();await onSaved();
      if(code)enrollment.openClassEnrollment({repo,user:student,onSaved,initialCode:code});
    }catch(error){form.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
}

export function bindClasses(root,{data,repo,onSaved,onClassOpen=()=>{}}){
  root.querySelectorAll('[data-copy-confirmation]').forEach(button=>button.onclick=async()=>{
    const status=button.parentElement.querySelector('[data-copy-status]');
    clearTimeout(button.copyStatusTimer);
    try{await navigator.clipboard.writeText(button.dataset.copyConfirmation);status.textContent='Đã copy';}
    catch{status.textContent='Chưa copy được. Vui lòng sao chép thủ công.';}
    status.hidden=false;
    button.copyStatusTimer=setTimeout(()=>{status.hidden=true;},2200);
  });
  root.querySelectorAll('[data-open-class]').forEach(button=>button.onclick=()=>onClassOpen(button.dataset.openClass));
  root.querySelector('[data-class-back]')?.addEventListener('click',()=>onClassOpen(null));
  root.querySelector('[data-student-search]')?.addEventListener('input',event=>{
    const term=event.target.value.trim().toLocaleLowerCase('vi');let visible=0;
    root.querySelectorAll('[data-student-row]').forEach(row=>{row.hidden=!row.dataset.search.includes(term);if(!row.hidden)visible++;});
    root.querySelector('[data-student-empty]').hidden=visible>0;
  });
  root.querySelectorAll('[data-action="student-profile"]').forEach(button=>button.onclick=()=>openStudentProfile({data,repo,student:data.users.find(item=>item.id===button.dataset.id),onSaved}));
  root.querySelectorAll('[data-action="new-class"],[data-action="edit-class"]').forEach(button=>button.onclick=()=>{
    const current=data.classes.find(item=>item.id===button.dataset.id);
    const modal=mountDialog(current?'Chỉnh sửa lớp':'Thêm lớp',classFormHtml(current,data.users));
    modal.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,save=form.querySelector('button');save.disabled=true;
      try{
        const code=form.elements.code.value.trim();
        const description=form.elements.description.value.trim(),teacherIds=[...form.querySelectorAll('[name="teacherIds"]:checked')].map(input=>input.value);
        if(!code)throw new Error('Vui lòng nhập mã lớp.');
        if(repo.mode==='api'){await repo.call('saveClass',{id:current?.id,code,description,teacherIds});await repo.reload();}
        else await repo.transaction(state=>{
          if(state.classes.some(item=>item.id!==current?.id&&item.code.toLowerCase()===code.toLowerCase()))throw new Error('Mã lớp đã tồn tại.');
          if(current)Object.assign(state.classes.find(item=>item.id===current.id),{code,description,teacherIds});
          else state.classes.push({id:crypto.randomUUID(),code,description,teacherIds,active:true});
        });
        modal.remove();await onSaved();
      }catch(error){form.querySelector('[data-error]').textContent=error.message;save.disabled=false;}
    };
  });
}
