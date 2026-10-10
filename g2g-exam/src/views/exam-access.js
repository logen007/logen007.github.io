import {mountDialog} from './classes.js';
import {STUDENT_LEVELS,examLearningLevel,normalizeStudentLevel} from '../domain/student-profile.js';
import {esc,fmtDate} from '../ui/format.js';

export function openCodeEntry({repo,examId,onStarted}){
  const modal=mountDialog('Nhập mã đề',`<form class="profile-form"><p>Mỗi mã dùng một lần. Bắt đầu rồi bỏ dở vẫn tính đã dùng.</p><label>Mã thi<input name="code" maxlength="5" minlength="5" pattern="[A-Za-z0-9]{5}" required autocomplete="off" autocapitalize="characters" placeholder="ABCDE"></label><p data-error role="alert"></p><button class="nut chinh" type="submit">Bắt đầu thi</button></form>`);
  modal.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{
      if(repo.mode!=='api')throw new Error('Mã thi cần kết nối máy chủ; không dùng trong bản demo.');
      const result=await repo.call('startAttemptSecure',{examId,code:form.elements.code.value.trim().toUpperCase()});
      await repo.reload();modal.remove();await onStarted(result.attemptId);
    }catch(error){form.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
}

export function examAccessFormHtml(exam){
  return `<p class="access-exam-title">${esc(exam.title)}</p>
    <form class="profile-form access-settings-form">
      <section class="access-section"><h3>Quyền truy cập</h3><label class="access-toggle"><span><strong>Ẩn đề</strong><small>Học viên cần nhập mã để bắt đầu thi.</small></span><input name="hidden" type="checkbox" ${exam.hidden?'checked':''}></label></section>
      <section class="access-section"><div class="access-level-row"><h3>Trình độ</h3><label class="sr-only" for="accessLevel">Trình độ của đề</label><select id="accessLevel" name="learningLevel">${STUDENT_LEVELS.map(level=>`<option ${examLearningLevel(exam)===level?'selected':''}>${level}</option>`).join('')}</select></div><p class="phu-de">Đỗ đề này → ghi nhận đúng trình độ của đề. Định dạng ${esc(exam.provider)} ${esc(exam.level)} không thay đổi.</p></section>
      <div class="access-save"><span data-settings-status role="status"></span><button class="nut chinh" type="submit">Lưu thay đổi</button></div>
    </form>
    <section class="access-section access-codes"><div class="access-section-heading"><h3>Mã thi</h3><button class="text-link" type="button" data-refresh-codes>Làm mới</button></div><p class="phu-de">Mỗi học viên dùng mỗi mã một lần. Mã hết hạn không ngắt lượt đang thi.</p>
      <form class="access-code-create" data-code-form><label>Hết hạn lúc<input name="expiresAt" type="datetime-local" required></label><button class="nut" type="submit">Tạo mã</button></form><small class="phu-de">Theo giờ trên thiết bị của bạn.</small><p data-code-status role="status"></p><div data-codes aria-live="polite"></div>
    </section>`;
}
export async function openExamAccess({repo,exam,onSaved}){
  const modal=mountDialog('Cài đặt đề',examAccessFormHtml(exam));
  modal.classList.add('exam-access-dialog');
  const status=(selector,message,error=false)=>{const node=modal.querySelector(selector);node.textContent=message;node.classList.toggle('access-error',error);};
  const load=async()=>{
    if(repo.mode!=='api')throw new Error('Mã thi cần kết nối máy chủ.');
    const codes=await repo.call('listExamCodes',{examId:exam.id});
    if(!modal.isConnected)return;
    modal.querySelector('[data-codes]').innerHTML=codes.map(item=>`<div class="exam-code-row"><div><strong>${esc(item.code)}</strong><small>Hết hạn ${esc(fmtDate(item.expiresAt))}</small></div><button type="button" class="nut nho" data-copy="${esc(item.code)}" aria-label="Sao chép mã ${esc(item.code)}">Copy</button></div>`).join('')||'<div class="access-empty">Chưa có mã còn hiệu lực.<br><small>Chọn ngày giờ và nhấn Tạo mã.</small></div>';
    modal.querySelectorAll('[data-copy]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='Đã copy';}catch{status('[data-code-status]','Không thể sao chép tự động. Bạn có thể chọn mã để copy.',true);}});
  };
  const settingsForm=modal.querySelector('form');
  settingsForm.onsubmit=async event=>{
    event.preventDefault();const button=settingsForm.querySelector('button');button.disabled=true;status('[data-settings-status]','Đang lưu…');
    try{
      if(repo.mode!=='api')throw new Error('Cài đặt này cần kết nối máy chủ.');
      await repo.call('saveExamAccess',{examId:exam.id,hidden:settingsForm.elements.hidden.checked,learningLevel:settingsForm.elements.learningLevel.value});
      await repo.reload();await onSaved();status('[data-settings-status]','Đã lưu');
    }catch(error){status('[data-settings-status]',error.message,true);}finally{button.disabled=false;}
  };
  modal.querySelector('[data-code-form]').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{
      if(repo.mode!=='api')throw new Error('Tạo mã cần kết nối máy chủ.');
      const expiresAt=new Date(form.elements.expiresAt.value);
      if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now())throw new Error('Chọn thời gian hết hạn trong tương lai.');
      await repo.call('createExamCode',{examId:exam.id,expiresAt:expiresAt.toISOString()});
      await load();await repo.reload();await onSaved();status('[data-code-status]','Đã tạo mã. Nhấn Copy để gửi cho học viên.');
    }catch(error){status('[data-code-status]',error.message,true);}finally{button.disabled=false;}
  };
  modal.querySelector('[data-refresh-codes]').onclick=()=>load().catch(error=>status('[data-code-status]',error.message,true));
  try{await load();}catch(error){status('[data-code-status]',error.message,true);}
  const timer=setInterval(()=>{if(!modal.isConnected){clearInterval(timer);return;}load().catch(error=>status('[data-code-status]',error.message,true));},30000);
}

export function showPromotion({repo,promotion,onSaved}){
  const modal=mountDialog('Chúc mừng bạn!',`<div class="promotion-celebration"><span aria-hidden="true">✦</span><h2>Bạn đã đạt trình độ ${esc(normalizeStudentLevel(promotion.toLevel))}</h2><p>Thành quả xứng đáng cho sự cố gắng của bạn.</p><p>${esc(normalizeStudentLevel(promotion.fromLevel))} → <strong>${esc(normalizeStudentLevel(promotion.toLevel))}</strong></p><button class="nut chinh" data-ack>Tiếp tục luyện tập</button><p data-error role="alert"></p></div>`,{required:true});
  modal.querySelector('[data-ack]').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{await repo.call('acknowledgePromotion',{attemptId:promotion.attemptId});await repo.reload();modal.remove();await onSaved();}
    catch(error){modal.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
}
