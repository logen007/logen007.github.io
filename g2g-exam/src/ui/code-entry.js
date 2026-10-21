import {iconHtml} from './icons.js';

export function codeEntryHtml(kind){
  const label=kind==='class'?'Nhập mã lớp':'Nhập mã đề',id=`inline-${kind}-code`;
  return `<form class="inline-code-entry" data-code-entry="${kind}"><div class="inline-code-control"><input id="${id}" name="code" type="text" required minlength="5" maxlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${label}" placeholder="${kind==='class'?'Mã lớp':'Mã đề'}" aria-describedby="${id}-error"><button class="icon-btn" type="submit" aria-label="Xác nhận ${kind==='class'?'mã lớp':'mã đề'}">${iconHtml('arrowRight')}</button></div><small id="${id}-error" data-code-error role="alert" hidden></small></form>`;
}
export function bindCodeEntry(root,kind,onSubmit){
  const form=root.querySelector(`[data-code-entry="${kind}"]`);if(!form||form.dataset.bound)return;form.dataset.bound='true';
  const input=form.elements.code,button=form.querySelector('button'),error=form.querySelector('[data-code-error]');
  input.addEventListener('input',()=>{error.textContent='';error.hidden=true;});
  form.onsubmit=async event=>{
    event.preventDefault();if(button.disabled)return;
    const code=input.value.trim().toUpperCase();
    if(!/^[A-Z0-9]{5}$/.test(code)){error.textContent='Nhập mã gồm 5 chữ cái hoặc số.';error.hidden=false;input.focus();return;}
    input.value=code;button.disabled=true;button.setAttribute('aria-busy','true');
    try{await onSubmit(code,button);}catch(issue){error.textContent=issue.message||'Chưa xác nhận được mã. Anh thử lại.';error.hidden=false;}
    finally{button.disabled=false;button.removeAttribute('aria-busy');}
  };
}
