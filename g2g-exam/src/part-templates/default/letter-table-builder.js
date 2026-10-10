import {esc} from '../../ui/format.js';
import {isPrefilledQuestion} from '../../domain/question-display.js';
import {partAudioQuestions} from '../../domain/part-audio.js';

// Compact presentation only: retain question IDs and the normal draft-save fields.
export function letterTableBuilder({questions,section,defaultScore,readOnly,audioHtml,choicesHtml}){
  const scored=questions.filter(q=>!isPrefilledQuestion(q));
  const scores=[...new Set(scored.map(q=>Number(q.maxScore??defaultScore)))];
  const disabled=readOnly?'disabled':'';
  let number=0;
  return `<div class="letter-group-editor">
    <div class="letter-group-toolbar"><label>Nhãn bảng<input class="truong" id="sectionTableHeading" value="${esc(section.tableHeading??'Person')}" ${disabled}></label><label>Điểm mỗi câu<input class="truong" data-letter-group-score type="number" min="0" step="0.01" value="${scores.length===1?scores[0]:''}" placeholder="${scores.length>1?'Chưa đồng đều':defaultScore}" ${disabled}></label></div>
    <div class="letter-group-audio">${partAudioQuestions(section,questions).map(q=>`<div data-audio-question-id="${esc(q.id)}"><span>${isPrefilledQuestion(q)?'Audio ví dụ':'Audio bài nghe'}</span>${audioHtml(q,readOnly,true)}</div>`).join('')}</div>
    <div class="letter-group-scroll"><table class="letter-group-table"><thead><tr><th>Câu</th><th>Nội dung</th><th>Đáp án đúng</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${questions.map(q=>{
      const example=isPrefilledQuestion(q);
      return `<tr class="part-question" data-example="${Boolean(q.example)}" data-editor-mode="choices" data-question-id="${esc(q.id)}" data-letter-prefilled="${example}"><td>${example?'_ <small>Ví dụ</small>':++number}<input type="hidden" data-field="maxScore" value="${example?0:Number(q.maxScore??defaultScore)}"></td><td><input class="truong" data-field="title" aria-label="Nội dung câu ${example?'ví dụ':number}" value="${esc(q.title==='Nháp'?'':q.title||'')}" ${disabled}></td><td>${choicesHtml(q)}</td><td><button type="button" class="icon-btn" data-action="remove-inline-question" data-id="${esc(q.id)}" aria-label="Xóa dòng" title="Xóa dòng" ${disabled}>×</button></td></tr>`;
    }).join('')}</tbody></table></div>
    <button type="button" class="nut" data-action="add-inline-question" ${disabled}>+ Thêm dòng</button>
  </div>`;
}

export function bindLetterTableBuilder(root,updateTotals){
  const score=root.querySelector('[data-letter-group-score]');
  if(!score)return;
  score.addEventListener('input',()=>{
    if(score.value===''||!score.validity.valid)return;
    root.querySelectorAll('.letter-group-table .part-question[data-letter-prefilled="false"] [data-field="maxScore"]').forEach(input=>{input.value=score.value;});
    updateTotals();
  });
}
