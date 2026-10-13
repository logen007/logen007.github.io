import {imageWidthInput} from '../../ui/image-width.js';
import {sectionInstructions,instructionAudioKey,instructionPosition} from '../../domain/section-instructions.js';
import {isPrefilledQuestion} from '../../domain/question-display.js';
import {esc} from '../../ui/format.js';
import {iconHtml} from '../../ui/icons.js';
import {modernInstructionText} from '../../domain/text-markup.js';
import {imageValue} from '../../ui/image-remove.js';
import {uploadQuestionImage} from '../../media.js';

export function promptEditorFrame({attributes='',textareaAttributes='',text='',placeholder='',tools='',readOnly=false}){
  return `<section class="goethe-instruction section-prompt-editor" ${attributes}><div class="instruction-content"><textarea ${textareaAttributes} placeholder="${esc(placeholder)}" ${readOnly?'disabled':''}>${esc(modernInstructionText(text))}</textarea></div><div class="section-prompt-tools">${tools}</div></section>`;
}

export function questionPromptEditor(q,block,index,{readOnly,placeholder,audioHtml}){
  const disabled=readOnly?'disabled':'',imageUrl=block.imageUrl||'';
  const audioKey=`question-prompt:${q.id}:${index}`;
  const listening=q.skillKey==='listening'||/nghe|hören|listening/i.test(q.skill||'');
  const button=(action,label,icon,extra='')=>`<button type="button" class="icon-btn" data-action="${action}" data-id="${esc(q.id)}" data-index="${index}" ${extra} aria-label="${label}" title="${label}" ${disabled}>${iconHtml(icon)}</button>`;
  const tools=`<label class="section-image-upload" title="Thêm hình ảnh đề bài"><span class="section-image-label">${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình ảnh đề bài">`:`${iconHtml('image')}<span>Thêm hình ảnh</span>`}</span><input type="file" data-question-instruction-image="${index}" accept="image/*" ${disabled}></label>${imageWidthInput(block.imageMaxWidth,{attributes:'data-question-prompt-width',disabled:readOnly})}${listening?`<div role="group" aria-label="Audio đề bài" data-audio-question-id="${esc(audioKey)}">${audioHtml(block,readOnly,true)}</div>`:''}<div class="section-prompt-actions">${button('move-question-instruction','Đưa đề bài lên','arrowUp','data-dir="up"')}${button('move-question-instruction','Đưa đề bài xuống','arrowDown','data-dir="down"')}${button('remove-question-instruction','Bỏ đề bài','close')}${button('add-question-instruction','Thêm đề bài bên dưới','plus')}</div>`;
  return promptEditorFrame({attributes:`data-question-instruction-block data-question-image-control data-index="${index}" data-has-image="${Boolean(imageUrl)}"`,textareaAttributes:'data-instruction-prompt aria-label="Đề bài"',text:block.text,placeholder,tools,readOnly});
}

export function sectionInstructionEditor(section,{readOnly,placeholder,audioHtml}){
  const blocks=sectionInstructions(section),disabled=readOnly?'disabled':'';
  const listening=section.skillKey==='listening'||/nghe|hören|listening/i.test(section.skill||'');
  return `<div class="section-instructions">${blocks.map((block,index)=>{
    const primary=index===0,showImage=true;
    const button=(action,label,icon,unavailable=false)=>`<button type="button" class="icon-btn" data-section-instruction-action="${action}" data-index="${index}" aria-label="${label}" title="${label}" ${readOnly||unavailable?'disabled':''}>${icon}</button>`;
    const image=showImage?`<label class="section-image-upload" title="Thêm hoặc thay hình ảnh đề bài"><span class="section-image-label">${block.imageUrl?`<img src="${esc(block.imageUrl)}" alt="Hình ảnh đề bài ${index+1}">`:`${iconHtml('image')}<span>Thêm hình ảnh</span>`}</span><input type="file" ${primary?'data-section-image':'data-prompt-image'} accept="image/*" aria-label="Ảnh đề bài ${index+1}" ${disabled}></label>${imageWidthInput(block.imageMaxWidth,{id:primary?'sectionImageMaxWidth':'',attributes:'data-prompt-width',disabled:readOnly})}`:'';
    const tools=`${image}${listening?`<div role="group" aria-label="Audio đề bài" data-audio-question-id="${esc(instructionAudioKey(section,block.id))}">${audioHtml(block,readOnly,true)}</div>`:''}<div class="section-prompt-actions">${button('up','Đưa đề bài lên',iconHtml('arrowUp'),index===0)}${button('down','Đưa đề bài xuống',iconHtml('arrowDown'))}${button('remove','Bỏ đề bài',iconHtml('close'))}${button('add','Thêm đề bài bên dưới',iconHtml('plus'))}</div>`;
    return promptEditorFrame({attributes:`data-section-prompt="${esc(block.id)}" ${primary?'data-section-image-control':''} data-has-image="${Boolean(block.imageUrl)}"`,textareaAttributes:`${primary?'id="sectionInstruction"':''} data-prompt-text aria-label="Đề bài ${index+1}"`,text:block.text,placeholder,tools,readOnly});
  }).join('')}</div>`;
}

export async function collectAdditionalInstructions(root,section,pendingAudioUploads,position){
  const previous=sectionInstructions(section),uploads=[],audioUploads=[];
  const blocks=[];
  for(const control of root.querySelectorAll('[data-section-prompt]')){
    const id=control.dataset.sectionPrompt;if(id==='main')continue;
    const old=previous.find(block=>block.id===id)||{},input=control.querySelector('[data-prompt-image]');
    const file=input?.files?.[0];
    const uploaded=file?await uploadQuestionImage(file,{...position,slot:id}):undefined;
    if(file)uploads.push(input);
    const key=instructionAudioKey(section,id),pending=pendingAudioUploads.get(key);
    const audio=pending?await pending.promise:null;
    if(pending)audioUploads.push([key,pending]);
    blocks.push({...old,id,text:control.querySelector('[data-prompt-text]').value,afterQuestion:old.afterQuestion||0,
      imageUrl:imageValue(input,uploaded,old.imageUrl),imageMaxWidth:control.querySelector('[data-prompt-width]')?.value||null,
      audioUrl:audio?.url??old.audioUrl??'',audioName:audio?.name??old.audioName??''});
  }
  blocks.sort((a,b)=>previous.findIndex(item=>item.id===a.id)-previous.findIndex(item=>item.id===b.id));
  return {blocks,complete(){uploads.forEach(input=>{input.value='';});audioUploads.forEach(([key,pending])=>{if(pendingAudioUploads.get(key)===pending)pendingAudioUploads.delete(key);});}};
}

export function placeInstructionEditors(root,section,exam,questions){
  const questionMap=new Map(questions.map(q=>[q.id,q]));
  const grouped=['inline-gaps','letter-table'].includes(section.questionProfile?.layout);
  const cards=grouped?[root.querySelector(section.questionProfile.layout==='inline-gaps'?'.inline-gap-editor':'.letter-group-editor')].filter(Boolean):[...root.querySelectorAll('article.part-question')].filter(card=>!isPrefilledQuestion(questionMap.get(card.dataset.questionId)));
  const blocks=sectionInstructions(section),tails=new Map();
  for(const control of root.querySelectorAll('[data-section-prompt]')){
    const block=blocks.find(item=>item.id===control.dataset.sectionPrompt),position=instructionPosition(block||{},cards.length);
    const index=blocks.indexOf(block),up=control.querySelector('[data-section-instruction-action="up"]'),down=control.querySelector('[data-section-instruction-action="down"]');
    if(up&&!control.querySelector('textarea')?.disabled)up.disabled=position===0&&index===0;
    if(down&&!control.querySelector('textarea')?.disabled)down.disabled=position===cards.length&&index===blocks.length-1;
    if(position){const anchor=tails.get(position)||cards[position-1];anchor.after(control);tails.set(position,control);}
  }
}
