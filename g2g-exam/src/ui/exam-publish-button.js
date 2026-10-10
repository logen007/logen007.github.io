import {esc} from './format.js';
import {iconHtml} from './icons.js';

export function examPublishButton(exam,{compact=false,disabled=false}={}){
  const action=exam.status==='published'?'unpublish':'publish';
  const label=action==='publish'?'Xuất bản':'Bỏ xuất bản';
  return `<button class="${compact?'icon-btn':'nut chinh'}" data-action="${action}-exam" data-id="${esc(exam.id)}" aria-label="${label}" title="${label}" ${disabled?'disabled':''}>${iconHtml(action)}${compact?'':`<span>${label}</span>`}</button>`;
}
