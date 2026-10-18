// Shared keyboard behavior for existing non-native overlays; does not rebuild
// forms, clear drafts or change their submit handlers.
export function bindDialogKeyboard(modal,{required=false,onDismiss=()=>{},returnFocus=document.activeElement}={}){
  let dismissed=false;
  const dismiss=()=>{
    if(dismissed)return;dismissed=true;modal.remove();
    // Account-menu items become hidden before a profile dialog opens. Restore
    // their controlling avatar instead of trying to focus that hidden item.
    const hidden=returnFocus?.closest?.('[hidden],.an');
    const target=hidden?.id?[...document.querySelectorAll('[aria-controls]')].find(item=>item.getAttribute('aria-controls')===hidden.id):returnFocus;
    target?.focus?.();onDismiss();
  };
  modal.querySelectorAll('[data-dismiss],[data-close]').forEach(button=>button.addEventListener('click',dismiss));
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!required){event.preventDefault();event.stopPropagation();dismiss();return;}
    if(event.key!=='Tab')return;
    const nodes=[...modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(item=>!item.matches(':disabled,[type="hidden"]')&&!item.hidden&&item.tabIndex>=0&&!item.closest('.an,[hidden]'));
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  return dismiss;
}
