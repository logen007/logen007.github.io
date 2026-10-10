import {mountDialog} from './classes.js';
import {STUDENT_LEVELS} from '../domain/student-profile.js';
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

export async function openExamAccess({repo,exam,onSaved}){
  const modal=mountDialog('Cài đặt đề thi',`<form class="profile-form"><label class="access-toggle"><input name="hidden" type="checkbox" ${exam.hidden?'checked':''}>Ẩn đề — yêu cầu mã để bắt đầu</label><label>Trình độ của đề<select name="learningLevel"><option value="">Không tự động lên trình độ</option>${STUDENT_LEVELS.map(level=>`<option ${exam.learningLevel===level?'selected':''}>${level}</option>`).join('')}</select></label><p class="phu-de">Đỗ đề sẽ lên bậc kế tiếp của trình độ này. Không thay đổi cấu trúc ${esc(exam.provider)} ${esc(exam.level)}.</p><button class="nut chinh" type="submit">Lưu cài đặt</button></form><hr><form class="profile-form" data-code-form><label>Ngày giờ hết hạn mã<input name="expiresAt" type="datetime-local" required></label><small>Giờ trên thiết bị của bạn. Mã hết hạn không ngắt lượt đang thi.</small><button class="nut" type="submit">Tạo mã</button></form><p data-error role="alert"></p><div data-codes aria-live="polite"></div>`);
  const error=message=>{modal.querySelector('[data-error]').textContent=message;};
  const load=async()=>{
    if(repo.mode!=='api'){error('Quản lý mã thi cần kết nối máy chủ.');return;}
    const codes=await repo.call('listExamCodes',{examId:exam.id});
    modal.querySelector('[data-codes]').innerHTML=codes.map(item=>`<div class="exam-code-row"><strong>${esc(item.code)}</strong><span>${esc(fmtDate(item.expiresAt))}</span><button type="button" class="nut nho" data-copy="${esc(item.code)}">Copy</button></div>`).join('')||'<p>Không có mã thi còn hiệu lực.</p>';
    modal.querySelectorAll('[data-copy]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='Đã copy';}catch{error('Không copy được tự động. Anh chọn mã rồi sao chép giúp em.');}});
  };
  const settingsForm=modal.querySelector('form');
  settingsForm.onsubmit=async event=>{
    event.preventDefault();const button=settingsForm.querySelector('button');button.disabled=true;
    try{
      if(repo.mode!=='api')throw new Error('Cài đặt này cần kết nối máy chủ.');
      await repo.call('saveExamAccess',{examId:exam.id,hidden:settingsForm.elements.hidden.checked,learningLevel:settingsForm.elements.learningLevel.value});
      await repo.reload();await onSaved();error('Đã lưu cài đặt.');
    }catch(e){error(e.message);}finally{button.disabled=false;}
  };
  modal.querySelector('[data-code-form]').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{
      if(repo.mode!=='api')throw new Error('Tạo mã cần kết nối máy chủ.');
      await repo.call('createExamCode',{examId:exam.id,expiresAt:new Date(form.elements.expiresAt.value).toISOString()});
      await load();error('');
    }catch(e){error(e.message);}finally{button.disabled=false;}
  };
  try{await load();}catch(e){error(e.message);}
  const timer=setInterval(()=>{if(!modal.isConnected){clearInterval(timer);return;}load().catch(e=>error(e.message));},30000);
}

export function showPromotion({repo,promotion,onSaved}){
  const modal=mountDialog('Chúc mừng bạn!',`<div class="promotion-celebration"><span aria-hidden="true">✦</span><h2>Bạn đã lên trình độ ${esc(promotion.toLevel)}</h2><p>Thành quả xứng đáng cho sự cố gắng của bạn.</p><p>${esc(promotion.fromLevel)} → <strong>${esc(promotion.toLevel)}</strong></p><button class="nut chinh" data-ack>Tiếp tục luyện tập</button><p data-error role="alert"></p></div>`,{required:true});
  modal.querySelector('[data-ack]').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{await repo.call('acknowledgePromotion',{attemptId:promotion.attemptId});await repo.reload();modal.remove();await onSaved();}
    catch(error){modal.querySelector('[data-error]').textContent=error.message;button.disabled=false;}
  };
}
