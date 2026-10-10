import {esc} from './format.js';

export function publishErrorsHtml(error){
  const messages=error?.validationErrors||[error?.message||'Không nhận được phản hồi từ máy chủ. Kiểm tra kết nối rồi thử lại.'];
  return `<div class="noi-hop" role="dialog" aria-modal="true" aria-labelledby="publishErrorTitle"><h2 id="publishErrorTitle">Chưa thể xuất bản đề</h2><p>Sửa các mục dưới đây rồi bấm Xuất bản lại.</p><ul class="publish-error-list">${messages.map(message=>`<li>${esc(message)}</li>`).join('')}</ul><div class="chan-hop"><button class="nut chinh" data-close>Quay lại sửa</button></div></div>`;
}

export function showPublishErrors(error){
  const previous=document.activeElement;
  const modal=document.createElement('div');modal.className='hop-chon';modal.innerHTML=publishErrorsHtml(error);
  const close=()=>{modal.remove();previous?.focus();};
  modal.querySelector('[data-close]').onclick=close;
  modal.onkeydown=event=>{if(event.key==='Escape')close();if(event.key==='Tab'){event.preventDefault();modal.querySelector('[data-close]').focus();}};
  document.body.append(modal);modal.querySelector('[data-close]').focus();
}
