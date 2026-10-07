import {byId,getQuestionMaxScore} from '../../core.js';
import {esc} from '../../ui/format.js';
import {uploadQuestionAudio} from '../../media.js';

const icons={
  add:'<img src="src/assets/figma-icon-3.svg" alt="">',
  remove:'<img src="src/assets/figma-icon-2.svg" alt="">',
  upload:'<img src="src/assets/figma-icon-5.svg" alt="">',
  play:'<img src="src/assets/figma-icon-4.svg" alt="">',
  imageUpload:'<img src="src/assets/figma-icon-image-upload.svg" alt="">'
};
const blank=value=>value==='Nháp'?'':value;
const audioName=q=>{
  if(q.audioName)return q.audioName;
  if(String(q.audioUrl||'').startsWith('data:'))return 'Audio đã tải lên';
  return decodeURIComponent(String(q.audioUrl||'').split('/').pop().split('?')[0]||'Audio đã tải lên');
};

function questionHtml(q,index,{defaultScore,readOnly}){
  const choices=[...(q.choices||[]),'','',''].slice(0,3);
  const audio=`<div class="audio-upload ${q.audioUrl?'has-audio':''}"><label class="audio-file-select" title="${q.audioUrl?'Thay audio':'Tải audio'}"><span>${q.audioUrl?esc(audioName(q)):'Upload audio'}</span><input type="file" data-field="audio" accept="audio/*" ${readOnly?'disabled':''}></label>${q.audioUrl?`<button type="button" class="audio-preview" data-action="preview-inline-audio" title="Nghe thử audio" aria-label="Nghe thử audio">${icons.play}</button><audio class="inline-audio-preview" preload="metadata" src="${esc(q.audioUrl)}"></audio>`:icons.upload}</div>`;
  return `<article class="goethe-question part-question" data-question-id="${q.id}"><div class="goethe-question-row"><textarea data-field="title" placeholder="Câu hỏi ${index+1}" ${readOnly?'disabled':''}>${esc(blank(q.title))}</textarea><div class="goethe-score"><label><input data-field="maxScore" type="number" min="0" value="${Number(q.maxScore??defaultScore)}" ${readOnly?'disabled':''}><span>điểm</span></label><div class="goethe-question-actions"><button type="button" class="icon-btn" data-action="remove-inline-question" data-id="${q.id}" title="Xóa câu" aria-label="Xóa câu" ${readOnly?'disabled':''}>${icons.remove}</button><button type="button" class="icon-btn" data-action="add-inline-question" data-after="${q.id}" title="Thêm câu" aria-label="Thêm câu" ${readOnly?'disabled':''}>${icons.add}</button></div>${audio}</div></div><div class="goethe-answer-row"><div class="goethe-choices">${['A','B','C'].map((letter,choiceIndex)=>{const choice=choices[choiceIndex],imageUrl=typeof choice==='object'?choice.imageUrl:'',hasImage=Boolean(imageUrl);return `<label><input data-field="correct" type="radio" name="answer-${q.id}" value="${choiceIndex}" ${Number(q.correctAnswer)===choiceIndex?'checked':''} ${readOnly?'disabled':''}><b>${letter}</b><span class="choice-image-upload ${hasImage?'has-image':''}" title="${hasImage?'Bấm để thay hình ảnh đáp án':'Tải hình ảnh đáp án'}">${hasImage?`<img class="choice-uploaded-image" src="${esc(imageUrl)}" alt="Ảnh đáp án ${letter}">`:icons.imageUpload}${hasImage?`<span class="choice-image-tooltip"><img src="${esc(imageUrl)}" alt="Ảnh đáp án ${letter}"></span>`:''}<input type="file" data-choice-image="${choiceIndex}" accept="image/*" ${readOnly?'disabled':''}></span><input data-choice="${choiceIndex}" placeholder="Nhập đáp án" value="${esc(blank(typeof choice==='object'?choice.text:choice))}" ${readOnly?'disabled':''}></label>`;}).join('')}</div></div></article>`;
}

export function renderBuilder({data,exam,section,readOnly=false}={}){
  if(!section)return '<div class="rong">Chọn một phần để cấu hình.</div>';
  const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  return `<div class="part-editor" data-template-type="${esc(section.templateType||'GENERIC')}"><p class="phu-de">Tạo câu hỏi trực tiếp trong phần này.</p><div class="goethe-instruction"><textarea id="sectionInstruction" placeholder="Đề bài" ${readOnly?'disabled':''}>${esc(section.instruction||'')}</textarea></div><div class="goethe-questions">${questions.map((q,index)=>questionHtml(q,index,{defaultScore,readOnly})).join('')||'<div class="rong">Chưa có câu hỏi trong bài này.</div>'}</div></div>`;
}

export function bindBuilder({root=document,data,exam,section,pendingAudioUploads=new Map(),notify=()=>{}}={}){
  if(!section)return;
  const resetAudioPreview=button=>{
    button.innerHTML=icons.play;
    button.title='Nghe thử audio';
    button.setAttribute('aria-label','Nghe thử audio');
  };
  const bindInlineAudioPreview=button=>button.onclick=async()=>{
    const control=button.closest('.audio-upload'),audio=control?.querySelector('.inline-audio-preview');
    if(!audio)return;
    if(!audio.paused){audio.pause();audio.currentTime=0;resetAudioPreview(button);return;}
    root.querySelectorAll('.inline-audio-preview').forEach(item=>{
      if(item===audio)return;
      item.pause();item.currentTime=0;
      const other=item.closest('.audio-upload')?.querySelector('.audio-preview');if(other)resetAudioPreview(other);
    });
    try{
      if(audio.ended)audio.currentTime=0;
      await audio.play();
      button.innerHTML='<span class="audio-stop-icon" aria-hidden="true"></span>';
      button.title='Dừng audio';button.setAttribute('aria-label','Dừng audio');
      audio.onended=()=>resetAudioPreview(button);
      audio.onpause=()=>{if(!audio.ended)resetAudioPreview(button);};
    }catch{notify('Không thể phát audio này. Hãy thử chọn lại tệp.');}
  };
  const showUploadedAudio=(control,{url,name})=>{
    control.classList.add('has-audio');
    const label=control.querySelector('.audio-file-select span');if(label)label.textContent=name;
    control.querySelector(':scope > img')?.remove();
    let audio=control.querySelector('.inline-audio-preview');
    if(!audio){audio=document.createElement('audio');audio.className='inline-audio-preview';audio.preload='metadata';control.append(audio);}
    audio.src=url;
    let button=control.querySelector('.audio-preview');
    if(!button){button=document.createElement('button');button.type='button';button.className='audio-preview';control.insertBefore(button,audio);bindInlineAudioPreview(button);}
    resetAudioPreview(button);
  };
  root.querySelectorAll('.audio-upload input[data-field="audio"]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.audio-upload'),questionId=input.closest('.part-question')?.dataset.questionId,label=control?.querySelector('.audio-file-select span');
    if(!file||!control||!questionId||!label)return;
    input.disabled=true;label.textContent='Đang tải audio · 0%';
    const upload={name:file.name,promise:null};
    upload.promise=uploadQuestionAudio(file,{onProgress:percent=>{if(pendingAudioUploads.get(questionId)===upload)label.textContent=`Đang tải audio · ${percent}%`;}}).then(url=>{
      if(pendingAudioUploads.get(questionId)===upload)showUploadedAudio(control,{url,name:file.name});
      return {url,name:file.name};
    }).catch(error=>{
      if(pendingAudioUploads.get(questionId)===upload){pendingAudioUploads.delete(questionId);label.textContent='Tải audio thất bại';notify(error.message);}
      throw error;
    }).finally(()=>{if(pendingAudioUploads.get(questionId)===upload)input.disabled=false;});
    pendingAudioUploads.set(questionId,upload);upload.promise.catch(()=>{});
  });
  root.querySelectorAll('[data-choice-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.choice-image-upload');if(!file||!control)return;
    control.classList.add('has-image');control.title='Bấm để thay hình ảnh đáp án';
    const objectUrl=URL.createObjectURL(file),thumbnail=control.querySelector(':scope > img');
    if(thumbnail){thumbnail.src=objectUrl;thumbnail.className='choice-uploaded-image';thumbnail.alt='Ảnh đáp án đã chọn';}
    control.querySelector('.choice-image-tooltip')?.remove();
    const tooltip=document.createElement('span'),preview=new Image();tooltip.className='choice-image-tooltip';preview.alt='Ảnh đáp án đã chọn';preview.src=objectUrl;tooltip.append(preview);control.append(tooltip);
  });
  const updateSkillTotals=()=>{
    const draftScores=new Map([...root.querySelectorAll('.part-question[data-question-id]')].map(card=>[card.dataset.questionId,Math.max(0,Number(card.querySelector('[data-field="maxScore"]')?.value)||0)]));
    root.querySelectorAll('[data-skill-total]').forEach(total=>{
      const skill=total.dataset.skillTotal;
      const sum=(exam.sections||[]).filter(item=>item.skill===skill).reduce((skillScore,item)=>{
        const fallback=Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
        return skillScore+(item.questionIds||[]).reduce((partScore,id)=>partScore+(draftScores.has(id)?draftScores.get(id):getQuestionMaxScore(byId(data.questions,id),fallback)),0);
      },0);
      total.textContent=`${Number.isInteger(sum)?sum:Number(sum.toFixed(2))} điểm`;
    });
  };
  root.querySelectorAll('[data-field="maxScore"]').forEach(input=>input.oninput=updateSkillTotals);
  updateSkillTotals();
  root.querySelectorAll('[data-action="preview-inline-audio"]').forEach(bindInlineAudioPreview);
}
