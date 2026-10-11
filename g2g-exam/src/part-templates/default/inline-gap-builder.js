import {esc} from '../../ui/format.js';
import {gapAuthorText,parseGapText} from '../../domain/inline-gaps.js';
import {updateSection,updateQuestion} from '../../core.js';

export function inlineGapBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'';
  const input=(key,value)=>`<label class="gap-option"><b>${key}</b><input class="truong" data-gap-option="${key}" aria-label="${key==='z'?'Câu ví dụ z':'Câu lựa chọn '+key}" placeholder="${key==='z'?'Câu ví dụ':'Câu lựa chọn '+key}" value="${esc(value||'')}" ${disabled}></label>`;
  return `<div class="inline-gap-editor"><p class="phu-de">Chèn [a]–[h] tại chỗ trống theo đáp án đúng; [z] là câu ví dụ.</p><textarea class="truong gap-author-text" data-gap-text aria-label="Đoạn văn điền khuyết" placeholder="Nhập đoạn văn có [z], [a], [b]…" ${disabled}>${esc(gapAuthorText(section,questions))}</textarea><div class="gap-options-editor">${input('z',section.gapExample)}${[...'abcdefgh'].map((key,i)=>input(key,section.gapOptions?.[i])).join('')}</div>${questions.map(q=>`<div hidden class="part-question" data-editor-mode="inline-gaps" data-question-id="${esc(q.id)}"><input data-field="maxScore" value="${q.maxScore??1}"></div>`).join('')}</div>`;
}

export function saveInlineGapDraft(root,state,user,exam,section){
  const field=root.querySelector('[data-gap-text]');if(!field)return;
  const {passage,keys}=parseGapText(field.value,section.questionLimit);
  const options=[...'abcdefgh'].map(key=>root.querySelector(`[data-gap-option="${key}"]`)?.value.trim()||'');
  updateSection(state,user,exam.id,section.id,{gapPassage:passage,gapOptions:options,gapExample:root.querySelector('[data-gap-option="z"]')?.value.trim()||''});
  section.questionIds.forEach((id,index)=>updateQuestion(state,user,id,{title:'Lücke '+(index+1),choices:[...'ABCDEFGH'],correctAnswer:keys[index]??-1,maxScore:1,example:false}));
}
