import {iconHtml} from './icons.js';

// Mounted outside the application root so navigation preserves the draft.
const root=document.createElement('aside');
root.className='web-feedback';
root.innerHTML='<button class="nut" type="button" aria-expanded="false" aria-controls="web-feedback-panel">Góp ý</button><section id="web-feedback-panel" class="feedback-panel" aria-label="Góp ý website" hidden><header><strong>Góp ý website</strong><button class="nut tron" type="button" aria-label="Đóng góp ý" title="Đóng">'+iconHtml('close')+'</button></header><form><textarea class="truong" rows="4" minlength="5" maxlength="2000" required aria-label="Nội dung góp ý" placeholder="Lỗi anh/chị gặp, ý tưởng cải thiện…"></textarea><small>Gửi về quản trị viên. Vui lòng không ghi mật khẩu hoặc thông tin nhạy cảm.</small><div role="status" aria-live="polite"></div><button class="nut chinh" type="submit">Gửi góp ý</button></form></section>';
document.body.append(root);
const trigger=root.firstElementChild,panel=root.querySelector('section'),form=root.querySelector('form'),input=root.querySelector('textarea'),status=root.querySelector('[role=status]'),send=form.querySelector('button');
let sending=false;
function toggle(open){panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)input.focus();else trigger.focus();}
trigger.onclick=()=>toggle(panel.hidden);
panel.querySelector('header button').onclick=()=>toggle(false);
root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();toggle(false);}});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sending||!form.reportValidity())return;
  sending=true;send.disabled=true;input.readOnly=true;status.textContent='Đang gửi…';
  try{
    if(globalThis.G2G_DEMO_BYPASS)throw new Error('Bản demo không gửi email.');
    const response=await fetch(String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'')+'/actions/submitFeedback',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({message:input.value,page:location.pathname})});
    const result=await response.json();
    if(!response.ok)throw new Error(response.status===401?'Vui lòng đăng nhập để gửi góp ý.':result.error||'Chưa gửi được. Vui lòng thử lại.');
    input.value='';status.textContent='Đã gửi. Cảm ơn góp ý của bạn!';
  }catch(error){status.textContent=error.message||'Chưa gửi được. Nội dung của bạn vẫn được giữ lại.';}
  finally{sending=false;send.disabled=false;input.readOnly=false;}
});
