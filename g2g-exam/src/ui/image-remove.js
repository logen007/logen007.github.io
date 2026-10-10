export const EDITOR_IMAGE_INPUTS='[data-section-image],[data-question-card-image],[data-question-instruction-image],[data-choice-image],[data-rubric-image]';

export function imageValue(input,uploaded,previous=''){
  return input?.dataset.imageRemoved==='true'?'':uploaded??previous??'';
}

export function bindImageRemoval(root,onRemove){
  root.querySelectorAll(EDITOR_IMAGE_INPUTS).forEach(input=>{
    if(input.disabled)return;
    const control=input.closest('.section-image-upload,.choice-image-upload,.rubric-image-upload,.writing-image-picker');
    if(!control||control.querySelector('[data-remove-editor-image]'))return;
    control.classList.add('image-remove-control');
    const button=document.createElement('button');
    button.type='button';button.className='image-remove-button';button.dataset.removeEditorImage='';
    button.setAttribute('aria-label','Gỡ hình ảnh');button.title='Gỡ hình ảnh';button.textContent='×';
    control.append(button);
    input.addEventListener('change',()=>{
      if(!input.files?.length)return;
      input.dataset.imageRemoved='false';
      control.querySelector('[data-image-empty]')?.remove();
    });
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      input.value='';input.dataset.imageRemoved='true';
      control.querySelectorAll('img,.choice-image-tooltip').forEach(image=>image.remove());
      control.classList.remove('has-image');
      const empty=document.createElement('span');empty.dataset.imageEmpty='';empty.textContent='Thêm hình ảnh';
      control.append(empty);
      const section=input.closest('[data-section-image-control]');
      if(input.matches('[data-section-image]')&&section){section.dataset.removeSectionImage='true';section.dataset.hasImage='false';}
      const instruction=input.closest('[data-question-image-control]');
      if(input.matches('[data-question-instruction-image]')&&instruction){instruction.dataset.removeQuestionImage='true';instruction.dataset.hasImage='false';}
      input.focus();onRemove();
    });
  });
}
