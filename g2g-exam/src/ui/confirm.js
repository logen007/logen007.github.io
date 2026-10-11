import {iconHtml} from './icons.js';
import {esc} from './format.js';
export function confirmAction(message,onConfirm,{confirmLabel='Tiếp tục',cancelLabel='Hủy',danger=false,confirmIcon= danger?'trash':'arrowRight',cancelIcon='close',extraAction=null}={}){
  document.getElementById('site-confirm')?.remove();
  const previousFocus=document.activeElement;
  const overlay=document.createElement('div');
  overlay.id='site-confirm';
  overlay.className='site-confirm-backdrop';
  overlay.innerHTML='<div class="site-confirm" role="alertdialog" aria-modal="true" aria-labelledby="site-confirm-message"><p id="site-confirm-message"></p><div class="site-confirm-actions"><button type="button" class="nut" data-confirm-cancel>Hủy</button><button type="button" class="nut chinh" data-confirm-accept></button></div></div>';
  overlay.querySelector('#site-confirm-message').textContent=message;
  overlay.querySelector('[data-confirm-cancel]').innerHTML=iconHtml(cancelIcon)+'<span>'+esc(cancelLabel)+'</span>';
  const accept=overlay.querySelector('[data-confirm-accept]');
  accept.innerHTML=iconHtml(confirmIcon)+'<span>'+esc(confirmLabel)+'</span>';
  if(danger)accept.classList.add('site-confirm-danger');
  const close=()=>{document.removeEventListener('keydown',onKeydown);overlay.remove();previousFocus?.focus?.();};
  const onKeydown=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
  overlay.querySelector('[data-confirm-cancel]').onclick=close;
  accept.onclick=()=>{close();onConfirm();};
  if(extraAction){
    const extra=document.createElement('button');
    extra.type='button';extra.className='text-link site-confirm-extra';
    extra.innerHTML=(extraAction.icon?iconHtml(extraAction.icon):'')+'<span>'+esc(extraAction.label)+'</span>';
    extra.onclick=()=>{close();extraAction.onClick();};
    overlay.querySelector('.site-confirm').append(extra);
  }
  overlay.onclick=event=>{if(event.target===overlay)close();};
  document.body.append(overlay);
  document.addEventListener('keydown',onKeydown);
  overlay.querySelector('[data-confirm-cancel]').focus();
}
