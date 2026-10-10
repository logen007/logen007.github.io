import {imageMaxWidth} from '../../domain/question-display.js';
import {byId,getQuestionMaxScore} from '../../core.js';
import {esc} from '../../ui/format.js';
import {uploadQuestionAudio} from '../../media.js';
import {iconHtml} from '../../ui/icons.js';
import {WRITING_FORM_TYPES,isScoredWritingField,writingFormScore} from '../../domain/writing-form.js';
import {writingFormEditor} from '../../ui/writing-form.js';
import {partAudioQuestions} from '../../domain/part-audio.js';

const icons={
  add:iconHtml('plus'),
  remove:iconHtml('close'),
  upload:iconHtml('upload'),
  play:iconHtml('play'),
  addImage:'<img src="src/assets/figma-icon-add-image.svg" alt="">',
  imageUpload:iconHtml('image'),
  example:iconHtml('example')
};
const blank=value=>value==='Nháp'?'':value;
const textOf=choice=>typeof choice==='object'?choice.text:choice;
const normalizedScore=value=>Math.abs(value-Math.round(value))<0.02?Math.round(value):value;

function profileFor(section){
  const source=section?.questionProfile||{};
  const isTrueFalse=source.layout==='true-false'&&Array.isArray(source.choices)&&source.choices.length===2;
  return {
    uniqueLetters:source.uniqueLetters===true,
    letterTable:source.layout==='letter-table',
    type:source.type||'single',
    choices:Array.isArray(source.choices)&&source.choices.length>=2?source.choices:(isTrueFalse?['Richtig','Falsch']:['A','B','C']),
    cssClass:isTrueFalse?'goethe-choices--true-false':'',
    showLabels:!isTrueFalse,
    showChoiceImages:source.choiceImages===true||(!isTrueFalse&&source.choiceImages!==false),
    showAudio:source.audio!==false,
    instructionImage:source.instructionImage===true,
    questionImage:source.questionImage===true,
    isWritingForm:source.layout==='form-fields',
    isMixedForm:source.layout==='mixed-form',
    isFreeResponse:source.layout==='free-response',
    formFieldCount:Math.max(1,Number(source.formFieldCount)||1),
    formDefaultScores:Array.isArray(source.formDefaultScores)?source.formDefaultScores:[],
    formFrame:source.formFrame===true,
    stimulusStarts:Array.isArray(source.stimulusStarts)?source.stimulusStarts.map(Number):[],
  };
}

const audioName=q=>{
  if(q.audioName)return q.audioName;
  if(String(q.audioUrl||'').startsWith('data:'))return 'Audio đã tải lên';
  return decodeURIComponent(String(q.audioUrl||'').split('/').pop().split('?')[0]||'Audio đã tải lên');
};

function audioHtml(q,readOnly,showAudio){
  if(!showAudio)return '';
  return `<div class="audio-upload ${q.audioUrl?'has-audio':''}"><label class="audio-file-select" title="${q.audioUrl?'Thay audio':'Tải audio'}"><span>${q.audioUrl?esc(audioName(q)):'Upload audio'}</span><input type="file" data-field="audio" accept="audio/*" ${readOnly?'disabled':''}></label>${q.audioUrl?`<button type="button" class="audio-preview" data-action="preview-inline-audio" title="Nghe thử audio" aria-label="Nghe thử audio">${icons.play}</button><audio class="inline-audio-preview" preload="metadata" src="${esc(q.audioUrl)}"></audio>`:icons.upload}</div>`;
}

function questionImageHtml(q,readOnly,showQuestionImage){
  if(!showQuestionImage)return '';
  const imageUrl=q.instructionImageUrl||'';
  return `<label class="section-image-upload question-image-upload" title="${imageUrl?'Bấm để thay hình ảnh câu hỏi':'Upload hình'}"><span class="section-image-label">${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình ảnh câu hỏi">`:`${icons.imageUpload}<span>Upload hình</span>`}</span><input type="file" data-question-card-image accept="image/*" ${readOnly?'disabled':''}></label>`;
}

function scoreControls(q,defaultScore,readOnly,{mixed=false}={}){
  const removeAction=mixed?'hide-mixed-choice':'remove-inline-question',addAction=mixed?'restore-mixed-choice':'add-inline-question';
  return `<div class="goethe-score"><label class="${q.example?'is-disabled':''}"><input data-field="maxScore" type="number" min="0" value="${Number(q.maxScore??defaultScore)}" ${readOnly||q.example?'disabled':''}><span>đ</span></label><div class="goethe-question-actions"><button type="button" class="icon-btn question-example-toggle ${q.example?'active':''}" data-action="toggle-question-example" data-id="${q.id}" title="${q.example?'Chuyển thành câu tính điểm':'Đặt làm câu ví dụ'}" aria-label="${q.example?'Chuyển thành câu tính điểm':'Đặt làm câu ví dụ'}" aria-pressed="${Boolean(q.example)}" ${readOnly?'disabled':''}>${icons.example}</button><button type="button" class="icon-btn" data-action="${removeAction}" data-id="${q.id}" title="Ẩn câu" aria-label="Ẩn câu" ${readOnly?'disabled':''}>${icons.remove}</button><button type="button" class="icon-btn" data-action="${addAction}" ${mixed?'data-id':'data-after'}="${q.id}" title="Hiện câu" aria-label="Hiện câu" ${readOnly?'disabled':''}>${icons.add}</button></div></div>`;
}

function choicesHtml(q,choiceProfile,readOnly){
  if(choiceProfile.uniqueLetters)return `<div class="letter-builder-answer"><label for="correct-${esc(q.id)}">Đáp án đúng</label><select class="truong" id="correct-${esc(q.id)}" data-field="correct" ${readOnly?'disabled':''}>${choiceProfile.choices.map((letter,i)=>`<option value="${i}" ${Number(q.correctAnswer)===i?'selected':''}>${esc(letter.toLowerCase())}</option>`).join('')}</select>${choiceProfile.choices.map((letter,i)=>`<input type="hidden" data-choice="${i}" value="${esc(letter)}">`).join('')}</div>`;
  const choices=[...(q.choices||[]),...Array(choiceProfile.choices.length).fill('')].slice(0,choiceProfile.choices.length);
  return `<div class="goethe-answer-row"><div class="goethe-choices ${choiceProfile.cssClass}">${choiceProfile.choices.map((label,choiceIndex)=>{
    const choice=choices[choiceIndex],imageUrl=typeof choice==='object'?choice.imageUrl:'',hasImage=Boolean(imageUrl),text=blank(textOf(choice))||'';
    return `<label><input data-field="correct" type="radio" name="answer-${q.id}" value="${choiceIndex}" ${Number(q.correctAnswer)===choiceIndex?'checked':''} ${readOnly?'disabled':''}>${choiceProfile.showLabels?`<b>${esc(label)}</b>`:''}${choiceProfile.showChoiceImages?`<span class="choice-image-upload ${hasImage?'has-image':''}" title="${hasImage?'Bấm để thay hình ảnh đáp án':'Tải hình ảnh đáp án'}">${hasImage?`<img class="choice-uploaded-image" src="${esc(imageUrl)}" alt="Ảnh đáp án ${esc(label)}">`:icons.imageUpload}${hasImage?`<span class="choice-image-tooltip"><img src="${esc(imageUrl)}" alt="Ảnh đáp án ${esc(label)}"></span>`:''}<input type="file" data-choice-image="${choiceIndex}" accept="image/*" ${readOnly?'disabled':''}></span>`:''}<input data-choice="${choiceIndex}" placeholder="Nhập đáp án" value="${esc(text)}" ${readOnly?'disabled':''}></label>`;
  }).join('')}</div></div>`;
}

function choiceQuestionHtml(q,index,{defaultScore,readOnly,choiceProfile}){
  const stimulus=choiceProfile.instructionImage&&Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length?fixedStimulusHtml(q,index,readOnly):'';
  const media=choiceProfile.questionImage?questionImageHtml(q,readOnly,true):audioHtml(q,readOnly,choiceProfile.showAudio);
  return `<article class="goethe-question ${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="choices" data-question-id="${q.id}">${stimulus}<div class="goethe-question-row"><textarea data-field="title" placeholder="${choiceProfile.letterTable?'Tên người trong bảng đáp án':q.example?'Câu ví dụ (Beispiel)':'Câu hỏi '+(index+1)}" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea><div class="goethe-question-side">${scoreControls(q,defaultScore,readOnly)}${media}</div></div>${choicesHtml(q,choiceProfile,readOnly)}</article>`;
}

function fixedStimulusHtml(q,questionIndex,readOnly){
  return q.instructionBlocks.map((block,index)=>questionInstructionHtml(q,block,index,readOnly,{questionIndex})).join('');
}

function formRowsHtml(q,{readOnly,choiceProfile,start=0,end}){
  const stored=Array.isArray(q.rubric)?q.rubric:[];
  const count=stored.length||choiceProfile.formFieldCount;
  const last=Math.min(count,end??count);
  return Array.from({length:Math.max(0,last-start)},(_,offset)=>{
    const index=start+offset;
    const row=stored[index]||{},score=Number(row.maxScore??choiceProfile.formDefaultScores[index]??1),type=row.type||'text',hidden=Boolean(row.hidden);
    const answerControl=type==='image'
      ?`<label class="rubric-image-upload"><span>${row.imageUrl?`<img src="${esc(row.imageUrl)}" alt="Hình trong form">`:'Thêm hình'}</span><input type="file" data-rubric-image accept="image/*" ${readOnly?'disabled':''}></label>`
      :`<input data-rubric-answer placeholder="${type==='heading'?'Tiêu đề trong khung':type==='static'?'Nội dung cố định':type==='choice'?'Các phương án, cách nhau bằng dấu |':'Nội dung / đáp án'}" value="${esc(row.answers||'')}" ${readOnly?'disabled':''}>`;
    const scored=isScoredWritingField({...row,type,hidden});
    const typeLabels={heading:'Tiêu đề form',static:'Nội dung cố định',text:'Ô nhập text',truefalse:'Đúng / sai',choice:'Chọn phương án',image:'Thêm hình'};
    return `<div class="writing-form-row ${hidden?'is-hidden':''}" data-rubric-index="${index}" data-rubric-hidden="${hidden}"><select data-rubric-type aria-label="Loại trường" ${readOnly?'disabled':''}>${WRITING_FORM_TYPES.map(value=>`<option value="${value}" ${type===value?'selected':''}>${typeLabels[value]}</option>`).join('')}</select><input data-rubric-label placeholder="Nhãn trường" value="${esc(row.label||'')}" ${readOnly?'disabled':''}>${answerControl}<label class="${scored&&!q.example?'':'is-disabled'}"><input data-rubric-score type="number" min="0" step="0.01" value="${scored?score:0}" ${readOnly||!scored||q.example?'disabled':''}><span>đ</span></label><button type="button" class="icon-btn" data-action="remove-rubric-row" data-id="${q.id}" data-index="${index}" title="Xóa trường" aria-label="Xóa trường" ${readOnly?'disabled':''}>${icons.remove}</button><button type="button" class="icon-btn" data-action="add-rubric-row" data-id="${q.id}" data-index="${index}" title="Thêm trường cùng loại vào cuối" aria-label="Thêm trường cùng loại vào cuối" ${readOnly?'disabled':''}>${icons.add}</button></div>`;
  }).join('');
}

function writingFormHtml(q,{readOnly,choiceProfile}){
  const rows=formRowsHtml(q,{readOnly,choiceProfile});
  return `<article class="writing-form ${choiceProfile.formFrame?'writing-form--framed ':''}${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="form-fields" data-question-id="${q.id}">${rows}</article>`;
}

function mixedWritingFormHtml(q,{defaultScore,readOnly,choiceProfile}){
  const stored=Array.isArray(q.rubric)?q.rubric:[];
  const count=stored.length||choiceProfile.formFieldCount;
  const before=formRowsHtml(q,{readOnly,choiceProfile,start:0,end:Math.max(0,count-1)});
  const last=formRowsHtml(q,{readOnly,choiceProfile,start:Math.max(0,count-1),end:count});
  const middle=`<div class="goethe-question mixed-writing-question ${q.mixedChoiceHidden?'is-hidden':''}" data-mixed-choice-hidden="${Boolean(q.mixedChoiceHidden)}"><div class="goethe-question-row"><textarea data-field="title" placeholder="Câu hỏi 1" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea><div class="goethe-question-side">${scoreControls(q,defaultScore,readOnly,{mixed:true})}${audioHtml(q,readOnly,choiceProfile.showAudio)}</div></div>${choicesHtml(q,choiceProfile,readOnly)}</div>`;
  const blocks=instructionBlocksFor(q);
  return `<article class="writing-form writing-form--mixed ${choiceProfile.formFrame?'writing-form--framed ':''}${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="mixed-form" data-question-id="${q.id}">${before}${middle}${last}${blocks.length?`<div class="mixed-writing-instructions">${blocks.map((block,index)=>questionInstructionHtml(q,block,index,readOnly)).join('')}</div>`:''}</article>`;
}

function freeResponseHtml(q,{defaultScore,readOnly}){
  return `<article class="goethe-free-response ${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="free-response" data-question-id="${q.id}"><textarea data-field="title" placeholder="Câu trả lời textarea" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea>${scoreControls(q,defaultScore,readOnly)}</article>`;
}

function instructionHtml(section,choiceProfile,readOnly,question){
  const instruction=`<textarea id="sectionInstruction" placeholder="Đề bài" ${readOnly?'disabled':''}>${esc(section.instruction||'')}</textarea>`;
  if(!choiceProfile.instructionImage)return `<div class="goethe-instruction">${instruction}</div>`;
  const imageUrl=section.instructionImageUrl||'';
  const addInstruction=question?`<button type="button" class="icon-btn" data-action="add-question-instruction" data-id="${question.id}" title="Thêm đề bài" aria-label="Thêm đề bài" ${readOnly?'disabled':''}>${icons.add}</button>`:'';
  return `<div class="goethe-instruction goethe-instruction--media" data-section-image-control data-has-image="${imageUrl?'true':'false'}">${instruction}<div class="goethe-instruction-actions"><div class="goethe-instruction-icons"><input class="truong instruction-image-width" id="sectionImageMaxWidth" type="number" min="1" step="1" aria-label="img width (px)" placeholder="img width (px)" value="${imageMaxWidth(section.instructionImageMaxWidth)??''}" ${readOnly?'disabled':''}><button type="button" class="icon-btn" data-action="clear-section-image" title="Xóa hình ảnh đề bài" aria-label="Xóa hình ảnh đề bài" ${readOnly?'disabled':''}>${icons.remove}</button>${addInstruction}</div><label class="section-image-upload" title="${imageUrl?'Bấm để thay hình ảnh đề bài':'Thêm hình ảnh đề bài'}"><span class="section-image-label">${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình ảnh đề bài">`:`${icons.addImage}<span>Thêm hình ảnh</span>`}</span><input type="file" data-section-image accept="image/*" ${readOnly?'disabled':''}></label></div></div>`;
}

function instructionBlocksFor(q){
  return Array.isArray(q.instructionBlocks)?q.instructionBlocks:[{text:q.prompt||'',imageUrl:q.instructionImageUrl||''}];
}

function questionInstructionHtml(q,block,index,readOnly,{questionIndex=null}={}){
  const imageUrl=block.imageUrl||'';
  const move=questionIndex===null?'':`<button type="button" class="icon-btn" data-action="move-question-instruction" data-id="${q.id}" data-index="${index}" data-dir="up" title="Đưa đề bài lên" aria-label="Đưa đề bài lên" ${readOnly||questionIndex===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-action="move-question-instruction" data-id="${q.id}" data-index="${index}" data-dir="down" title="Đưa đề bài xuống" aria-label="Đưa đề bài xuống" ${readOnly?'disabled':''}>↓</button>`;
  return `<div class="goethe-instruction goethe-instruction--media mixed-writing-instruction" data-question-instruction-block data-question-image-control data-index="${index}" data-has-image="${imageUrl?'true':'false'}"><textarea data-instruction-prompt placeholder="Đề bài" ${readOnly?'disabled':''}>${esc(block.text||'')}</textarea><div class="goethe-instruction-actions"><div class="goethe-instruction-icons">${move}<button type="button" class="icon-btn" data-action="remove-question-instruction" data-id="${q.id}" data-index="${index}" title="Xóa đề bài" aria-label="Xóa đề bài" ${readOnly?'disabled':''}>${icons.remove}</button><button type="button" class="icon-btn" data-action="add-question-instruction" data-id="${q.id}" title="Thêm đề bài" aria-label="Thêm đề bài" ${readOnly?'disabled':''}>${icons.add}</button></div><label class="section-image-upload" title="${imageUrl?'Bấm để thay hình ảnh đề bài':'Thêm hình ảnh đề bài'}"><span class="section-image-label">${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình ảnh đề bài">`:`${icons.addImage}<span>Thêm hình ảnh</span>`}</span><input type="file" data-question-instruction-image="${index}" accept="image/*" ${readOnly?'disabled':''}></label></div></div>`;
}

export function renderBuilder({data,exam,section,readOnly=false}={}){
  if(!section)return '<div class="rong">Chọn một phần để cấu hình.</div>';
  const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean).sort((a,b)=>Number(Boolean(b.example))-Number(Boolean(a.example)));
  const choiceProfile=profileFor(section);
  const audioIds=new Set(partAudioQuestions(section,questions).map(q=>q.id));
  const renderQuestion=(q,index)=>choiceProfile.formFrame
    ?writingFormEditor(q,{readOnly})
    :choiceProfile.isWritingForm
    ?writingFormHtml(q,{readOnly,choiceProfile})
    :choiceProfile.isMixedForm
      ?mixedWritingFormHtml(q,{defaultScore,readOnly,choiceProfile})
    :choiceProfile.isFreeResponse
      ?freeResponseHtml(q,{defaultScore,readOnly})
      :choiceQuestionHtml(q,index,{defaultScore,readOnly,choiceProfile:{...choiceProfile,showAudio:choiceProfile.showAudio&&audioIds.has(q.id)}});
  return `<div class="part-editor" data-template-type="${esc(section.templateType||'GENERIC')}">${section.questionProfile?.layout==='letter-table'?`<label class="part-display-setting">Nhãn bảng<input class="truong" id="sectionTableHeading" value="${esc(section.tableHeading??'Person')}" ${readOnly?'disabled':''}></label>`:''}${instructionHtml(section,choiceProfile,readOnly,choiceProfile.instructionImage?questions.find(question=>!question.example)||questions[0]:null)}<div class="goethe-questions">${questions.map(renderQuestion).join('')||'<div class="rong">Chưa có câu hỏi trong bài này.</div>'}</div></div>`;
}

export function bindBuilder({root=document,data,exam,section,pendingAudioUploads=new Map(),notify=()=>{}}={}){
  if(!section)return;
  const resetAudioPreview=button=>{button.innerHTML=icons.play;button.title='Nghe thử audio';button.setAttribute('aria-label','Nghe thử audio');};
  const bindInlineAudioPreview=button=>button.onclick=async()=>{
    const control=button.closest('.audio-upload'),audio=control?.querySelector('.inline-audio-preview');if(!audio)return;
    if(!audio.paused){audio.pause();audio.currentTime=0;resetAudioPreview(button);return;}
    root.querySelectorAll('.inline-audio-preview').forEach(item=>{if(item===audio)return;item.pause();item.currentTime=0;const other=item.closest('.audio-upload')?.querySelector('.audio-preview');if(other)resetAudioPreview(other);});
    try{if(audio.ended)audio.currentTime=0;await audio.play();button.innerHTML='<span class="audio-stop-icon" aria-hidden="true"></span>';button.title='Dừng audio';button.setAttribute('aria-label','Dừng audio');audio.onended=()=>resetAudioPreview(button);audio.onpause=()=>{if(!audio.ended)resetAudioPreview(button);};}catch{notify('Không thể phát audio này. Hãy thử chọn lại tệp.');}
  };
  const showUploadedAudio=(control,{url,name})=>{
    control.classList.add('has-audio');const label=control.querySelector('.audio-file-select span');if(label)label.textContent=name;control.querySelector(':scope > img, :scope > svg')?.remove();
    let audio=control.querySelector('.inline-audio-preview');if(!audio){audio=document.createElement('audio');audio.className='inline-audio-preview';audio.preload='metadata';control.append(audio);}audio.src=url;
    let button=control.querySelector('.audio-preview');if(!button){button=document.createElement('button');button.type='button';button.className='audio-preview';control.insertBefore(button,audio);bindInlineAudioPreview(button);}resetAudioPreview(button);
  };
  root.querySelectorAll('.audio-upload input[data-field="audio"]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.audio-upload'),questionId=input.closest('.part-question')?.dataset.questionId,label=control?.querySelector('.audio-file-select span');if(!file||!control||!questionId||!label)return;
    input.disabled=true;label.textContent='Đang tải audio · 0%';const upload={name:file.name,promise:null};
    upload.promise=uploadQuestionAudio(file,{onProgress:percent=>{if(pendingAudioUploads.get(questionId)===upload)label.textContent=`Đang tải audio · ${percent}%`;}}).then(url=>{if(pendingAudioUploads.get(questionId)===upload)showUploadedAudio(control,{url,name:file.name});return {url,name:file.name};}).catch(error=>{if(pendingAudioUploads.get(questionId)===upload){pendingAudioUploads.delete(questionId);label.textContent='Tải audio thất bại';notify(error.message);}throw error;}).finally(()=>{if(pendingAudioUploads.get(questionId)===upload)input.disabled=false;});
    pendingAudioUploads.set(questionId,upload);upload.promise.catch(()=>{});
  });
  root.querySelectorAll('[data-choice-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.choice-image-upload');if(!file||!control)return;control.classList.add('has-image');control.title='Bấm để thay hình ảnh đáp án';const objectUrl=URL.createObjectURL(file);let thumbnail=control.querySelector(':scope > img');
    if(!thumbnail){control.querySelector(':scope > svg')?.remove();thumbnail=document.createElement('img');control.prepend(thumbnail);}thumbnail.src=objectUrl;thumbnail.className='choice-uploaded-image';thumbnail.alt='Ảnh đáp án đã chọn';control.querySelector('.choice-image-tooltip')?.remove();const tooltip=document.createElement('span'),preview=new Image();tooltip.className='choice-image-tooltip';preview.alt='Ảnh đáp án đã chọn';preview.src=objectUrl;tooltip.append(preview);control.append(tooltip);
  });
  root.querySelectorAll('[data-rubric-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],picker=input.closest('.writing-image-picker');
    if(file&&picker){let img=picker.querySelector('img');if(!img){img=document.createElement('img');img.alt='Ảnh trong form';picker.prepend(img);}img.src=URL.createObjectURL(file);return;}
    const label=input.closest('.rubric-image-upload')?.querySelector('span');if(!file||!label)return;
    label.innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Hình trong form">`;
  });
  root.querySelectorAll('[data-section-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('[data-section-image-control]');if(!file||!control)return;const url=URL.createObjectURL(file),label=control.querySelector('.section-image-label');control.dataset.hasImage='true';control.dataset.removeSectionImage='false';if(label)label.innerHTML=`<img src="${url}" alt="Hình ảnh đề bài">`;
  });
  root.querySelector('[data-action="clear-section-image"]')?.addEventListener('click',()=>{
    const control=root.querySelector('[data-section-image-control]'),label=control?.querySelector('.section-image-label');if(!control||!label)return;control.dataset.hasImage='false';control.dataset.removeSectionImage='true';root.querySelectorAll('[data-section-image]').forEach(input=>{input.value='';});label.innerHTML=`${icons.imageUpload}<span>Thêm hình ảnh</span>`;
  });
  root.querySelectorAll('[data-question-instruction-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('[data-question-image-control]');if(!file||!control)return;const url=URL.createObjectURL(file),label=control.querySelector('.section-image-label');control.dataset.hasImage='true';control.dataset.removeQuestionImage='false';if(label)label.innerHTML=`<img src="${url}" alt="Hình ảnh đề bài">`;
  });
  root.querySelectorAll('[data-question-card-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],label=input.closest('.question-image-upload')?.querySelector('.section-image-label');if(!file||!label)return;
    label.innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Hình ảnh câu hỏi">`;
  });
  root.querySelectorAll('[data-action="clear-question-image"]').forEach(button=>button.addEventListener('click',()=>{
    const control=button.closest('[data-question-image-control]'),label=control?.querySelector('.section-image-label');if(!control||!label)return;control.dataset.hasImage='false';control.dataset.removeQuestionImage='true';control.querySelectorAll('[data-question-instruction-image]').forEach(input=>{input.value='';});label.innerHTML=`${icons.addImage}<span>Thêm hình ảnh</span>`;
  }));
  const updateSkillTotals=()=>{
    const draftScores=new Map([...root.querySelectorAll('.part-question[data-question-id]')].map(card=>{
      const formScores=[...card.querySelectorAll('[data-rubric-index]:not(.is-hidden) [data-rubric-score]')];
      const rows=[...card.querySelectorAll('[data-rubric-index]:not(.is-hidden)')].map(row=>({type:row.querySelector('[data-rubric-type]')?.value||'text',maxScore:Number(row.querySelector('[data-rubric-score]')?.value)||0}));
      const score=card.dataset.example==='true'?0:normalizedScore(formScores.length
        ?writingFormScore(rows)+(card.dataset.editorMode==='mixed-form'&&card.querySelector('[data-mixed-choice-hidden]')?.dataset.mixedChoiceHidden!=='true'?Math.max(0,Number(card.querySelector('[data-field="maxScore"]')?.value)||0):0)
        :Math.max(0,Number(card.querySelector('[data-field="maxScore"]')?.value)||0));
      const display=card.querySelector('[data-writing-total]');if(display)display.textContent=`${writingFormScore(rows)} điểm`;
      return [card.dataset.questionId,score];
    }));
    root.querySelectorAll('[data-skill-total]').forEach(total=>{const skill=total.dataset.skillTotal;const sum=(exam.sections||[]).filter(item=>item.skill===skill).reduce((skillScore,item)=>{const fallback=Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);return skillScore+(item.questionIds||[]).reduce((partScore,id)=>partScore+(draftScores.has(id)?draftScores.get(id):getQuestionMaxScore(byId(data.questions,id),fallback)),0);},0);total.textContent=`${Number.isInteger(sum)?sum:Number(sum.toFixed(2))} điểm`;});
  };
  root.querySelectorAll('[data-field="maxScore"],[data-rubric-score]').forEach(input=>input.oninput=updateSkillTotals);updateSkillTotals();root.querySelectorAll('[data-action="preview-inline-audio"]').forEach(bindInlineAudioPreview);
}
