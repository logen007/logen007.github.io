import {iconHtml} from '../../ui/icons.js';
import {imageMaxWidth} from '../../domain/question-display.js';
import {esc} from '../../ui/format.js';
import {gapAuthorText,parseGapText} from '../../domain/inline-gaps.js';
import {updateSection,updateQuestion} from '../../core.js';

export function inlineGapBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'';
  const input=(key,value)=>`<label class="gap-option"><b>${key}</b><input class="truong" data-gap-option="${key}" aria-label="${key==='z'?'Câu ví dụ z':'Câu lựa chọn '+key}" placeholder="${key==='z'?'Câu ví dụ':'Câu lựa chọn '+key}" value="${esc(value||'')}" ${disabled}></label>`;
  const image=section.instructionImageUrl||'';
  const perQuestion=section.questionProfile?.gapChoicesPerQuestion,dynamic=section.questionProfile?.dynamicGapOptions;
  const optionFields=perQuestion?questions.map((q,index)=>`<fieldset><legend>Chỗ trống ${index+1}</legend>${[...'abc'].map((key,i)=>`<input class="truong" data-gap-choice="${index}-${i}" aria-label="Chỗ ${index+1}, đáp án ${key}" placeholder="${key}" value="${esc(section.gapOptions?.[index]?.[i]||'')}" ${disabled}>`).join('')}</fieldset>`).join(''):dynamic?`<textarea class="truong" data-gap-options aria-label="Danh sách đáp án, mỗi dòng một đáp án" placeholder="Mỗi dòng một đáp án (a, b, c…). Ít nhất ${section.questionLimit} dòng, tối đa 25." ${disabled}>${esc((section.gapOptions||[]).join('\n'))}</textarea>`:[...'abcdefgh'].map((key,i)=>input(key,section.gapOptions?.[i])).join('');
  const header=`<textarea class="truong gap-title-input" data-gap-title aria-label="Tiêu đề bài đọc" placeholder="Tiêu đề bài đọc" rows="2" ${disabled}>${esc(section.gapTitle||'')}</textarea><div class="gap-image-editor" data-section-image-control data-has-image="${Boolean(image)}"><div class="goethe-instruction-icons"><input class="truong instruction-image-width" id="sectionImageMaxWidth" type="number" min="1" step="1" aria-label="img width (px)" placeholder="img width (px)" value="${imageMaxWidth(section.instructionImageMaxWidth)??''}" ${disabled}><button type="button" class="icon-btn" data-action="clear-section-image" title="Xóa hình ảnh bài đọc" aria-label="Xóa hình ảnh bài đọc" ${disabled}>${iconHtml('close')}</button></div><label class="section-image-upload" title="Tải hình ảnh bài đọc"><span class="section-image-label">${image?`<img src="${esc(image)}" alt="Hình ảnh bài đọc">`:iconHtml('image')}</span><input type="file" data-section-image accept="image/*" aria-label="Tải hình ảnh bài đọc" ${disabled}></label></div>`;
  return `<div class="inline-gap-editor"><div class="gap-article-editor">${header}<textarea class="truong gap-author-text" data-gap-text aria-label="Đoạn văn điền khuyết" placeholder="Nhập đoạn văn có [z], [a], [b]…" ${disabled}>${esc(gapAuthorText(section,questions))}</textarea></div><div class="gap-options-editor">${input('z',section.gapExample)}${optionFields}</div>${questions.map(q=>`<div hidden class="part-question" data-editor-mode="inline-gaps" data-question-id="${esc(q.id)}"><input data-field="maxScore" value="${q.maxScore??1}"></div>`).join('')}</div>`;
}

export function saveInlineGapDraft(root,state,user,exam,section){
  const field=root.querySelector('[data-gap-text]');if(!field)return;
  const profile=section.questionProfile||{},perQuestion=profile.gapChoicesPerQuestion,dynamic=profile.dynamicGapOptions;
  const {passage,keys}=parseGapText(field.value,section.questionLimit,perQuestion?'abc':dynamic?'abcdefghijklmnopqrstuvwxy':'abcdefgh');
  const options=perQuestion?section.questionIds.map((_,index)=>[0,1,2].map(i=>root.querySelector(`[data-gap-choice="${index}-${i}"]`)?.value.trim()||'')):dynamic?(root.querySelector('[data-gap-options]')?.value||'').split('\n').map(value=>value.trim()).filter(Boolean):[...'abcdefgh'].map(key=>root.querySelector(`[data-gap-option="${key}"]`)?.value.trim()||'');
  updateSection(state,user,exam.id,section.id,{gapTitle:root.querySelector('[data-gap-title]')?.value??section.gapTitle??'',gapPassage:passage,gapOptions:options,gapExample:root.querySelector('[data-gap-option="z"]')?.value.trim()||''});
  const choices=Array.from({length:perQuestion?3:Math.max(2,options.length)},(_,i)=>String.fromCharCode(65+i));
  section.questionIds.forEach((id,index)=>updateQuestion(state,user,id,{title:'Lücke '+(index+1),choices,correctAnswer:keys[index]??-1,maxScore:Number(profile.defaultScore??1),example:false}));
}
