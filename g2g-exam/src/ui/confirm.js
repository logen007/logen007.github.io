import {iconHtml} from './icons.js';
import {esc} from './format.js';
let cancelActiveConfirmation=null;
export function confirmAction(message,onConfirm,{confirmLabel='Tiếp tục',cancelLabel='Hủy',danger=false,confirmIcon= danger?'trash':'arrowRight',cancelIcon='close',extraAction=null,details=[],onCancel=()=>{}}={}){
  cancelActiveConfirmation?.();
  const previousFocus=document.activeElement;
  const overlay=document.createElement('div');
  overlay.id='site-confirm';
  overlay.className='site-confirm-backdrop';
  overlay.innerHTML='<div class="site-confirm" role="alertdialog" aria-modal="true" aria-labelledby="site-confirm-message"><p id="site-confirm-message"></p><div class="site-confirm-actions"><button type="button" class="nut" data-confirm-cancel>Hủy</button><button type="button" class="nut chinh" data-confirm-accept></button></div></div>';
  overlay.querySelector('#site-confirm-message').textContent=message;
  if(details.length){
    const list=document.createElement('ul');list.className='site-confirm-details';list.id='site-confirm-details';
    for(const detail of details){const item=document.createElement('li');item.textContent=detail;list.append(item);}
    overlay.querySelector('#site-confirm-message').after(list);
    overlay.querySelector('[role="alertdialog"]').setAttribute('aria-describedby',list.id);
  }
  overlay.querySelector('[data-confirm-cancel]').innerHTML=iconHtml(cancelIcon)+'<span>'+esc(cancelLabel)+'</span>';
  const accept=overlay.querySelector('[data-confirm-accept]');
  accept.innerHTML=iconHtml(confirmIcon)+'<span>'+esc(confirmLabel)+'</span>';
  if(danger)accept.classList.add('site-confirm-danger');
  let closed=false;
  const close=()=>{if(closed)return false;closed=true;cancelActiveConfirmation=null;document.removeEventListener('keydown',onKeydown);document.removeEventListener('focusin',onFocus);overlay.remove();
    const target=previousFocus?.disabled?previousFocus.closest?.('[role="dialog"]')?.querySelector('input:not(:disabled),button:not(:disabled)'):previousFocus;
    target?.focus?.();return true;};
  const cancel=()=>{if(close())onCancel();};
  const onFocus=event=>{if(!overlay.contains(event.target))overlay.querySelector('[data-confirm-cancel]').focus();};
  const onKeydown=event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation?.();cancel();return;}
    if(event.key!=='Tab')return;
    const buttons=[...overlay.querySelectorAll('button')].filter(button=>!button.disabled&&!button.hidden);
    const first=buttons[0],last=buttons.at(-1),active=document.activeElement;
    if(!overlay.contains(active)||(event.shiftKey?active===first:active===last)){
      event.preventDefault();(event.shiftKey?last:first)?.focus();
    }
  };
  overlay.querySelector('[data-confirm-cancel]').onclick=cancel;
  accept.onclick=()=>{if(close())onConfirm();};
  if(extraAction){
    const extra=document.createElement('button');
    extra.type='button';extra.className='text-link site-confirm-extra';
    extra.innerHTML=(extraAction.icon?iconHtml(extraAction.icon):'')+'<span>'+esc(extraAction.label)+'</span>';
    extra.onclick=()=>{if(close())extraAction.onClick();};
    overlay.querySelector('.site-confirm').append(extra);
  }
  overlay.onclick=event=>{if(event.target===overlay)cancel();};
  document.body.append(overlay);
  document.addEventListener('keydown',onKeydown);
  document.addEventListener('focusin',onFocus);
  cancelActiveConfirmation=cancel;
  overlay.querySelector('[data-confirm-cancel]').focus();
}

export function confirmNameChange(name,{role}={}){
  const warning=role==='master'?'':' Sau khi đổi, bạn phải chờ 30 ngày mới có thể đổi tên tiếp.';
  return new Promise(resolve=>confirmAction(`Đổi tên thành “${name}”?${warning}`,()=>resolve(true),{
    confirmLabel:'Xác nhận đổi tên',confirmIcon:'grading',onCancel:()=>resolve(false)
  }));
}
