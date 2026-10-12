import {hasGapExample} from '../domain/inline-gaps.js';
import {imageMaxWidth} from '../domain/question-display.js';
import {textHtml,esc} from './format.js';
import {letterAnswerControl} from './letter-answers.js';

export function inlineGapsHtml(section,questions,answers,startNumber,{splitLayout=section.questionProfile?.gapSplitLayout}={}){
  const perQuestion=section.questionProfile?.gapChoicesPerQuestion;
  const split=!perQuestion||splitLayout;
  const options=perQuestion?`<section class="gap-choice-bank" aria-label="Antwortmöglichkeiten">${questions.map((q,index)=>`<div class="gap-choice-group"><b>${startNumber+index+1}.</b><div>${[0,1,2].map(i=>`<p><span>${String.fromCharCode(97+i)})</span><span>${textHtml(section.gapOptions?.[index]?.[i]||'')}</span></p>`).join('')}</div></div>`).join('')}</section>`:'';
  const passage=(section.gapPassage||[]).map(part=>{
    if(typeof part==='string')return textHtml(part);
    if(part.example&&!hasGapExample(section))return textHtml(section.gapExample||'');
    if(part.example)return `<span class="gap-demo"><b>0</b> ${textHtml(section.gapExample||'')}</span>`;
    const q=questions[part.gap];if(!q)return '';
    return `<span class="inline-gap">${letterAnswerControl(q,answers[q.id],'letter-select',{number:startNumber+part.gap+1,optionTexts:perQuestion?section.gapOptions?.[part.gap]:section.gapOptions})}</span>`;
  }).join('');
  return `<section class="letter-answers inline-gap-paper ${split?'exam-reading-split':''}" data-letter-section data-unique-letters="${section.questionProfile?.uniqueLetters!==false}"><article class="gap-article writing-paper">${section.gapTitle?`<h2>${textHtml(section.gapTitle)}</h2>`:''}${section.instructionImageUrl?`<img class="gap-article-image" src="${esc(section.instructionImageUrl)}" alt="Abbildung zum Text" ${imageMaxWidth(section.instructionImageMaxWidth)?`style="max-width:${imageMaxWidth(section.instructionImageMaxWidth)}px"`:''}>`:''}<div class="gap-passage">${passage}</div></article>${perQuestion?options:`<div class="gap-sentences">${hasGapExample(section)?`<p><b>0</b><span>${textHtml(section.gapExample||'')}</span></p>`:''}${(section.gapOptions||[]).map((text,i)=>`<p><b>${String.fromCharCode(97+i)}</b><span>${textHtml(text)}</span></p>`).join('')}</div>`}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}
