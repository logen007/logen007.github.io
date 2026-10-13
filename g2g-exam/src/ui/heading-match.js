import {textHtml,esc} from './format.js';
import {letterAnswerControl} from './letter-answers.js';

export function headingOptionsHtml(section){
  return `<div class="gap-sentences heading-options">${(section.headingOptions||[]).map((text,i)=>`<p><b>${String.fromCharCode(97+i)}</b> ${textHtml(text)}</p>`).join('')}</div>`;
}

export function headingMatchHtml(section,questions,answers,startNumber,{separateOptions=false}={}){
  return `<section class="letter-answers heading-match" data-letter-section data-unique-letters="true">${separateOptions?'':headingOptionsHtml(section)}${questions.map((q,i)=>`<article class="heading-match-question"><div><label class="sr-only" for="letter-${esc(q.id)}">${startNumber+i+1}.</label><span class="inline-gap">${letterAnswerControl(q,answers[q.id],'letter-select',{number:startNumber+i+1,optionTexts:section.headingOptions||[],fullSelection:true})}</span></div><p>${textHtml(q.title==='Nháp'?'':q.title)}</p></article>`).join('')}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}
