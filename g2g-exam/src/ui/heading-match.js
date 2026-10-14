import {textHtml,esc} from './format.js';
import {letterAnswerControl} from './letter-answers.js';
import {isPrefilledQuestion} from '../domain/question-display.js';

export function headingOptionsHtml(section){
  return `<div class="gap-sentences heading-options">${(section.headingOptions||[]).map((text,i)=>`<p><b>${String.fromCharCode(97+i)}</b> ${textHtml(text)}</p>`).join('')}</div>`;
}

export function headingMatchHtml(section,questions,answers,startNumber,{separateOptions=false,afterQuestion=()=>''}={}){
  const position=index=>questions.slice(0,index+1).filter(q=>!isPrefilledQuestion(q)).length;
  return `<section class="letter-answers heading-match" data-letter-section data-unique-letters="true">${separateOptions?'':headingOptionsHtml(section)}${questions.map((q,i)=>`<article class="heading-match-question"><div><label class="sr-only" for="letter-${esc(q.id)}">${isPrefilledQuestion(q)?0:startNumber+position(i)}.</label><span class="inline-gap">${letterAnswerControl(q,answers[q.id],'letter-select',{number:isPrefilledQuestion(q)?0:startNumber+position(i),optionTexts:section.headingOptions||[],fullSelection:true})}</span></div><p>${textHtml(q.title==='Nháp'?'':q.title)}</p></article>${afterQuestion(i+1)}`).join('')}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}
