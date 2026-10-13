import {esc} from './format.js';
import {iconHtml} from './icons.js';

export function examPublishButton(exam,{compact=false,disabled=false}={}){
  const action=exam.status==='published'?'unpublish':'publish';
  const label=action==='publish'?'Xuất bản':'Bỏ xuất bản';
  const version=exam.publicationLabel?`<small class="exam-publication-version" title="${exam.status==='published'?'Phiên bản đang xuất bản':'Phiên bản xuất bản gần nhất'}">${exam.status==='published'?'':'Bản gần nhất: '}v${esc(exam.publicationLabel)}</small>`:'';
  return `<button class="${compact?'icon-btn':'nut chinh'}" data-action="${action}-exam" data-id="${esc(exam.id)}" aria-label="${label}" title="${label}" ${disabled?'disabled':''}>${iconHtml(action)}${compact?'':`<span>${label}</span>`}</button>${version}`;
}

export function syncExamPublishButtons(root,exam){
  if(!exam)return;
  for(const button of root.querySelectorAll('[data-action="publish-exam"],[data-action="unpublish-exam"]')){
    if(button.dataset.id!==exam.id)continue;
    const template=document.createElement('template');
    template.innerHTML=examPublishButton(exam,{compact:button.classList.contains('icon-btn'),disabled:button.disabled});
    const next=template.content.firstElementChild;
    button.dataset.action=next.dataset.action;
    button.setAttribute('aria-label',next.getAttribute('aria-label'));
    button.title=next.title;button.innerHTML=next.innerHTML;
    const previous=button.nextElementSibling?.matches('.exam-publication-version')?button.nextElementSibling:null;
    const version=next.nextElementSibling;
    if(previous){if(version)previous.replaceWith(version);else previous.remove();}
    else if(version)button.after(version);
  }
}
