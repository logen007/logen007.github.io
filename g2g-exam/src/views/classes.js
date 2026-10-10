import {esc} from '../ui/format.js';
import {STUDENT_LEVELS,validateStudentProfile} from '../domain/student-profile.js';

export function teacherChip(teacher){
  const initials=String(teacher.name||'GV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('');
  return `<span class="class-teacher-avatar">${teacher.picture?`<img src="${esc(teacher.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><span>${esc(teacher.name||'Giáo viên')}</span>`;
}
export function classFormHtml(current,users){
  const teachers=users.filter(user=>user.role==='teacher'&&(user.active!==false||current?.teacherIds?.includes(user.id)));
  return `<form class="profile-form class-form"><label>Mã lớp<input name="code" required maxlength="60" value="${esc(current?.code||'')}" placeholder="Ví dụ: A1-2026-01"></label><label>Mô tả<textarea name="description" rows="3" maxlength="2000" placeholder="Lịch học, mục tiêu hoặc ghi chú của lớp">${esc(current?.description||'')}</textarea></label><fieldset class="class-teachers"><legend>Giáo viên</legend><p class="phu-de">Có thể chọn nhiều giáo viên. Bỏ tích để gỡ khỏi lớp.</p><div class="class-teacher-options">${teachers.map(teacher=>`<label class="class-teacher-option"><input name="teacherIds" type="checkbox" value="${esc(teacher.id)}" ${current?.teacherIds?.includes(teacher.id)?'checked':''}>${teacherChip(teacher)}${teacher.active===false?'<small>Đã ngừng hoạt động</small>':''}</label>`).join('')||'<p class="phu-de">Chưa có tài khoản giáo viên.</p>'}</div></fieldset><p data-error role="alert"></p><button class="nut chinh" type="submit">Lưu lớp</button></form>`;
}

export function classesHtml({data}){
  const classes=data.classes||[],students=data.users.filter(item=>item.role==='student');
  return `<div class="tieu-de-trang"><h1>Lớp học</h1><button class="nut chinh" data-action="new-class">+ Thêm lớp</button></div>
    <div class="table-wrap"><table class="bang"><thead><tr><th>Mã lớp</th><th>Mô tả</th><th>Giáo viên</th><th>Học viên</th><th></th></tr></thead><tbody>${classes.map(item=>`<tr><td>${esc(item.code)}</td><td class="class-description">${esc(item.description||'—')}</td><td><div class="class-teacher-chips">${(item.teacherIds||[]).map(id=>data.users.find(user=>user.id===id)).filter(Boolean).map(teacher=>`<span class="class-teacher-chip">${teacherChip(teacher)}</span>`).join('')||'—'}</div></td><td>${students.filter(student=>student.classId===item.id).length}</td><td><button class="nut nho" data-action="edit-class" data-id="${esc(item.id)}">Chỉnh sửa</button></td></tr>`).join('')||'<tr><td colspan="5">Chưa có lớp. Hãy thêm mã lớp để học viên đăng ký.</td></tr>'}</tbody></table></div>
    <h2>Học viên</h2><div class="table-wrap"><table class="bang"><thead><tr><th>Họ và tên</th><th>Mã lớp</th><th>Trình độ</th><th></th></tr></thead><tbody>${students.map(student=>`<tr><td>${esc(student.name)}<span class="phu">${esc(student.email)}</span></td><td>${esc(classes.find(item=>item.id===student.classId)?.code||'Chưa chọn lớp')}</td><td>${esc(student.level||'A1.1')}</td><td><button class="nut nho" data-action="student-profile" data-id="${esc(student.id)}">Thông tin</button></td></tr>`).join('')||'<tr><td colspan="4">Chưa có học viên.</td></tr>'}</tbody></table></div>`;
}

export function mountDialog(title,body,{required=false}={}){
  document.getElementById('modal')?.remove();
  const modal=document.createElement('div');modal.id='modal';modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop" role="dialog" aria-modal="true" aria-labelledby="profileDialogTitle"><div class="dau-hop"><h2 id="profileDialogTitle">${esc(title)}</h2>${required?'':'<button class="nut nho" type="button" data-dismiss aria-label="Đóng">×</button>'}</div>${body}</section>`;
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
  const modal=mountDialog(required?'Hoàn tất thông tin học viên':'Thông tin học viên',`<form class="profile-form"><label>Họ và tên đầy đủ<input name="name" required maxlength="120" value="${esc(student.name||'')}" autocomplete="name"></label><label>Mã lớp<input name="classCode" required list="profileClasses" placeholder="Gõ để tìm mã lớp" value="${esc(current?.code||'')}" autocomplete="off"><datalist id="profileClasses">${classes.map(item=>`<option value="${esc(item.code)}"></option>`).join('')}</datalist></label>${required?'<p class="phu-de">Trình độ ban đầu: A1.1. Giáo viên sẽ cập nhật trình độ của bạn.</p>':`<label>Trình độ<select name="level">${STUDENT_LEVELS.map(level=>`<option ${level===(student.level||'A1.1')?'selected':''}>${level}</option>`).join('')}</select></label>`}${classes.length?'':'<p class="phu-de">Chưa có mã lớp. Vui lòng liên hệ giáo viên để thêm lớp.</p>'}<p data-error role="alert"></p><button class="nut chinh" type="submit" ${classes.length?'':'disabled'}>Lưu thông tin</button></form>`,{required});
  modal.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    try{
      button.disabled=true;
      const selected=classes.find(item=>item.code.toLowerCase()===form.elements.classCode.value.trim().toLowerCase());
      const payload=validateStudentProfile({name:form.elements.name.value,classId:selected?.id,level:required?'A1.1':form.elements.level.value},classes);
      if(repo.mode==='api'){await repo.call('saveStudentProfile',{studentId:student.id,...payload});await repo.reload();}
      else await repo.transaction(state=>Object.assign(state.users.find(item=>item.id===student.id),payload,{profileCompletedAt:new Date().toISOString()}));
      modal.remove();await onSaved();
    }catch(error){form.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
  if(required){
    const actions=document.createElement('div');actions.className='nhom-nut';
    actions.innerHTML='<button class="nut" type="button" data-refresh-classes>Cập nhật danh sách lớp</button><button class="nut" type="button" data-sign-out>Đăng xuất</button>';
    modal.querySelector('.noi-hop').append(actions);
    actions.querySelector('[data-refresh-classes]').onclick=async()=>{
      try{if(repo.mode==='api')await repo.reload();modal.remove();await onSaved();}
      catch(error){modal.querySelector('[data-error]').textContent=error.message;}
    };
    actions.querySelector('[data-sign-out]').onclick=async()=>{await repo.signOut();location.reload();};
  }
}

export function bindClasses(root,{data,repo,onSaved}){
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
