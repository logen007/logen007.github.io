import {scoreInput} from '../../ui/score-input.js';
import {buildGapBank,splitGapBank} from '../../domain/gap-bank.js';
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

export function headingMatchBuilder(section,questions,readOnly,numbers=new Map()){
  const disabled=readOnly?'disabled':'',choices=Array.from({length:section.headingOptions?.length||section.questionProfile.choices.length},(_,i)=>String.fromCharCode(65+i));
  const bank=splitGapBank({gapOptions:section.headingOptions},questions);
  return `<div class="goethe-questions">${questions.map((q,index)=>`<article class="goethe-question part-question" data-editor-mode="heading-match" data-question-id="${esc(q.id)}"><textarea class="truong" data-heading-text aria-label="Đoạn văn ${numbers.get(q.id)??index+1}" placeholder="Đoạn văn ${numbers.get(q.id)??index+1}" ${disabled}>${esc(q.title==='Nháp'?'':q.title)}</textarea><div class="heading-answer-row"><input class="truong" data-heading-correct-text aria-label="Đáp án đúng câu ${numbers.get(q.id)??index+1}" placeholder="Đáp án đúng" value="${esc(bank.answers[index])}" ${disabled}>${scoreInput(q.maxScore,{attributes:"data-heading-score",label:"Điểm câu "+(numbers.get(q.id)??index+1),disabled:readOnly})}<button type="button" class="icon-btn" data-action="remove-inline-question" data-id="${esc(q.id)}" aria-label="Bỏ câu" ${readOnly||questions.length<=1?'disabled':''}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-action="add-inline-question" data-after="${esc(q.id)}" aria-label="Thêm câu bên dưới" ${disabled}>${iconHtml('plus')}</button></div></article>`).join('')}</div><label class="gap-distractors"><strong>Đáp án nhiễu</strong><textarea class="truong" data-heading-distractors aria-label="Đáp án nhiễu" placeholder="Mỗi dòng một đáp án nhiễu" ${disabled}>${esc(bank.distractors.join('\n'))}</textarea></label>`;

}

export function saveHeadingMatchDraft(root,state,user,exam,section){
  if(section.questionProfile?.layout!=='heading-match')return;
  const count=Number(root.querySelector('[data-heading-bank]')?.dataset?.count)||section.questionProfile.choices.length;
  let choices=Array.from({length:count},(_,i)=>String.fromCharCode(65+i));
  const cards=[...root.querySelectorAll('[data-editor-mode="heading-match"]')];
  const noise=root.querySelector('[data-heading-distractors]');
  const bank=noise?buildGapBank(cards.map(card=>card.querySelector('[data-heading-correct-text]')?.value||''),noise.value,26):null;
  if(bank)choices=bank.options.map((_,i)=>String.fromCharCode(65+i));
  for(const card of cards){const score=card.querySelector('[data-heading-score]');if(score&&(!score.value.trim()||!Number.isFinite(Number(score.value))||Number(score.value)<0))throw new Error('Nhập điểm hợp lệ, lớn hơn hoặc bằng 0.');}
  updateSection(state,user,exam.id,section.id,{headingOptions:bank?bank.options:choices.map((_,i)=>root.querySelector(`[data-heading-option="${i}"]`)?.value.trim()||'')});
  for(const card of cards){
    const score=card.querySelector('[data-heading-score]');
    if(score&&(!score.value.trim()||!Number.isFinite(Number(score.value))||Number(score.value)<0))throw new Error('Nhập điểm hợp lệ, lớn hơn hoặc bằng 0.');
    updateQuestion(state,user,card.dataset.questionId,{
    title:card.querySelector('[data-heading-text]').value.trim()||'Nháp',
    choices,correctAnswer:bank?bank.correct[cards.indexOf(card)]:Number(card.querySelector('[data-heading-answer]').value),
    ...(score?{maxScore:Number(score.value)}:{}),example:false
    });
  }
}
