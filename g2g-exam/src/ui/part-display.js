import {esc} from './format.js';
import {iconHtml} from './icons.js';
import {effectiveAudioPolicy} from '../domain/part-audio.js';

export function partUsesSplit(exam,section){
  if(typeof section.displaySplit==='boolean')return section.displaySplit;
  return Boolean(section.questionProfile?.splitLayout||(exam.provider==='TELC'&&exam.level==='B1'&&(section.skillKey==='writing'||section.skill==='Viết')));
}

export function partDisplayHtml(exam,section,readOnly){
  const split=partUsesSplit(exam,section),repeat=Number(effectiveAudioPolicy(section).segmentRepeat)>1;
  const listening=section.skillKey==='listening'||section.skill==='Nghe';
  return `<div class="part-display-heading"><h2>${esc(section.name)}</h2><div class="nhom-nut"><button type="button" class="nut nho" data-part-display="layout" aria-pressed="${split}" title="Bố cục trên desktop; đề bài ở cột trái" ${readOnly?'disabled':''}>${iconHtml(split?'twoPages':'onePage')}<span>${split?'Hai trang':'Một trang'}</span></button>${listening?`<button type="button" class="nut nho" data-part-display="repeat" aria-pressed="${repeat}" ${readOnly?'disabled':''}>${iconHtml(repeat?'repeat':'playOnce')}<span>${repeat?'Lặp 1 lần':'Không lặp'}</span></button>`:''}</div></div>`;
}
