import {esc} from './format.js';
import {effectiveAudioPolicy,partAudioSegments,normalizeAudioFlow} from '../domain/part-audio.js';

export function audioFlowValues(section){
  const p=effectiveAudioPolicy(section);
  return {source:p.questionsPerSegment===2?'pair':p.sharedPart?'part':'question',segmentRepeat:p.segmentRepeat||1,instructionRepeat:p.instructionRepeat||1,exampleRepeat:p.exampleRepeat||1,repeatOrder:p.repeatOrder||'consecutive'};
}
export function audioFlowPreview(section,questions){
  const plan=partAudioSegments(section,questions);
  return plan.flatMap(segment=>Array.from({length:segment.repeat},()=>segment.label==='Aufgabenstellung'?'Đề bài':segment.label==='Beispiel'?'Ví dụ':segment.label==='Hörtext'?'Cả bài':segment.label.replace('Aufgabe ',effectiveAudioPolicy(section).questionsPerSegment===2?'Cặp ':'Câu '))).join(' → ')||'Chưa có audio.';
}
const field=(key,label,values,current)=>`<label>${label}<select data-flow="${key}">${values.map(([value,text])=>`<option value="${value}" ${String(value)===String(current)?'selected':''}>${text}</option>`).join('')}</select></label>`;
export function audioFlowFields(section,questions){
  const p=audioFlowValues(section),repeats=[1,2,3].map(n=>[n,n+' lần']);
  return `<div class="exam-setup-grid audio-flow-fields">${field('source','Audio', [['question','Từng câu'],['pair','Từng cặp câu'],['part','Chung cả bài']],p.source)}${field('segmentRepeat','Phát bài nghe',repeats,p.segmentRepeat)}${field('instructionRepeat','Đề bài',repeats,p.instructionRepeat)}${field('exampleRepeat','Ví dụ',repeats,p.exampleRepeat)}${p.source!=='part'&&p.segmentRepeat>1?field('repeatOrder','Cách lặp',[['consecutive','Lặp từng đoạn'],['round','Hết bài rồi lặp']],p.repeatOrder):''}</div><p class="audio-flow-preview" aria-live="polite">${esc(audioFlowPreview(section,questions))}</p>`;
}
export function openSkillSettings({exam,skill,questions,onSave}){
  const sections=exam.sections.filter(s=>s.skill===skill),listening=sections.filter(s=>s.skillKey==='listening');
  const drafts=new Map(listening.map(s=>[s.id,s.audioFlow?{...s.audioFlow}:null]));
  let selected=listening[0]?.id,busy=false;
  const previousFocus=document.activeElement,modal=document.createElement('div');
  modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop exam-setup" role="dialog" aria-modal="true" aria-labelledby="skillSettingsTitle"><div class="dau-hop"><h2 id="skillSettingsTitle">${esc(skill)}</h2><button class="nut nho" data-dismiss aria-label="Đóng">×</button></div><div class="exam-setup-grid"><label>Thời gian (phút)<input id="skillTimeMinutes" type="number" min="1" required value="${Number(exam.settings?.skillSettings?.[skill]?.timeMinutes??sections[0]?.timeMinutes??20)}"></label></div>${listening.length?'<div class="audio-flow-settings"><div class="audio-flow-heading"><h3>Luồng phát</h3><button class="text-link" data-reset>Mặc định</button></div><div class="audio-flow-tabs" role="group" aria-label="Bài nghe"></div><div data-flow-panel></div></div>':''}<p data-error class="dashboard-warning" role="alert" hidden></p><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-dismiss>Hủy</button><button class="nut chinh" data-save>Lưu</button></div></div></section>`;
  const close=()=>{if(busy)return;modal.remove();previousFocus?.focus();};
  modal.querySelectorAll('[data-dismiss]').forEach(button=>button.onclick=close);
  const draw=()=>{
    const section=listening.find(s=>s.id===selected);if(!section)return;
    const current={...section,audioFlow:drafts.get(selected)},rows=(section.questionIds||[]).map(id=>questions.find(q=>q.id===id)).filter(Boolean);
    const tabs=modal.querySelector('.audio-flow-tabs');
    tabs.innerHTML=listening.map(s=>`<button class="nut nho ${s.id===selected?'chinh':''}" aria-pressed="${s.id===selected}" data-part="${esc(s.id)}">${esc(s.name)}</button>`).join('');
    tabs.querySelectorAll('[data-part]').forEach(button=>button.onclick=()=>{selected=button.dataset.part;draw();});
    const panel=modal.querySelector('[data-flow-panel]');
    panel.innerHTML=audioFlowFields(current,rows);
    panel.querySelectorAll('[data-flow]').forEach(input=>input.onchange=()=>{
      const values={...audioFlowValues(current),[input.dataset.flow]:input.value};
      drafts.set(selected,normalizeAudioFlow(values));
      const key=input.dataset.flow;draw();panel.querySelector(`[data-flow="${key}"]`)?.focus();
    });
  };
  modal.querySelector('[data-reset]')?.addEventListener('click',()=>{drafts.set(selected,null);draw();});
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
