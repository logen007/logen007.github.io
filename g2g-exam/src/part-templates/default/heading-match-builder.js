import {iconHtml} from '../../ui/icons.js';
import {esc} from '../../ui/format.js';
import {updateQuestion,updateSection} from '../../core.js';

export function resizeHeadingOptions(state,user,examId,sectionId,action,index){
  const exam=state.exams.find(exam=>exam.id===examId),section=exam?.sections.find(section=>section.id===sectionId);
  if(section?.questionProfile?.layout!=='heading-match')return;
  const options=[...(section.headingOptions||[])];
  if(!Number.isInteger(index)||index<0||index>=options.length)return;
  if(action==='add'){if(options.length>=26)return;options.splice(index+1,0,'');}
  else if(action==='remove'){if(options.length<=section.questionLimit)return;options.splice(index,1);}
  else return;
  updateSection(state,user,examId,sectionId,{headingOptions:options});
  const choices=options.map((_,i)=>String.fromCharCode(65+i));
  for(const id of section.questionIds){
    const q=state.questions.find(q=>q.id===id);if(!q)continue;
    const old=Number(q.correctAnswer);
    const correctAnswer=action==='add'?(old>index?old+1:old):(old===index?-1:old>index?old-1:old);
    updateQuestion(state,user,id,{choices,correctAnswer});
  }
}

export function headingMatchBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'',choices=Array.from({length:section.headingOptions?.length||section.questionProfile.choices.length},(_,i)=>String.fromCharCode(65+i));
  const bank=choices.map((letter,i)=>`<div class="heading-option-row"><b>${letter.toLowerCase()}</b><input class="truong" data-heading-option="${i}" aria-label="Đáp án ${letter.toLowerCase()}" placeholder="Đáp án ${letter.toLowerCase()}" value="${esc(section.headingOptions?.[i]||'')}" ${disabled}><button type="button" class="icon-btn" data-heading-remove="${i}" aria-label="Bỏ đáp án ${letter.toLowerCase()}" title="Bỏ đáp án" ${readOnly||choices.length<=section.questionLimit?'disabled':''}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-heading-add="${i}" aria-label="Thêm đáp án bên dưới" title="Thêm đáp án" ${readOnly||choices.length>=26?'disabled':''}>${iconHtml('plus')}</button></div>`).join('');
  return `<div class="gap-options-editor" data-heading-bank data-count="${choices.length}">${bank}</div><div class="goethe-questions">${questions.map((q,index)=>`<article class="goethe-question part-question" data-editor-mode="heading-match" data-question-id="${esc(q.id)}"><textarea class="truong" data-heading-text aria-label="Đoạn văn ${index+1}" placeholder="Đoạn văn ${index+1}" ${disabled}>${esc(q.title==='Nháp'?'':q.title)}</textarea><label>Đáp án đúng<select class="truong" data-heading-answer aria-label="Đáp án đúng câu ${index+1}" ${disabled}><option value="-1" ${Number(q.correctAnswer)<0?'selected':''}>Chọn đáp án</option>${choices.map((letter,i)=>`<option value="${i}" ${Number(q.correctAnswer)===i?'selected':''}>${letter.toLowerCase()}</option>`).join('')}</select></label><span class="phu-de">${q.maxScore} điểm</span></article>`).join('')}</div>`;
}

export function saveHeadingMatchDraft(root,state,user,exam,section){
  if(section.questionProfile?.layout!=='heading-match')return;
  const count=Number(root.querySelector('[data-heading-bank]')?.dataset?.count)||section.questionProfile.choices.length;
  const choices=Array.from({length:count},(_,i)=>String.fromCharCode(65+i));
  const cards=[...root.querySelectorAll('[data-editor-mode="heading-match"]')];
  updateSection(state,user,exam.id,section.id,{headingOptions:choices.map((_,i)=>root.querySelector(`[data-heading-option="${i}"]`)?.value.trim()||'')});
  for(const card of cards)updateQuestion(state,user,card.dataset.questionId,{
    title:card.querySelector('[data-heading-text]').value.trim()||'Nháp',
    choices,correctAnswer:Number(card.querySelector('[data-heading-answer]').value),
    maxScore:section.questionProfile.defaultScore,example:false
  });
}
