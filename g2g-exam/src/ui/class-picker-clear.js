import {iconHtml} from './icons.js';

export function bindClassPickerClear(root){
  root.querySelectorAll('input[name="classCode"][list]').forEach(input=>{
    if(input.parentElement.classList.contains('class-picker-field'))return;
    const wrapper=document.createElement('span'),button=document.createElement('button');
    wrapper.className='class-picker-field';
    input.before(wrapper);wrapper.append(input);
    button.type='button';button.className='icon-btn class-picker-clear';
    button.title='Bỏ chọn lớp';button.setAttribute('aria-label','Bỏ chọn lớp');
    button.innerHTML=iconHtml('close');wrapper.append(button);
    const sync=()=>{button.hidden=Boolean(!input.value||input.disabled||input.readOnly);};
    input.addEventListener('input',sync);input.addEventListener('change',sync);
    button.addEventListener('click',event=>{
      event.preventDefault();
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.focus({preventScroll:true});
    });
    sync();
  });
}
