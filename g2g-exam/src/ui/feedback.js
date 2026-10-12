import {optimizeExamImage} from './image-optimize.js';
import {iconHtml} from './icons.js';

// Mounted outside the application root so navigation preserves the draft.
const root=document.createElement('aside');
root.className='web-feedback';
root.hidden=true;
root.innerHTML='<button class="feedback-tab" aria-label="Báo lỗi" type="button" aria-expanded="false" aria-controls="web-feedback-panel"><span class="feedback-question" aria-hidden="true">?</span><span class="feedback-tab-label">Góp ý</span></button><section id="web-feedback-panel" class="feedback-panel" aria-label="Báo lỗi" hidden><header><strong>Báo lỗi</strong><button class="icon-btn" type="button" aria-label="Đóng góp ý" title="Đóng">'+iconHtml('close')+'</button></header><form><textarea class="truong" rows="4" minlength="5" maxlength="2000" required aria-label="Nội dung góp ý" placeholder="Bạn gặp vấn đề gì? Chia sẻ với chúng mình nhé…"></textarea><div class="feedback-attachment"><button class="nut feedback-image-control" type="button">'+iconHtml('image')+'<span>Thêm ảnh</span></button><input type="file" hidden data-image-picker-direct accept="image/png,image/jpeg,image/webp" aria-label="Ảnh góp ý"></div><div class="feedback-image-preview" hidden><img alt="Ảnh đính kèm"><button class="nut tron" type="button" aria-label="Bỏ ảnh" title="Bỏ ảnh">×</button></div><div role="status" aria-live="polite"></div><button class="nut chinh" type="submit">'+iconHtml('arrowRight')+'<span>Gửi góp ý</span></button></form></section>';
document.body.append(root);
const trigger=root.firstElementChild,panel=root.querySelector('section'),form=root.querySelector('form'),input=root.querySelector('textarea'),status=root.querySelector('[role=status]'),send=form.querySelector('[type=submit]');
let sending=false,processing=false,image=null;
const fileInput=root.querySelector('[type=file]'),preview=root.querySelector('.feedback-image-preview'),remove=preview.querySelector('button');
function clearImage(){image=null;fileInput.value='';preview.hidden=true;preview.querySelector('img').removeAttribute('src');}
async function attach(file){
  if(!file||sending||processing)return;
  processing=true;send.disabled=true;status.textContent='Đang xử lý ảnh…';
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Chọn ảnh JPG, PNG hoặc WebP dưới 8 MB.');
    const optimized=await optimizeExamImage(file);
    if(optimized.size>600*1024)throw new Error('Ảnh sau nén còn lớn. Hãy cắt vùng cần góp ý rồi thử lại (tối đa 600 KB).');
    const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));reader.readAsDataURL(optimized);});
    image=encoded;preview.querySelector('img').src=image;preview.hidden=false;status.textContent='';
  }catch(error){status.textContent=error.message;}
  finally{processing=false;send.disabled=false;fileInput.value='';}
}
root.querySelector('.feedback-image-control').onclick=()=>fileInput.click();
export function updateFeedbackUser(user){
  const allowed=Boolean(user?.id&&['teacher','student'].includes(user.role)&&!user.canTestRoles);
  if(!allowed){panel.hidden=true;root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');input.value='';clearImage();status.textContent='';}
  root.hidden=!allowed;
}
fileInput.addEventListener('change',()=>attach(fileInput.files?.[0]));
remove.onclick=()=>{if(!sending&&!processing)clearImage();};
panel.addEventListener('paste',event=>{
  const file=[...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile();
  if(file){event.preventDefault();event.stopPropagation();attach(file);}
});
function toggle(open){panel.hidden=!open;root.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));if(open)input.focus();else trigger.focus();}
trigger.onclick=()=>toggle(panel.hidden);
panel.querySelector('header button').onclick=()=>toggle(false);
root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();toggle(false);}});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sending||processing||!form.reportValidity())return;
  sending=true;send.disabled=true;input.readOnly=true;status.textContent='Đang gửi…';
  try{
    if(globalThis.G2G_DEMO_BYPASS)throw new Error('Bản demo không gửi email.');
    const response=await fetch(String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'')+'/actions/submitFeedback',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({message:input.value,page:location.pathname,image})});
    const result=await response.json();
    if(!response.ok)throw new Error(response.status===401?'Vui lòng đăng nhập để gửi góp ý.':result.error||'Chưa gửi được. Vui lòng thử lại.');
    input.value='';clearImage();status.textContent='Đã gửi. Cảm ơn góp ý của bạn!';
  }catch(error){status.textContent=error.message||'Chưa gửi được. Nội dung của bạn vẫn được giữ lại.';}
  finally{sending=false;send.disabled=false;input.readOnly=false;}
});
