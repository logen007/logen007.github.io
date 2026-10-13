import {scoreInput} from '../../ui/score-input.js';
import {iconHtml} from '../../ui/icons.js';
import {esc} from '../../ui/format.js';
import {gapAuthorText,parseGapText,hasGapExample} from '../../domain/inline-gaps.js';
import {updateSection,updateQuestion} from '../../core.js';
import {examQuestionNumbers} from '../../domain/question-numbering.js';

export function inlineGapBuilder(section,questions,readOnly,numbers=new Map()){
  const disabled=readOnly?'disabled':'';
  const input=(key,value)=>`<label class="gap-option"><b>${key}</b><input class="truong" data-gap-option="${key}" aria-label="${key==='z'?'Câu ví dụ z':'Câu lựa chọn '+key}" placeholder="${key==='z'?'Câu ví dụ':'Câu lựa chọn '+key}" value="${esc(value||'')}" ${disabled}></label>`;
  const perQuestion=section.questionProfile?.gapChoicesPerQuestion,dynamic=section.questionProfile?.dynamicGapOptions;
  const optionFields=perQuestion?questions.map((q,index)=>`<fieldset data-gap-position="${index}" ${(section.gapPassage||[]).some(part=>part?.gap===index)?'':'hidden'}><legend>${numbers.get(q.id)??index+1}. · {${String.fromCharCode(97+index)}}</legend>${scoreInput(q.maxScore??section.questionProfile?.defaultScore??1,{attributes:`data-gap-score="${index}"`,disabled:readOnly})}${[...'ABC'].map((key,i)=>`<label class="gap-choice-edit"><input type="radio" name="gap-correct-${index}" data-gap-correct="${index}" value="${i}" aria-label="Chọn ${key} làm đáp án đúng cho {${String.fromCharCode(97+index)}}" ${q.correctAnswer!=null&&q.correctAnswer!==''&&Number(q.correctAnswer)===i?'checked':''} ${disabled}><b>${key}</b><input class="truong" data-gap-choice="${index}-${i}" aria-label="Câu ${numbers.get(q.id)??index+1}, lựa chọn ${key}" placeholder="Lựa chọn ${key}" value="${esc(section.gapOptions?.[index]?.[i]||'')}" ${disabled}></label>`).join('')}</fieldset>`).join(''):[...'abcdefgh'].map((key,i)=>input(key,section.gapOptions?.[i])).join('');
  const bankCount=Math.max(section.questionLimit,section.gapOptions?.length||0);
  const bankFields=dynamic?`<div data-gap-options-count="${bankCount}">${Array.from({length:bankCount},(_,i)=>`<div class="gap-option-row">${input(String.fromCharCode(97+i),section.gapOptions?.[i])}<button type="button" class="icon-btn" data-gap-resize="remove" data-gap-index="${i}" title="Xóa đáp án ${String.fromCharCode(97+i)}" aria-label="Xóa đáp án ${String.fromCharCode(97+i)}" ${readOnly||bankCount<=section.questionLimit?'disabled':''}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-gap-resize="add" data-gap-index="${i}" title="Thêm đáp án bên dưới" aria-label="Thêm đáp án bên dưới ${String.fromCharCode(97+i)}" ${readOnly||bankCount>=25?'disabled':''}>${iconHtml('plus')}</button></div>`).join('')}</div>`:'';
  const helpId='gap-help-'+section.id;
  const placeholder=`Nhập đoạn văn…
{a}, {b}, {c}… → ô trả lời theo thứ tự; chọn đáp án đúng riêng bên dưới.
${hasGapExample(section)?'{z} → vị trí câu ví dụ\\n':''}[b]chữ đậm[/b] · [i]chữ nghiêng[/i] · [u]gạch chân[/u]
[box]nội dung[/box] → đóng khung chữ
[headline]Tiêu đề[/headline] → tiêu đề lớn, riêng một dòng
[signature]Tên người ký[/signature] → chữ ký viết tay cỡ lớn
[img] → đặt ảnh đã tải lên tại đây`;
  const legacyWarning=(section.gapPassage||[]).some(part=>typeof part==='string'&&/\[b\](?:(?!\[\/b\])[\s\S])*?\[b\]/i.test(part))
    ?'<p role="status">Đoạn này còn cú pháp [b]…[b] cũ có thể gây nhầm. Nội dung được giữ nguyên; nếu là chữ đậm, đổi dấu đóng thành [/b].</p>':'';
  const help=perQuestion?'Nhập {a}, {b}… theo thứ tự vị trí trong đoạn văn. Điền 3 lựa chọn A/B/C cho mỗi nhóm bên dưới và tích chọn đáp án đúng.':'Dùng {a}, {b}… theo thứ tự ô trong đoạn văn. Chọn đáp án đúng cho từng ô ở bên dưới; ký hiệu không phải đáp án đúng.';
  const answerFields=perQuestion?'':`<div class="gap-answer-mapping">${questions.map((q,index)=>`<div class="gap-score-row"><label class="gap-option"><b>${numbers.get(q.id)??index+1}. · {${String.fromCharCode(97+index)}}</b><select class="truong" data-gap-answer="${index}" aria-label="Đáp án đúng ô ${numbers.get(q.id)??index+1}" ${disabled}><option value="-1">Chọn đáp án đúng</option>${(section.gapOptions||[]).map((text,i)=>`<option value="${i}" ${q.correctAnswer!=null&&q.correctAnswer!==''&&Number(q.correctAnswer)===i?'selected':''}>${esc(String.fromCharCode(97+i)+'. '+text)}</option>`).join('')}</select></label>${scoreInput(q.maxScore??section.questionProfile?.defaultScore??1,{attributes:`data-gap-score="${index}"`,disabled:readOnly})}</div>`).join('')}</div>`;
  return `<div class="inline-gap-editor ${perQuestion?'inline-gap-editor--positions':''}"><div class="gap-article-editor"><textarea class="truong gap-author-text" data-gap-text aria-describedby="${esc(helpId)}" aria-label="Đoạn văn điền khuyết" placeholder="${esc(placeholder)}" ${disabled}>${esc(gapAuthorText(section,questions))}</textarea><p class="gap-author-help" id="${esc(helpId)}">${esc(help)}</p>${legacyWarning}</div><div class="gap-options-editor">${hasGapExample(section)?input('z',section.gapExample):''}${dynamic?bankFields:optionFields}${answerFields}${perQuestion?`<div class="nhom-nut"><button type="button" class="icon-btn" data-gap-position-action="remove" title="Bỏ vị trí cuối" aria-label="Bỏ vị trí cuối" ${disabled}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-gap-position-action="add" title="Thêm vị trí" aria-label="Thêm vị trí" ${disabled}>${iconHtml('plus')}</button></div>`:''}</div>${questions.map(q=>`<div hidden class="part-question" data-editor-mode="inline-gaps" data-question-id="${esc(q.id)}"><input data-field="maxScore" value="${q.maxScore??1}"></div>`).join('')}</div>`;
}

export function saveInlineGapDraft(root,state,user,exam,section){
  const numbers=examQuestionNumbers(exam,state.questions);
  const field=root.querySelector('[data-gap-text]');if(!field)return;
  const profile=section.questionProfile||{},perQuestion=profile.gapChoicesPerQuestion,dynamic=profile.dynamicGapOptions;
  const {passage,keys}=parseGapText(field.value,section.questionLimit,perQuestion?Array.from({length:section.questionLimit},(_,i)=>String.fromCharCode(97+i)).join(''):dynamic?'abcdefghijklmnopqrstuvwxy':'abcdefgh');
  if(perQuestion||/\{[a-z]\}/i.test(field.value)){
    if(keys.some((key,index)=>key!==index))throw new Error('Nhập các vị trí {a}, {b}… theo thứ tự, mỗi ký hiệu một lần.');
  }
  if(!hasGapExample(section)&&passage.some(part=>part?.example))throw new Error('Phần này không có câu ví dụ. Bỏ ký hiệu {z}.');
  const bankCount=Number(root.querySelector('[data-gap-options-count]')?.dataset.gapOptionsCount);
  const options=perQuestion?section.questionIds.map((_,index)=>[0,1,2].map(i=>root.querySelector(`[data-gap-choice="${index}-${i}"]`)?.value.trim()||'')):dynamic?(bankCount?Array.from({length:bankCount},(_,i)=>root.querySelector(`[data-gap-option="${String.fromCharCode(97+i)}"]`)?.value.trim()||''):(root.querySelector('[data-gap-options]')?.value||'').split('\n').map(value=>value.trim()).filter(Boolean)):[...'abcdefgh'].map(key=>root.querySelector(`[data-gap-option="${key}"]`)?.value.trim()||'');
  const scores=section.questionIds.map((id,index)=>{
    const input=root.querySelector(`[data-gap-score="${index}"]`);
    if(input&&(!input.value.trim()||!Number.isFinite(Number(input.value))||Number(input.value)<0))throw new Error('Nhập điểm hợp lệ, lớn hơn hoặc bằng 0.');
    return input?Number(input.value):state.questions.find(q=>q.id===id)?.maxScore??Number(profile.defaultScore??1);
  });
  updateSection(state,user,exam.id,section.id,{gapTitle:root.querySelector('[data-gap-title]')?.value??section.gapTitle??'',gapPassage:passage,gapOptions:options,gapExample:root.querySelector('[data-gap-option="z"]')?.value.trim()||''});
  const choices=Array.from({length:perQuestion?3:Math.max(2,options.length)},(_,i)=>String.fromCharCode(65+i));
  section.questionIds.forEach((id,index)=>updateQuestion(state,user,id,{title:'Lücke '+(numbers.get(id)??index+1),choices,correctAnswer:perQuestion?Number(root.querySelector(`[data-gap-correct="${index}"]:checked`)?.value??-1):/\{[a-z]\}/i.test(field.value)?Number(root.querySelector(`[data-gap-answer="${index}"]`)?.value??state.questions.find(q=>q.id===id)?.correctAnswer??-1):keys[index]??-1,maxScore:scores[index],example:false}));
}

export function resizeGapOptions(state,user,examId,sectionId,action,rowIndex){
  const section=state.exams.find(exam=>exam.id===examId)?.sections.find(section=>section.id===sectionId);
  if(!section?.questionProfile?.dynamicGapOptions)return;
  const options=[...(section.gapOptions||[])];
  const index=rowIndex==null?options.length-1:Number(rowIndex);
  if(!Number.isInteger(index)||index<0||index>=options.length)return;
  if(action==='add'){if(options.length>=25)return;options.splice(index+1,0,'');}
  else if(action==='remove'){
    if(options.length<=section.questionLimit)return;
    if(section.questionIds.some(id=>Number(state.questions.find(q=>q.id===id)?.correctAnswer)===index))throw new Error('Đáp án này đang được dùng trong đoạn văn. Đổi đáp án đúng trước khi bỏ.');
    options.splice(index,1);
  }else return;
  updateSection(state,user,examId,sectionId,{gapOptions:options});
  const choices=options.map((_,i)=>String.fromCharCode(65+i));
  section.questionIds.forEach(id=>{
    const previous=state.questions.find(q=>q.id===id)?.correctAnswer;
    const correct=previous==null||previous===''?-1:Number(previous);
    const correctAnswer=correct>index?correct+(action==='add'?1:-1):correct;
    updateQuestion(state,user,id,{choices,correctAnswer});
  });
}

export function bindGapPositions(root,section){
  if(!section?.questionProfile?.gapChoicesPerQuestion)return;
  const field=root.querySelector('[data-gap-text]');
  if(!field)return;
  const letters=Array.from({length:section.questionLimit},(_,i)=>String.fromCharCode(97+i)).join('');
  const buttons=[...root.querySelectorAll('[data-gap-position-action]')];
  const refresh=()=>{
    try{
      const {keys}=parseGapText(field.value,section.questionLimit,letters);
      root.querySelectorAll('[data-gap-position]').forEach(group=>{group.hidden=!keys.includes(Number(group.dataset.gapPosition));});
      buttons.forEach(button=>{button.disabled=field.disabled||(button.dataset.gapPositionAction==='add'?keys.length>=section.questionLimit:!keys.length);});
    }catch{/* Keep the current groups while a marker is incomplete. */}
  };
  field.addEventListener('input',refresh);
  buttons.forEach(button=>button.addEventListener('click',()=>{
    if(button.disabled)return;
    const {passage,keys}=parseGapText(field.value,section.questionLimit,letters);
    if(button.dataset.gapPositionAction==='add'){
      const next=letters.split('').find((_,index)=>!keys.includes(index));
      if(next)field.value+=` {${next}}`;
    }else{
      field.value=passage.map(part=>typeof part==='string'?part:part.example?'{z}':part.gap===keys.length-1?'':`{${letters[keys[part.gap]]}}`).join('');
    }
    field.dispatchEvent(new Event('input',{bubbles:true}));
    field.dispatchEvent(new Event('change',{bubbles:true}));
    field.focus();
  }));
  refresh();
}
