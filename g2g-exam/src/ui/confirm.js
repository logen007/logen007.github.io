export function confirmAction(message,onConfirm,{confirmLabel='Tiếp tục',cancelLabel='Hủy',danger=false}={}){
  document.getElementById('site-confirm')?.remove();
  const previousFocus=document.activeElement;
  const overlay=document.createElement('div');
  overlay.id='site-confirm';
  overlay.className='site-confirm-backdrop';
  overlay.innerHTML='<div class="site-confirm" role="alertdialog" aria-modal="true" aria-labelledby="site-confirm-message"><p id="site-confirm-message"></p><div class="site-confirm-actions"><button type="button" class="nut" data-confirm-cancel>Hủy</button><button type="button" class="nut chinh" data-confirm-accept></button></div></div>';
  overlay.querySelector('#site-confirm-message').textContent=message;
  overlay.querySelector('[data-confirm-cancel]').textContent=cancelLabel;
  const accept=overlay.querySelector('[data-confirm-accept]');
  accept.textContent=confirmLabel;
  if(danger)accept.classList.add('site-confirm-danger');
  const close=()=>{document.removeEventListener('keydown',onKeydown);overlay.remove();previousFocus?.focus?.();};
  const onKeydown=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
  overlay.querySelector('[data-confirm-cancel]').onclick=close;
  accept.onclick=()=>{close();onConfirm();};
  overlay.onclick=event=>{if(event.target===overlay)close();};
  document.body.append(overlay);
  document.addEventListener('keydown',onKeydown);
  overlay.querySelector('[data-confirm-cancel]').focus();
}
