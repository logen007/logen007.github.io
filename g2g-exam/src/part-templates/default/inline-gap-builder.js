import {iconHtml} from '../../ui/icons.js';
import {imageMaxWidth} from '../../domain/question-display.js';
import {esc} from '../../ui/format.js';
import {gapAuthorText,parseGapText,hasGapExample} from '../../domain/inline-gaps.js';
import {updateSection,updateQuestion} from '../../core.js';

export function inlineGapBuilder(section,questions,readOnly){
  const disabled=readOnly?'disabled':'';
  const input=(key,value)=>`<label class="gap-option"><b>${key}</b><input class="truong" data-gap-option="${key}" aria-label="${key==='z'?'Câu ví dụ z':'Câu lựa chọn '+key}" placeholder="${key==='z'?'Câu ví dụ':'Câu lựa chọn '+key}" value="${esc(value||'')}" ${disabled}></label>`;
  const image=section.instructionImageUrl||'';
  const perQuestion=section.questionProfile?.gapChoicesPerQuestion,dynamic=section.questionProfile?.dynamicGapOptions;
  const optionFields=perQuestion?questions.map((q,index)=>`<fieldset><legend>[${Number(q.correctAnswer)>=0&&Number(q.correctAnswer)<3?String.fromCharCode(97+Number(q.correctAnswer)):'a/b/c'}] · Câu ${index+1}</legend>${[...'abc'].map((key,i)=>`<input class="truong" data-gap-choice="${index}-${i}" aria-label="Câu ${index+1}, lựa chọn ${key}" placeholder="${key}" value="${esc(section.gapOptions?.[index]?.[i]||'')}" ${disabled}>`).join('')}</fieldset>`).join(''):[...'abcdefgh'].map((key,i)=>input(key,section.gapOptions?.[i])).join('');
  const bankCount=Math.max(section.questionLimit,section.gapOptions?.length||0);
  const bankFields=dynamic?`<div data-gap-options-count="${bankCount}">${Array.from({length:bankCount},(_,i)=>input(String.fromCharCode(97+i),section.gapOptions?.[i])).join('')}</div><div class="nhom-nut"><button type="button" class="icon-btn" data-gap-resize="remove" title="Bỏ đáp án cuối" aria-label="Bỏ đáp án cuối" ${readOnly||bankCount<=section.questionLimit?'disabled':''}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-gap-resize="add" title="Thêm đáp án" aria-label="Thêm đáp án" ${readOnly||bankCount>=25?'disabled':''}>${iconHtml('plus')}</button></div>`:'';
  const helpId='gap-help-'+section.id;
  const help=perQuestion?'Ký hiệu [a], [b] hoặc [c] trong đoạn văn là đáp án đúng của nhóm lựa chọn tương ứng, theo thứ tự xuất hiện. Ví dụ: [b] chọn lựa chọn b của câu đó.':'Ký hiệu [a], [b]… trong đoạn văn là đáp án đúng tương ứng trong danh sách bên cạnh. Ví dụ: [b] chọn nội dung ở ô b; mỗi đáp án chỉ dùng một lần.';
  const header=`<textarea class="truong gap-title-input" data-gap-title aria-label="Tiêu đề bài đọc" placeholder="Tiêu đề bài đọc" rows="2" ${disabled}>${esc(section.gapTitle||'')}</textarea><div class="gap-image-editor" data-section-image-control data-has-image="${Boolean(image)}"><div class="goethe-instruction-icons"><input class="truong instruction-image-width" id="sectionImageMaxWidth" type="number" min="1" step="1" aria-label="img width (px)" placeholder="img width (px)" value="${imageMaxWidth(section.instructionImageMaxWidth)??''}" ${disabled}><button type="button" class="icon-btn" data-action="clear-section-image" title="Xóa hình ảnh bài đọc" aria-label="Xóa hình ảnh bài đọc" ${disabled}>${iconHtml('close')}</button></div><label class="section-image-upload" title="Tải hình ảnh bài đọc"><span class="section-image-label">${image?`<img src="${esc(image)}" alt="Hình ảnh bài đọc">`:iconHtml('image')}</span><input type="file" data-section-image accept="image/*" aria-label="Tải hình ảnh bài đọc" ${disabled}></label></div>`;
  return `<div class="inline-gap-editor"><div class="gap-article-editor">${header}<textarea class="truong gap-author-text" data-gap-text aria-describedby="${esc(helpId)}" aria-label="Đoạn văn điền khuyết" placeholder="Nhập đoạn văn có ${hasGapExample(section)?'[z], ':''}[a], [b]…" ${disabled}>${esc(gapAuthorText(section,questions))}</textarea><p class="gap-author-help" id="${esc(helpId)}">${esc(help)}</p></div><div class="gap-options-editor">${hasGapExample(section)?input('z',section.gapExample):''}${dynamic?bankFields:optionFields}</div>${questions.map(q=>`<div hidden class="part-question" data-editor-mode="inline-gaps" data-question-id="${esc(q.id)}"><input data-field="maxScore" value="${q.maxScore??1}"></div>`).join('')}</div>`;
}

export function saveInlineGapDraft(root,state,user,exam,section){
  const field=root.querySelector('[data-gap-text]');if(!field)return;
  const profile=section.questionProfile||{},perQuestion=profile.gapChoicesPerQuestion,dynamic=profile.dynamicGapOptions;
  const {passage,keys}=parseGapText(field.value,section.questionLimit,perQuestion?'abc':dynamic?'abcdefghijklmnopqrstuvwxy':'abcdefgh');
  if(!hasGapExample(section)&&passage.some(part=>part?.example))throw new Error('Phần này không có câu ví dụ. Bỏ ký hiệu [z].');
  const bankCount=Number(root.querySelector('[data-gap-options-count]')?.dataset.gapOptionsCount);
  const options=perQuestion?section.questionIds.map((_,index)=>[0,1,2].map(i=>root.querySelector(`[data-gap-choice="${index}-${i}"]`)?.value.trim()||'')):dynamic?(bankCount?Array.from({length:bankCount},(_,i)=>root.querySelector(`[data-gap-option="${String.fromCharCode(97+i)}"]`)?.value.trim()||''):(root.querySelector('[data-gap-options]')?.value||'').split('\n').map(value=>value.trim()).filter(Boolean)):[...'abcdefgh'].map(key=>root.querySelector(`[data-gap-option="${key}"]`)?.value.trim()||'');
  updateSection(state,user,exam.id,section.id,{gapTitle:root.querySelector('[data-gap-title]')?.value??section.gapTitle??'',gapPassage:passage,gapOptions:options,gapExample:root.querySelector('[data-gap-option="z"]')?.value.trim()||''});
  const choices=Array.from({length:perQuestion?3:Math.max(2,options.length)},(_,i)=>String.fromCharCode(65+i));
  section.questionIds.forEach((id,index)=>updateQuestion(state,user,id,{title:'Lücke '+(index+1),choices,correctAnswer:keys[index]??-1,maxScore:Number(profile.defaultScore??1),example:false}));
}

export function resizeGapOptions(state,user,examId,sectionId,action){
  const section=state.exams.find(exam=>exam.id===examId)?.sections.find(section=>section.id===sectionId);
  if(!section?.questionProfile?.dynamicGapOptions)return;
  const options=[...(section.gapOptions||[])];
  if(action==='add'){if(options.length>=25)return;options.push('');}
  else if(action==='remove'){
    if(options.length<=section.questionLimit)return;
    if(section.questionIds.some(id=>Number(state.questions.find(q=>q.id===id)?.correctAnswer)===options.length-1))throw new Error('Đáp án cuối đang được dùng trong đoạn văn. Đổi đáp án đúng trước khi bỏ.');
    options.pop();
  }else return;
  updateSection(state,user,examId,sectionId,{gapOptions:options});
  const choices=options.map((_,i)=>String.fromCharCode(65+i));
  section.questionIds.forEach(id=>updateQuestion(state,user,id,{choices}));
}
