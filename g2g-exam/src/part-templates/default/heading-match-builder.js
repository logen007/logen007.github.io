import {esc} from '../../ui/format.js';
import {updateQuestion,updateSection} from '../../core.js';

export function headingMatchBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'';
  return `<div class="goethe-questions">${questions.map((q,index)=>`<article class="goethe-question part-question" data-editor-mode="heading-match" data-question-id="${esc(q.id)}"><input class="truong" data-heading-answer aria-label="Tiêu đề đúng câu ${index+1}" placeholder="Tiêu đề đúng" value="${esc(section.headingOptions?.[q.correctAnswer]||'')}" ${disabled}><textarea class="truong" data-heading-text aria-label="Đoạn văn ${index+1}" placeholder="Đoạn văn ${index+1}" ${disabled}>${esc(q.title==='Nháp'?'':q.title)}</textarea><span class="phu-de">${q.maxScore} điểm</span></article>`).join('')}</div>`;
}

// Shuffle once, then recover the order only from private answer keys. Never
// derive correct mappings from public section/question IDs or passage order.
export function headingOrder(section,questions,random=Math.random){
  const ids=[...section.questionIds];
  const keys=new Map(questions.map(q=>[q.id,q.correctAnswer]));
  if(section.headingOptions?.length===ids.length&&new Set(ids.map(id=>keys.get(id))).size===ids.length&&ids.every(id=>Number.isInteger(keys.get(id))&&keys.get(id)>=0&&keys.get(id)<ids.length))return ids.sort((a,b)=>keys.get(a)-keys.get(b));
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  return ids;
}

export function saveHeadingMatchDraft(root,state,user,exam,section){
  if(section.questionProfile?.layout!=='heading-match')return;
  const cards=[...root.querySelectorAll('[data-editor-mode="heading-match"]')];
  const fields=new Map(cards.map(card=>[card.dataset.questionId,{answer:card.querySelector('[data-heading-answer]').value.trim(),text:card.querySelector('[data-heading-text]').value.trim()}]));
  const order=headingOrder(section,state.questions),choices=order.map((_,i)=>String.fromCharCode(65+i));
  updateSection(state,user,exam.id,section.id,{headingOptions:order.map(id=>fields.get(id)?.answer||'')});
  section.questionIds.forEach(id=>updateQuestion(state,user,id,{title:fields.get(id)?.text||'Nháp',choices,correctAnswer:order.indexOf(id),maxScore:section.questionProfile.defaultScore,example:false}));
}
