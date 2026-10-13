import {imageWidthInput} from '../../ui/image-width.js';
import {sectionInstructions,instructionAudioKey,supportsInstructionPositions,instructionPosition} from '../../domain/section-instructions.js';
import {isPrefilledQuestion} from '../../domain/question-display.js';
import {esc} from '../../ui/format.js';
import {iconHtml} from '../../ui/icons.js';
import {modernInstructionText} from '../../domain/text-markup.js';
import {imageValue} from '../../ui/image-remove.js';
import {uploadQuestionImage} from '../../media.js';

export function sectionInstructionEditor(section,{readOnly,placeholder,audioHtml}){
  const blocks=sectionInstructions(section),disabled=readOnly?'disabled':'';
  const listening=section.skillKey==='listening'||/nghe|hören|listening/i.test(section.skill||'');
  return `<div class="section-instructions">${blocks.map((block,index)=>{
    const primary=index===0,showImage=!primary||section.questionProfile?.layout!=='inline-gaps';
    const button=(action,label,icon,unavailable=false)=>`<button type="button" class="icon-btn" data-section-instruction-action="${action}" data-index="${index}" aria-label="${label}" title="${label}" ${readOnly||unavailable?'disabled':''}>${icon}</button>`;
    const image=showImage?`<label class="section-image-upload" title="Thêm hoặc thay hình ảnh đề bài"><span class="section-image-label">${block.imageUrl?`<img src="${esc(block.imageUrl)}" alt="Hình ảnh đề bài ${index+1}">`:`${iconHtml('image')}<span>Thêm hình ảnh</span>`}</span><input type="file" ${primary?'data-section-image':'data-prompt-image'} accept="image/*" aria-label="Ảnh đề bài ${index+1}" ${disabled}></label>${imageWidthInput(block.imageMaxWidth,{id:primary?'sectionImageMaxWidth':'',attributes:'data-prompt-width',disabled:readOnly})}`:'';
    return `<section class="goethe-instruction section-prompt-editor" data-section-prompt="${esc(block.id)}" ${primary&&showImage?'data-section-image-control':''} data-has-image="${Boolean(block.imageUrl)}"><div class="instruction-content"><textarea ${primary?'id="sectionInstruction"':''} data-prompt-text aria-label="Đề bài ${index+1}" placeholder="${esc(placeholder)}" ${disabled}>${esc(modernInstructionText(block.text))}</textarea></div><div class="section-prompt-tools">${image}${listening?`<div role="group" aria-label="Audio đề bài" data-audio-question-id="${esc(instructionAudioKey(section,block.id))}">${audioHtml(block,readOnly,true)}</div>`:''}${supportsInstructionPositions(section)?`<select class="truong" data-prompt-position aria-label="Vị trí đề bài" ${disabled}><option value="${block.afterQuestion}">Vị trí đề bài</option></select>`:''}<div class="section-prompt-actions">${button('up','Đưa đề bài lên',iconHtml('arrowUp'),index===0)}${button('down','Đưa đề bài xuống',iconHtml('arrowDown'),index===blocks.length-1)}${button('remove','Bỏ đề bài',iconHtml('close'),blocks.length===1)}${button('add','Thêm đề bài bên dưới',iconHtml('plus'))}</div></div></section>`;
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
    blocks.push({...old,id,text:control.querySelector('[data-prompt-text]').value,afterQuestion:Number(control.querySelector('[data-prompt-position]')?.value||0),
      imageUrl:imageValue(input,uploaded,old.imageUrl),imageMaxWidth:control.querySelector('[data-prompt-width]')?.value||null,
      audioUrl:audio?.url??old.audioUrl??'',audioName:audio?.name??old.audioName??''});
  }
  blocks.sort((a,b)=>previous.findIndex(item=>item.id===a.id)-previous.findIndex(item=>item.id===b.id));
  return {blocks,complete(){uploads.forEach(input=>{input.value='';});audioUploads.forEach(([key,pending])=>{if(pendingAudioUploads.get(key)===pending)pendingAudioUploads.delete(key);});}};
}

export function placeInstructionEditors(root,section,exam,questions){
  if(!supportsInstructionPositions(section))return;
  const questionMap=new Map(questions.map(q=>[q.id,q])),numbers=new Map();let number=0;
  for(const part of exam.sections||[])for(const id of part.questionIds||[])if(questionMap.has(id)&&!isPrefilledQuestion(questionMap.get(id)))numbers.set(id,++number);
  const cards=[...root.querySelectorAll('article.part-question')].filter(card=>!isPrefilledQuestion(questionMap.get(card.dataset.questionId)));
  const blocks=sectionInstructions(section),tails=new Map();
  for(const control of root.querySelectorAll('[data-section-prompt]')){
    const block=blocks.find(item=>item.id===control.dataset.sectionPrompt),position=instructionPosition(block||{},cards.length);
    const select=control.querySelector('[data-prompt-position]');
    if(select){select.innerHTML=`<option value="0">Đầu bài</option>`+cards.map((card,index)=>`<option value="${index+1}">Sau câu ${numbers.get(card.dataset.questionId)??index+1}</option>`).join('');select.value=String(position);}
    if(position){const anchor=tails.get(position)||cards[position-1];anchor.after(control);tails.set(position,control);}
  }
}
