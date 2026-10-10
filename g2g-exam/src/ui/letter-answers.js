import {esc} from './format.js';
import {choiceLetter,letterAnswerError} from '../domain/letter-answers.js';

function control(q,answer,layout){
  const value=q.example?q.correctAnswer:answer,letter=value==null||value===''?'':choiceLetter(q.choices?.[Number(value)]);
  if(q.example)return `<span class="letter-example">${esc(letter.toLowerCase())}</span>`;
  const attrs=`data-letter-answer data-q="${esc(q.id)}" aria-label="Antwort: ${esc(q.title)}"`;
  if(layout==='letter-table'||layout==='letter-select')return `<select id="letter-${esc(q.id)}" class="truong" ${attrs}><option value="">—</option>${(q.choices||[]).map((choice,i)=>`<option value="${i}" ${String(value)===String(i)?'selected':''}>${esc(choiceLetter(choice).toLowerCase())}</option>`).join('')}</select>`;
  return `<input ${attrs} maxlength="1" autocomplete="off" autocapitalize="characters" value="${esc(letter.toLowerCase())}">`;
}

export function letterAnswersHtml(section,questions,answers,startNumber){
  let number=startNumber;
  const items=questions.map(q=>({q,number:q.example?0:++number}));
  const layout=section.questionProfile.layout;
  const body=layout==='letter-table'
    ?`<div class="letter-table-scroll"><table class="letter-table"><thead><tr><th scope="row">Person</th>${items.map(({q,number})=>`<th scope="col">${q.example?'Beispiel · 0':number}<span>${esc(q.title==='Nháp'?'':q.title)}</span></th>`).join('')}</tr></thead><tbody><tr><th scope="row">Lösung</th>${items.map(({q})=>`<td>${control(q,answers[q.id],layout)}</td>`).join('')}</tr></tbody></table></div>`
    :items.map(({q,number})=>`<div class="letter-question"><label for="letter-${esc(q.id)}"><b>${q.example?'Beispiel · 0':number}.</b> ${esc(q.title==='Nháp'?'':q.title)}</label>${control(q,answers[q.id],layout).replace('<input ','<input id="letter-'+esc(q.id)+'" ')}</div>`).join('');
  return `<section class="letter-answers" data-letter-section>${body}<p class="letter-answer-error" role="status" aria-live="polite"></p></section>`;
}

export function bindLetterAnswers(root,questions,answers,onSave){
  const controls=[...root.querySelectorAll('[data-letter-answer]')];if(!controls.length)return;
  const section={questionProfile:{uniqueLetters:true},questionIds:questions.map(q=>q.id)};
  const refresh=()=>controls.forEach(el=>{
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
  refresh();
}
