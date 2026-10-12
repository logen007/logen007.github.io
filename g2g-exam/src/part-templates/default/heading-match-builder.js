import {esc} from '../../ui/format.js';
import {updateQuestion,updateSection} from '../../core.js';

export function headingMatchBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'',choices=section.questionProfile.choices;
  const bank=choices.map((letter,i)=>`<label class="gap-option"><b>${letter.toLowerCase()}</b><input class="truong" data-heading-option="${i}" aria-label="Đáp án ${letter.toLowerCase()}" placeholder="Đáp án ${letter.toLowerCase()}" value="${esc(section.headingOptions?.[i]||'')}" ${disabled}></label>`).join('');
  return `<div class="gap-options-editor">${bank}</div><div class="goethe-questions">${questions.map((q,index)=>`<article class="goethe-question part-question" data-editor-mode="heading-match" data-question-id="${esc(q.id)}"><textarea class="truong" data-heading-text aria-label="Đoạn văn ${index+1}" placeholder="Đoạn văn ${index+1}" ${disabled}>${esc(q.title==='Nháp'?'':q.title)}</textarea><label>Đáp án đúng<select class="truong" data-heading-answer aria-label="Đáp án đúng câu ${index+1}" ${disabled}>${choices.map((letter,i)=>`<option value="${i}" ${Number(q.correctAnswer)===i?'selected':''}>${letter.toLowerCase()}</option>`).join('')}</select></label><span class="phu-de">${q.maxScore} điểm</span></article>`).join('')}</div>`;
}

export function saveHeadingMatchDraft(root,state,user,exam,section){
  if(section.questionProfile?.layout!=='heading-match')return;
  const choices=section.questionProfile.choices;
  const cards=[...root.querySelectorAll('[data-editor-mode="heading-match"]')];
  updateSection(state,user,exam.id,section.id,{headingOptions:choices.map((_,i)=>root.querySelector(`[data-heading-option="${i}"]`)?.value.trim()||'')});
  for(const card of cards)updateQuestion(state,user,card.dataset.questionId,{
    title:card.querySelector('[data-heading-text]').value.trim()||'Nháp',
    choices,correctAnswer:Number(card.querySelector('[data-heading-answer]').value),
    maxScore:section.questionProfile.defaultScore,example:false
  });
}
