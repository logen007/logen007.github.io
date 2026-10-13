import {isPrefilledQuestion} from '../domain/question-display.js';
import {textHtml,esc} from './format.js';
import {choiceLetter,letterAnswerError} from '../domain/letter-answers.js';
import {bindLetterPicker,syncLetterPicker,selectedLetterLabel} from './letter-picker.js';

export function letterAnswerControl(q,answer,layout,{number=null,optionTexts=null,fullSelection=false,nativeText=false}={}){
  const value=isPrefilledQuestion(q)?q.correctAnswer:answer,letter=value==null||value===''?'':choiceLetter(q.choices?.[Number(value)]);
  if(isPrefilledQuestion(q))return `<span class="letter-example">${esc(letter.toLowerCase())}</span>`;
  const selectedText=value==null||value===''?String(number??'—'):`${letter.toLowerCase()}. ${optionTexts?.[Number(value)]||''}`.trim();
  const attrs=`data-letter-answer ${fullSelection?`data-full-selection="true" data-question-number="${esc(number??'')}" `:''}data-q="${esc(q.id)}" aria-label="Antwort: ${esc(number??q.title)}"`;
  if(layout==='letter-table'||layout==='letter-select')return `<select id="letter-${esc(q.id)}" class="truong${nativeText?' inline-gap-native-text':''}"  ${attrs} ${optionTexts?'data-option-texts':''} ${!nativeText&&optionTexts&&(fullSelection||optionTexts.some(text=>String(text||'').trim().length>40))?'data-full-options':''}><option value="">${fullSelection?'Überschrift wählen':number==null?'—':esc(number)}</option>${(q.choices||[]).map((choice,i)=>{const key=choiceLetter(choice).toLowerCase(),text=String(optionTexts?.[i]||'').replace(/\[\/?b\]/gi,'').trim();return `<option value="${i}" data-letter="${esc(key)}"${text&&[...text].length<=24?` data-short-text="${esc(text)}"`:''} ${String(value)===String(i)?'selected':''}>${esc(text?`${key}. ${text}`:key)}</option>`;}).join('')}</select>${optionTexts?`<span class="inline-gap-value" aria-hidden="true">${esc(nativeText?selectedText:letter.toLowerCase()||(fullSelection?'Überschrift wählen':number)||'—')}</span>`:''}`;
  return `<input ${attrs} maxlength="1" autocomplete="off" autocapitalize="characters" value="${esc(letter.toLowerCase())}">`;
}

export function letterAnswersHtml(section,questions,answers,startNumber){
  let number=startNumber;
  const layout=section.questionProfile.layout;
  const items=questions.map(q=>({q,number:isPrefilledQuestion(q)?(layout==='letter-table'?'_':0):++number}));
  const body=layout==='letter-table'
    ?`<div class="letter-table-scroll"><table class="letter-table"><thead><tr><th scope="row">${esc(section.tableHeading??'Person')}</th>${items.map(({q,number})=>`<th scope="col">${number}<span>${textHtml(q.title==='Nháp'?'':q.title)}</span></th>`).join('')}</tr></thead><tbody><tr><th scope="row">Lösung</th>${items.map(({q})=>`<td>${letterAnswerControl(q,answers[q.id],layout)}</td>`).join('')}</tr></tbody></table></div>`
    :items.map(({q,number})=>`<div class="letter-question"><label for="letter-${esc(q.id)}"><b>${number}${number==='_'?'':'.'}</b> ${textHtml(q.title==='Nháp'?'':q.title)}</label>${letterAnswerControl(q,answers[q.id],layout).replace('<input ','<input id="letter-'+esc(q.id)+'" ')}</div>`).join('');
  return `<section class="letter-answers" data-letter-section data-repeatable-letters="${esc((section.questionProfile.repeatableLetters||[]).join(','))}" data-unique-letters="${section.questionProfile.uniqueLetters!==false}">${body}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}

export function bindLetterAnswers(root,questions,answers,onSave){
  const controls=[...root.querySelectorAll('[data-letter-answer]')];if(!controls.length)return;
  const section={questionProfile:{uniqueLetters:root.querySelector('[data-letter-section]')?.dataset.uniqueLetters!=='false',repeatableLetters:(root.querySelector('[data-letter-section]')?.dataset.repeatableLetters||'').split(',').filter(Boolean)},questionIds:questions.map(q=>q.id)};
  const refresh=()=>controls.forEach(el=>{
    syncLetterPicker(el);
    const display=el.parentElement?.querySelector('.inline-gap-value');
    if(display)display.textContent=selectedLetterLabel(el.selectedOptions[0],el.dataset?.fullSelection==='true'||el.classList?.contains('inline-gap-native-text'));
    for(const option of el.querySelectorAll('option')){
      if(option.value==='')continue;
      option.disabled=Boolean(letterAnswerError(section,questions,{...answers,[el.dataset.q]:Number(option.value)}));
    }
  });
  controls.forEach(el=>el.onchange=()=>{
    const q=questions.find(q=>q.id===el.dataset.q),raw=el.value.trim().toUpperCase();
    const value=raw===''?null:el.tagName==='SELECT'?Number(raw):(q.choices||[]).findIndex(c=>choiceLetter(c)===raw);
    const error=letterAnswerError(section,questions,{...answers,[q.id]:value});
    const feedback=root.querySelector('.letter-answer-error');if(feedback)feedback.textContent=error;
    if(error){const previous=answers[q.id];el.value=previous==null?'':el.tagName==='SELECT'?String(previous):choiceLetter(q.choices[previous]).toLowerCase();return;}
    answers[q.id]=value;onSave(q.id,value);refresh();
  });
  controls.forEach(bindLetterPicker);
  refresh();
}
