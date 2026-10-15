import {iconHtml} from './icons.js';
import {esc} from './format.js';

export function openSkillSettings({exam,skill,onSave}){
  const sections=exam.sections.filter(s=>s.skill===skill);
  let busy=false;
  const previousFocus=document.activeElement,modal=document.createElement('div');
  modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop exam-setup skill-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="skillSettingsTitle"><div class="dau-hop"><h2 id="skillSettingsTitle">${esc(skill)}</h2><button class="nut nho" data-dismiss aria-label="Đóng">${iconHtml('close')}</button></div><div class="exam-setup-grid skill-time-row"><label for="skillTimeMinutes">Thời gian</label><div class="skill-time-control"><input id="skillTimeMinutes" type="number" aria-label="Thời gian (phút)" min="1" required value="${Number(exam.settings?.skillSettings?.[skill]?.timeMinutes??sections[0]?.timeMinutes??20)}"><span>phút</span></div></div><p data-error class="dashboard-warning" role="alert" hidden></p><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-dismiss>Hủy</button><button class="nut chinh" data-save>Lưu</button></div></div></section>`;
  const close=()=>{if(busy)return;modal.remove();previousFocus?.focus();};
  modal.querySelectorAll('[data-dismiss]').forEach(button=>button.onclick=close);
  modal.querySelector('[data-save]').onclick=async()=>{
    const time=modal.querySelector('#skillTimeMinutes');if(!time.reportValidity())return;
    busy=true;modal.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
    try{await onSave({timeMinutes:Number(time.value)});busy=false;close();}
    catch(error){const message=modal.querySelector('[data-error]');message.hidden=false;message.textContent=error.message;busy=false;modal.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
  };
  modal.onkeydown=event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  };
  document.body.append(modal);modal.querySelector('[data-dismiss]').focus();
}
