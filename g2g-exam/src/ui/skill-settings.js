import {esc} from './format.js';
import {effectiveAudioPolicy} from '../domain/part-audio.js';

export function audioFlowFields(section){
  const repeated=Number(effectiveAudioPolicy(section).segmentRepeat)>1;
  return `<div class="audio-flow-row"><span>${esc(section.name)}</span><button type="button" class="nut nho ${repeated?'chinh':''}" data-flow-toggle="${esc(section.id)}" aria-label="${esc(section.name)}: lặp 1 lần" aria-pressed="${repeated}">${repeated?'Lặp 1 lần':'Không lặp'}</button></div>`;
}
export function openSkillSettings({exam,skill,onSave}){
  const sections=exam.sections.filter(s=>s.skill===skill),listening=sections.filter(s=>s.skillKey==='listening');
  const drafts=new Map(listening.map(s=>[s.id,{segmentRepeat:Number(effectiveAudioPolicy(s).segmentRepeat)>1?2:1}]));
  let busy=false;
  const previousFocus=document.activeElement,modal=document.createElement('div');
  modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop exam-setup" role="dialog" aria-modal="true" aria-labelledby="skillSettingsTitle"><div class="dau-hop"><h2 id="skillSettingsTitle">${esc(skill)}</h2><button class="nut nho" data-dismiss aria-label="Đóng">×</button></div><div class="exam-setup-grid"><label>Thời gian (phút)<input id="skillTimeMinutes" type="number" min="1" required value="${Number(exam.settings?.skillSettings?.[skill]?.timeMinutes??sections[0]?.timeMinutes??20)}"></label></div>${listening.length?'<div class="audio-flow-settings"><div data-flow-panel></div></div>':''}<p data-error class="dashboard-warning" role="alert" hidden></p><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-dismiss>Hủy</button><button class="nut chinh" data-save>Lưu</button></div></div></section>`;
  const close=()=>{if(busy)return;modal.remove();previousFocus?.focus();};
  modal.querySelectorAll('[data-dismiss]').forEach(button=>button.onclick=close);
  const draw=()=>{
    const panel=modal.querySelector('[data-flow-panel]');if(!panel)return;
    panel.innerHTML=listening.map(section=>audioFlowFields({...section,audioFlow:drafts.get(section.id)})).join('');
    panel.querySelectorAll('[data-flow-toggle]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.flowToggle;
      drafts.set(id,{segmentRepeat:drafts.get(id).segmentRepeat===2?1:2});
      draw();[...panel.querySelectorAll('[data-flow-toggle]')].find(item=>item.dataset.flowToggle===id)?.focus();
    });
  };
  modal.querySelector('[data-save]').onclick=async()=>{
    const time=modal.querySelector('#skillTimeMinutes');if(!time.reportValidity())return;
    busy=true;modal.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
    try{await onSave({timeMinutes:Number(time.value),flows:drafts});busy=false;close();}
    catch(error){const message=modal.querySelector('[data-error]');message.hidden=false;message.textContent=error.message;busy=false;modal.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
  };
  modal.onkeydown=event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  };
  document.body.append(modal);draw();modal.querySelector('[data-dismiss]').focus();
}
