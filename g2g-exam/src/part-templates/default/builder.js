import {examQuestionNumbers} from '../../domain/question-numbering.js';
import {sectionInstructionEditor,placeInstructionEditors,questionPromptEditor} from './section-instruction-editor.js';
import {imageMaxWidth,isPrefilledQuestion} from '../../domain/question-display.js';
import {byId,getQuestionMaxScore} from '../../core.js';
import {esc} from '../../ui/format.js';
import {uploadQuestionAudio} from '../../media.js';
import {iconHtml} from '../../ui/icons.js';
import {WRITING_FORM_TYPES,isScoredWritingField,writingFormScore} from '../../domain/writing-form.js';
import {writingFormEditor} from '../../ui/writing-form.js';
import {partAudioQuestions} from '../../domain/part-audio.js';
import {questionProfileAt} from '../../domain/question-profile.js';
import {inlineGapBuilder} from './inline-gap-builder.js';
import {headingMatchBuilder} from './heading-match-builder.js';
import {readingBlocksEditor} from '../../ui/reading-blocks.js';
import {letterTableBuilder,bindLetterTableBuilder} from './letter-table-builder.js';

const instructionPlaceholder=`Nhập hướng dẫn đề bài…
[b]chữ đậm[/b] · Cmd/Ctrl B
[i]chữ nghiêng[/i] · Cmd/Ctrl I
[u]gạch chân[/u] · Cmd/Ctrl U
[box]nội dung[/box] → đóng khung chữ
[headline]Tiêu đề[/headline] → tiêu đề lớn, riêng một dòng
[signature]Tên người ký[/signature] → chữ ký viết tay cỡ lớn
[img] → đặt ảnh đã tải lên tại đây
Trong ô soạn đoạn điền khuyết: {a}, {b}… là vị trí ô trả lời, không phải đáp án đúng; {z} là ví dụ nếu phần thi hỗ trợ.`;

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
export function builderQuestionScore(card,question){
  if(card.dataset.example==='true')return 0;
  const rows=[...card.querySelectorAll('[data-rubric-index]:not(.is-hidden)')].map(row=>({type:row.querySelector('[data-rubric-type]')?.value||'text',maxScore:Number(row.querySelector('[data-rubric-score]')?.value)||0}));
  const input=card.querySelector('[data-field="maxScore"],[data-heading-score]');
  const score=input?Math.max(0,Number(input.value)||0):getQuestionMaxScore(question);
  if(card.dataset.editorMode==='form-fields')return writingFormScore(rows);
  if(card.dataset.editorMode==='mixed-form')return writingFormScore(rows)+(card.querySelector('[data-mixed-choice-hidden]')?.dataset.mixedChoiceHidden==='true'?0:score);
  return score;
}

function profileFor(section){
  const source=section?.questionProfile||{};
  const isTrueFalse=source.layout==='true-false'&&Array.isArray(source.choices)&&source.choices.length===2;
  return {
    letterSelect:source.uniqueLetters===true||source.layout==='letter-select',
    letterTable:source.layout==='letter-table',
    type:source.type||'single',
    choices:Array.isArray(source.choices)&&source.choices.length>=2?source.choices:(isTrueFalse?['Richtig','Falsch']:['A','B','C']),
    cssClass:isTrueFalse?'goethe-choices--true-false':'',
    shortQuestion:isTrueFalse,
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

function audioHtml(q,readOnly,showAudio,emptyLabel='Tải audio lên'){
  if(!showAudio)return '';
  return `<div class="audio-upload ${q.audioUrl?'has-audio':''}"><label class="audio-file-select" title="${q.audioUrl?'Thay audio':'Tải audio'}"><span>${q.audioUrl?esc(audioName(q)):esc(emptyLabel)}</span><input type="file" aria-label="Tải audio" data-field="audio" accept="audio/*" ${readOnly?'disabled':''}></label><button type="button" class="audio-remove" data-remove-audio title="Bỏ audio" aria-label="Bỏ audio" ${readOnly?'disabled':''} ${q.audioUrl?'':'hidden'}>${icons.remove}</button>${q.audioUrl?`<button type="button" class="audio-preview" data-action="preview-inline-audio" title="Nghe thử audio" aria-label="Nghe thử audio">${icons.play}</button><audio class="inline-audio-preview" preload="metadata" src="${esc(q.audioUrl)}"></audio>`:icons.upload}</div>`;
}

function questionImageHtml(q,readOnly,showQuestionImage){
  if(!showQuestionImage)return '';
  const imageUrl=q.instructionImageUrl||'';
  return `<label class="section-image-upload question-image-upload" title="${imageUrl?'Bấm để thay hình ảnh câu hỏi':'Upload hình'}"><span class="section-image-label">${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình ảnh câu hỏi">`:`${icons.imageUpload}<span>Upload hình</span>`}</span><input type="file" data-question-card-image accept="image/*" ${readOnly?'disabled':''}></label>`;
}

function scoreControls(q,defaultScore,readOnly,{mixed=false,writingStyle=false,audio=''}={}){
  const removeAction=mixed?'hide-mixed-choice':'remove-inline-question',addAction=mixed?'restore-mixed-choice':'add-inline-question';
  return `<div class="goethe-score ${audio?'goethe-score--audio':''} ${writingStyle?'goethe-score--writing':''}"><label class="${q.example?'is-disabled':''}"><input data-field="maxScore" aria-label="Điểm" type="number" min="0" value="${Number(q.maxScore??defaultScore)}" ${readOnly||q.example?'disabled':''}><span>đ</span></label>${audio}${writingStyle?`<input type="hidden" data-field="handwriting" value="${q.handwriting!==false}"><button type="button" class="icon-btn writing-style-toggle" title="${q.handwriting!==false?'Viết tay':'Viết thường'}" aria-label="${q.handwriting!==false?'Viết tay':'Viết thường'}" data-writing-style-toggle aria-pressed="${q.handwriting!==false}" ${readOnly?'disabled':''}>${iconHtml(q.handwriting!==false?'grading':'type')}</button>`:''}<div class="goethe-question-actions"><button type="button" class="icon-btn question-example-toggle ${q.example?'active':''}" data-action="toggle-question-example" data-id="${q.id}" title="${q.example?'Chuyển thành câu tính điểm':'Đặt làm câu ví dụ'}" aria-label="${q.example?'Chuyển thành câu tính điểm':'Đặt làm câu ví dụ'}" aria-pressed="${Boolean(q.example)}" ${readOnly?'disabled':''}>${icons.example}</button><button type="button" class="icon-btn" data-action="${removeAction}" data-id="${q.id}" title="Ẩn câu" aria-label="Ẩn câu" ${readOnly?'disabled':''}>${icons.remove}</button><button type="button" class="icon-btn" data-action="${addAction}" ${mixed?'data-id':'data-after'}="${q.id}" title="Hiện câu" aria-label="Hiện câu" ${readOnly?'disabled':''}>${icons.add}</button></div></div>`;
}

function choicesHtml(q,choiceProfile,readOnly){
  if(choiceProfile.letterSelect)return `<div class="letter-builder-answer"><label for="correct-${esc(q.id)}">Đáp án đúng</label><select class="truong" id="correct-${esc(q.id)}" data-field="correct" ${readOnly?'disabled':''}>${choiceProfile.choices.map((letter,i)=>`<option value="${i}" ${Number(q.correctAnswer)===i?'selected':''}>${esc(letter.toLowerCase())}</option>`).join('')}</select>${choiceProfile.choices.map((letter,i)=>`<input type="hidden" data-choice="${i}" value="${esc(letter)}">`).join('')}</div>`;
  const choices=[...(q.choices||[]),...Array(choiceProfile.choices.length).fill('')].slice(0,choiceProfile.choices.length);
  return `<div class="goethe-answer-row"><div class="goethe-choices ${choiceProfile.cssClass}">${choiceProfile.choices.map((label,choiceIndex)=>{
    const choice=choices[choiceIndex],imageUrl=typeof choice==='object'?choice.imageUrl:'',hasImage=Boolean(imageUrl),text=blank(textOf(choice))||'';
    return `<label><input data-field="correct" type="radio" name="answer-${q.id}" value="${choiceIndex}" ${Number(q.correctAnswer)===choiceIndex?'checked':''} ${readOnly?'disabled':''}>${choiceProfile.showLabels?`<b>${esc(label)}</b>`:''}${choiceProfile.showChoiceImages?`<span class="choice-image-upload ${hasImage?'has-image':''}" title="${hasImage?'Bấm để thay hình ảnh đáp án':'Tải hình ảnh đáp án'}">${hasImage?`<img class="choice-uploaded-image" src="${esc(imageUrl)}" alt="Ảnh đáp án ${esc(label)}">`:icons.imageUpload}${hasImage?`<span class="choice-image-tooltip"><img src="${esc(imageUrl)}" alt="Ảnh đáp án ${esc(label)}"></span>`:''}<input type="file" data-choice-image="${choiceIndex}" accept="image/*" ${readOnly?'disabled':''}></span>`:''}<input data-choice="${choiceIndex}" placeholder="Nhập đáp án" value="${esc(text)}" ${readOnly?'disabled':''}></label>`;
  }).join('')}</div></div>`;
}

function choiceQuestionHtml(q,index,{defaultScore,readOnly,choiceProfile}){
  const stimulus=choiceProfile.instructionImage&&Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length?fixedStimulusHtml(q,index,readOnly):'';
  const media=choiceProfile.questionImage?questionImageHtml(q,readOnly,true):audioHtml(q,readOnly,choiceProfile.showAudio);
  return `<article class="goethe-question ${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="choices" data-question-id="${q.id}">${stimulus}<div class="goethe-question-row">${(choiceProfile.letterSelect||choiceProfile.shortQuestion)?`<input class="truong" type="text" data-field="title" aria-label="Câu hỏi" placeholder="Câu hỏi" value="${esc(blank(q.title))}" ${readOnly?'disabled':''}>`:`<textarea data-field="title" placeholder="${choiceProfile.letterTable?'Tên người trong bảng đáp án':q.example?'Câu ví dụ (Beispiel)':'Câu hỏi'}" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea>`}<div class="goethe-question-side">${scoreControls(q,defaultScore,readOnly,{audio:choiceProfile.questionImage?audioHtml(q,readOnly,choiceProfile.showAudio):media})}${choiceProfile.questionImage?media:''}</div></div>${choicesHtml(q,choiceProfile,readOnly)}</article>`;
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
  const middle=`<div class="goethe-question mixed-writing-question ${q.mixedChoiceHidden?'is-hidden':''}" data-mixed-choice-hidden="${Boolean(q.mixedChoiceHidden)}"><div class="goethe-question-row"><textarea data-field="title" placeholder="Câu hỏi 1" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea><div class="goethe-question-side">${scoreControls(q,defaultScore,readOnly,{mixed:true,audio:audioHtml(q,readOnly,choiceProfile.showAudio)})}</div></div>${choicesHtml(q,choiceProfile,readOnly)}</div>`;
  const blocks=instructionBlocksFor(q);
  return `<article class="writing-form writing-form--mixed ${choiceProfile.formFrame?'writing-form--framed ':''}${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="mixed-form" data-question-id="${q.id}">${before}${middle}${last}${blocks.length?`<div class="mixed-writing-instructions">${blocks.map((block,index)=>questionInstructionHtml(q,block,index,readOnly)).join('')}</div>`:''}</article>`;
}

function freeResponseHtml(q,{defaultScore,readOnly}){
  const rule=String(q.aiGradingRules||q.title||'').trim();
  return `<article class="goethe-free-response ${q.example?'is-example ':''}part-question" data-example="${Boolean(q.example)}" data-editor-mode="free-response" data-question-id="${q.id}"><textarea data-field="title" placeholder="QUY TẮC CHẤM ĐIỂM\n\nChỉ ghi tiêu chí + điểm từng ý.\n\nVD:\nLý do du lịch — 3đ\nHỏi KS rẻ — 3đ\nHỏi tham quan — 3đ\nChào đầu/cuối — 1đ\n\nChấm theo ý, chấp nhận diễn đạt tương đương; lỗi nhẹ không trừ riêng." aria-label="Quy tắc chấm AI" ${readOnly?'disabled':''}>${esc(blank(rule))}</textarea>${scoreControls(q,defaultScore,readOnly,{writingStyle:true})}</article>`;
}

function instructionHtml(section,choiceProfile,readOnly){
  return sectionInstructionEditor(section,{readOnly,placeholder:instructionPlaceholder,audioHtml});
}

function instructionBlocksFor(q){
  return Array.isArray(q.instructionBlocks)?q.instructionBlocks:[{text:q.prompt||'',imageUrl:q.instructionImageUrl||''}];
}

function questionInstructionHtml(q,block,index,readOnly,options={}){
  return questionPromptEditor(q,block,index,{readOnly,placeholder:instructionPlaceholder,audioHtml,...options});
}

export function renderBuilder({data,exam,section,readOnly=false}={}){
  if(!section)return '<div class="rong">Chọn một phần để cấu hình.</div>';
  const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean).sort((a,b)=>Number(Boolean(b.example))-Number(Boolean(a.example)));
  const choiceProfile=profileFor(section);
  const numbers=examQuestionNumbers(exam,data.questions);
  const listening=section.skillKey==='listening'||/nghe|hören|listening/i.test(section.skill||'');
  if(listening)choiceProfile.showAudio=true;
  if(section.questionProfile?.layout==='heading-match')return `<div class="part-editor">${instructionHtml(section,choiceProfile,readOnly,null)}${headingMatchBuilder(section,questions,readOnly,numbers)}</div>`;
  if(section.questionProfile?.readingBlocks){
    return `<div class="part-editor">${instructionHtml(section,choiceProfile,readOnly,null)}${readingBlocksEditor(section,readOnly)}<div class="goethe-questions">${questions.map((q,index)=>choiceQuestionHtml(q,index,{defaultScore,readOnly,choiceProfile})).join('')}</div></div>`;
  }
  if(section.questionProfile?.layout==='inline-gaps')return `<div class="part-editor">${instructionHtml(section,{...choiceProfile,instructionImage:false},readOnly,null)}${inlineGapBuilder(section,questions,readOnly,numbers)}</div>`;
  const audioIds=new Set(partAudioQuestions(section,questions).map(q=>q.id));
  if(section.questionProfile?.pairedQuestions){
    const pairs=[];
    for(let index=0;index<questions.length;index+=2){
      const pair=questions.slice(index,index+2),example=pair[0]?.example;
      const cards=pair.map((q,offset)=>choiceQuestionHtml(q,index+offset,{defaultScore,readOnly,choiceProfile:{...profileFor({questionProfile:questionProfileAt(section,offset)}),showAudio:listening||audioIds.has(q.id)}})).join('');
      pairs.push(`<section class="paired-question-group">${example?'<h3>Beispiel</h3>':''}${cards}</section>`);
    }
    return `<div class="part-editor paired-part-editor">${instructionHtml(section,choiceProfile,readOnly,null)}<div class="goethe-questions">${pairs.join('')}</div></div>`;
  }
  if(choiceProfile.letterTable)return `<div class="part-editor" data-template-type="${esc(section.templateType||'GENERIC')}">${instructionHtml(section,choiceProfile,readOnly,null)}${letterTableBuilder({questions,section,numbers,defaultScore,readOnly,audioHtml,choicesHtml:q=>choicesHtml(q,choiceProfile,readOnly)})}</div>`;
  const renderQuestion=(q,index)=>choiceProfile.formFrame
    ?writingFormEditor(q,{readOnly})
    :choiceProfile.isWritingForm
    ?writingFormHtml(q,{readOnly,choiceProfile})
    :choiceProfile.isMixedForm
      ?mixedWritingFormHtml(q,{defaultScore,readOnly,choiceProfile})
    :choiceProfile.isFreeResponse
      ?freeResponseHtml(q,{defaultScore,readOnly})
      :choiceQuestionHtml(q,index,{defaultScore,readOnly,choiceProfile:{...choiceProfile,showAudio:listening||(choiceProfile.showAudio&&audioIds.has(q.id))}});
  return `<div class="part-editor" data-template-type="${esc(section.templateType||'GENERIC')}">${section.questionProfile?.layout==='letter-table'?`<label class="part-display-setting">Nhãn bảng<input class="truong" id="sectionTableHeading" value="${esc(section.tableHeading??'Person')}" ${readOnly?'disabled':''}></label>`:''}${instructionHtml(section,choiceProfile,readOnly,choiceProfile.instructionImage?questions.find(question=>!question.example)||questions[0]:null)}<div class="goethe-questions">${questions.map(renderQuestion).join('')||'<div class="rong">Chưa có câu hỏi trong bài này.</div>'}</div></div>`;
}

export function numberBuilderQuestions(root,questions,exam){
  let number=0;
  const numbers=examQuestionNumbers(exam,questions);
  number=0;
  for(const card of root.querySelectorAll('article.part-question:not([hidden])')){
    const question=byId(questions,card.dataset.questionId);
    if(!question)continue;
    let label=card.querySelector(':scope > .builder-question-number');
    if(!label){label=card.ownerDocument.createElement('div');label.className='builder-question-number';card.prepend(label);}
    label.textContent=isPrefilledQuestion(question)?'Ví dụ':`${numbers.get(question.id)??++number}.`;
    const audioControls=card.querySelector(':scope > .goethe-question-row > .goethe-question-side > .goethe-score--audio');
    if(audioControls)label.after(audioControls);
  }
}

export function bindBuilder({root=document,data,exam,section,pendingAudioUploads=new Map(),notify=()=>{}}={}){
  numberBuilderQuestions(root,data.questions,exam);
  root.querySelectorAll('[data-writing-style-toggle]').forEach(button=>button.onclick=()=>{
    if(button.disabled)return;
    const field=button.parentElement.querySelector('[data-field="handwriting"]');
    field.value=field.value==='false'?'true':'false';
    button.setAttribute('aria-pressed',field.value);
    const handwritten=field.value==='true',label=handwritten?'Viết tay':'Viết thường';
    button.innerHTML=iconHtml(handwritten?'grading':'type');
    button.title=label;button.setAttribute('aria-label',label);
    field.dispatchEvent(new Event('change',{bubbles:true}));
  });
  if(!section)return;
  placeInstructionEditors(root,section,exam,data.questions);
  const resetAudioPreview=button=>{button.innerHTML=icons.play;button.title='Nghe thử audio';button.setAttribute('aria-label','Nghe thử audio');};
  const bindInlineAudioPreview=button=>button.onclick=async()=>{
    const control=button.closest('.audio-upload'),audio=control?.querySelector('.inline-audio-preview');if(!audio)return;
    if(!audio.paused){audio.pause();audio.currentTime=0;resetAudioPreview(button);return;}
    root.querySelectorAll('.inline-audio-preview').forEach(item=>{if(item===audio)return;item.pause();item.currentTime=0;const other=item.closest('.audio-upload')?.querySelector('.audio-preview');if(other)resetAudioPreview(other);});
    try{if(audio.ended)audio.currentTime=0;await audio.play();button.innerHTML='<span class="audio-stop-icon" aria-hidden="true"></span>';button.title='Dừng audio';button.setAttribute('aria-label','Dừng audio');audio.onended=()=>resetAudioPreview(button);audio.onpause=()=>{if(!audio.ended)resetAudioPreview(button);};}catch{notify('Không thể phát audio này. Hãy thử chọn lại tệp.');}
  };
  const showUploadedAudio=(control,{url,name})=>{
    control.querySelector('[data-remove-audio]').hidden=false;
    control.classList.add('has-audio');const label=control.querySelector('.audio-file-select span');if(label)label.textContent=name;control.querySelector(':scope > img, :scope > svg')?.remove();
    let audio=control.querySelector('.inline-audio-preview');if(!audio){audio=document.createElement('audio');audio.className='inline-audio-preview';audio.preload='metadata';control.append(audio);}audio.src=url;
    let button=control.querySelector('.audio-preview');if(!button){button=document.createElement('button');button.type='button';button.className='audio-preview';control.insertBefore(button,audio);bindInlineAudioPreview(button);}resetAudioPreview(button);
  };
  root.querySelectorAll('[data-remove-audio]').forEach(button=>button.onclick=()=>{
    if(button.disabled)return;
    const control=button.closest('.audio-upload'),input=control.querySelector('input[data-field="audio"]');
    const id=control.closest('[data-audio-question-id]')?.dataset.audioQuestionId||control.closest('.part-question')?.dataset.questionId;
    if(!id)return;
    pendingAudioUploads.set(id,{promise:Promise.resolve({url:'',name:''})});
    control.querySelector('audio')?.pause();control.querySelector('audio')?.remove();control.querySelector('.audio-preview')?.remove();
    input.value='';input.disabled=false;control.classList.remove('has-audio');button.hidden=true;
    control.querySelector('.audio-file-select span').textContent='Tải audio lên';
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  root.querySelectorAll('.audio-upload input[data-field="audio"]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.audio-upload'),questionId=input.closest('[data-audio-question-id]')?.dataset.audioQuestionId||input.closest('.part-question')?.dataset.questionId,label=control?.querySelector('.audio-file-select span');if(!file||!control||!questionId||!label)return;
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
  root.querySelectorAll('[data-section-image],[data-prompt-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('[data-section-prompt],[data-section-image-control]');if(!file||!control)return;const url=URL.createObjectURL(file),label=control.querySelector('.section-image-label');control.dataset.hasImage='true';control.dataset.removeSectionImage='false';if(label)label.innerHTML=`<img src="${url}" alt="Hình ảnh đề bài">`;
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
      const rows=[...card.querySelectorAll('[data-rubric-index]:not(.is-hidden)')].map(row=>({type:row.querySelector('[data-rubric-type]')?.value||'text',maxScore:Number(row.querySelector('[data-rubric-score]')?.value)||0}));
      const score=builderQuestionScore(card,byId(data.questions,card.dataset.questionId));
      const display=card.querySelector('[data-writing-total]');if(display)display.textContent=`${writingFormScore(rows)} điểm`;
      return [card.dataset.questionId,score];
    }));
    root.querySelectorAll('[data-gap-score]').forEach(input=>{
      const id=section.questionIds?.[Number(input.dataset.gapScore)];
      if(id)draftScores.set(id,Math.max(0,Number(input.value)||0));
    });
    const common=root.querySelector('[data-gap-common-score]');
    if(common&&common.value.trim()&&Number.isFinite(Number(common.value))&&Number(common.value)>=0)for(const id of section.questionIds||[])draftScores.set(id,Number(common.value));
    root.querySelectorAll('[data-skill-total]').forEach(total=>{const skill=total.dataset.skillTotal;const sum=(exam.sections||[]).filter(item=>item.skill===skill).reduce((skillScore,item)=>{const fallback=Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);return skillScore+(item.questionIds||[]).reduce((partScore,id)=>partScore+(draftScores.has(id)?draftScores.get(id):getQuestionMaxScore(byId(data.questions,id),fallback)),0);},0);total.textContent=`${Number.isInteger(sum)?sum:Number(sum.toFixed(2))} điểm`;});
  };
  bindLetterTableBuilder(root,updateSkillTotals);
  root.querySelectorAll('[data-field="maxScore"],[data-heading-score],[data-rubric-score],[data-gap-score],[data-gap-common-score]').forEach(input=>input.oninput=updateSkillTotals);updateSkillTotals();root.querySelectorAll('[data-action="preview-inline-audio"]').forEach(bindInlineAudioPreview);
}
