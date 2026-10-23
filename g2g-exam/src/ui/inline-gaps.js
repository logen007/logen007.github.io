import {hasGapExample} from '../domain/inline-gaps.js';
import {imageMaxWidth} from '../domain/question-display.js';
import {textHtml,textPartsHtml,esc} from './format.js';
import {letterAnswerControl} from './letter-answers.js';

export function inlineGapsHtml(section,questions,answers,startNumber,{splitLayout=section.questionProfile?.gapSplitLayout,compact=false}={}){
  const perQuestion=section.questionProfile?.gapChoicesPerQuestion;
  const split=!compact&&(!perQuestion||splitLayout);
  const options=perQuestion?`<section class="gap-choice-bank" aria-label="Antwortmöglichkeiten">${questions.map((q,index)=>`<div class="gap-choice-group"><b>${startNumber+index+1}.</b><div>${[0,1,2].map(i=>`<p><span>${String.fromCharCode(97+i)})</span><span>${textHtml(section.gapOptions?.[index]?.[i]||'')}</span></p>`).join('')}</div></div>`).join('')}</section>`:'';
  const image=!section.instructionAfterQuestion&&section.instructionImageUrl?`<img class="gap-article-image" src="${esc(section.instructionImageUrl)}" alt="Abbildung zum Text" ${imageMaxWidth(section.instructionImageMaxWidth)?`style="max-width:${imageMaxWidth(section.instructionImageMaxWidth)}px"`:''}>`:'';
  const instructionHasImage=/\[img\]/i.test(section.instruction||'');
  const passageHasImage=(section.gapPassage||[]).some(part=>typeof part==='string'&&/\[img\]/i.test(part));
  let insertedImage=false;
  const passage=textPartsHtml((section.gapPassage||[]).flatMap(part=>{
    if(typeof part==='string')return part.split(/(\[img\])/gi).map(text=>{
      if(!/^\[img\]$/i.test(text))return text;
      if(instructionHasImage||insertedImage)return '';
      insertedImage=true;return {html:image};
    });
    if(part.example&&!hasGapExample(section))return section.gapExample||'';
    if(part.example)return {html:`<span class="gap-demo"><b>0</b> ${textHtml(section.gapExample||'')}</span>`};
    const q=questions[part.gap];if(!q)return '';
    return {html:`<span class="inline-gap">${letterAnswerControl(q,answers[q.id],'letter-select',{nativeText:compact,number:startNumber+part.gap+1,optionTexts:perQuestion?section.gapOptions?.[part.gap]:section.gapOptions})}</span>`};
  }));
  return `<section class="letter-answers inline-gap-paper ${split?'exam-reading-split':''}" data-letter-question-ids="${esc(JSON.stringify(questions.map(q=>q.id)))}" data-repeatable-letters="${esc((section.questionProfile?.repeatableLetters||[]).join(','))}" data-letter-section data-unique-letters="${section.questionProfile?.uniqueLetters!==false}"><article class="gap-article writing-paper">${section.gapTitle?`<h2>${textHtml(section.gapTitle)}</h2>`:''}${!instructionHasImage&&!passageHasImage?image:''}<div class="gap-passage">${passage}</div></article>${compact?'':perQuestion?options:`<div class="gap-sentences">${hasGapExample(section)?`<p><b>0</b><span>${textHtml(section.gapExample||'')}</span></p>`:''}${(section.gapOptions||[]).map((text,i)=>`<p><b>${String.fromCharCode(97+i)}</b><span>${textHtml(text)}</span></p>`).join('')}</div>`}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}
