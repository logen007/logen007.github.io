import {imageMaxWidth} from '../domain/question-display.js';
import {esc} from './format.js';
import {letterAnswerControl} from './letter-answers.js';

export function inlineGapsHtml(section,questions,answers,startNumber){
  const passage=(section.gapPassage||[]).map(part=>{
    if(typeof part==='string')return esc(part);
    if(part.example)return `<span class="gap-demo"><b>0</b> ${esc(section.gapExample||'')}</span>`;
    const q=questions[part.gap];if(!q)return '';
    return `<span class="inline-gap">${letterAnswerControl(q,answers[q.id],'letter-select',{number:startNumber+part.gap+1})}</span>`;
  }).join('');
  return `<section class="letter-answers inline-gap-paper exam-reading-split" data-letter-section data-unique-letters="true"><article class="gap-article writing-paper">${section.gapTitle?`<h2>${esc(section.gapTitle)}</h2>`:''}${section.instructionImageUrl?`<img class="gap-article-image" src="${esc(section.instructionImageUrl)}" alt="Abbildung zum Text" ${imageMaxWidth(section.instructionImageMaxWidth)?`style="max-width:${imageMaxWidth(section.instructionImageMaxWidth)}px"`:''}>`:''}<div class="gap-passage">${passage}</div></article><div class="gap-sentences"><p><b>0</b> ${esc(section.gapExample||'')}</p>${(section.gapOptions||[]).map((text,i)=>`<p><b>${String.fromCharCode(97+i)}</b> ${esc(text)}</p>`).join('')}</div><p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}
