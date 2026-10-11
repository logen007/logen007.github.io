import {esc} from './format.js';
import {iconHtml} from './icons.js';
import {uploadQuestionImage} from '../media.js';

const letter=index=>String.fromCharCode(97+index);
const row=(block={},index=0,readOnly=false)=>`<article class="reading-block-editor" data-reading-block data-image-url="${esc(block.imageUrl||'')}">
  <label class="reading-block-image" title="Thêm / thay hình"><span>${block.imageUrl?`<img src="${esc(block.imageUrl)}" alt="">`:iconHtml('image')}</span><input type="file" accept="image/*" data-block-image aria-label="Hình ảnh" ${readOnly?'disabled':''}></label>
  <div class="reading-block-fields"><div class="reading-block-heading"><b data-block-letter>${letter(index)}</b><input class="truong" data-block-title placeholder="Tiêu đề" aria-label="Tiêu đề" value="${esc(block.title||'')}" ${readOnly?'disabled':''}><button type="button" class="icon-btn" data-block-remove aria-label="Xóa cụm" title="Xóa cụm" ${readOnly?'disabled':''}>${iconHtml('close')}</button><button type="button" class="icon-btn" data-block-add aria-label="Thêm cụm bên dưới" title="Thêm cụm bên dưới" ${readOnly?'disabled':''}>${iconHtml('plus')}</button></div><textarea class="truong" data-block-text placeholder="Nội dung" aria-label="Nội dung" ${readOnly?'disabled':''}>${esc(block.text||'')}</textarea></div>
</article>`;

export function readingBlocksEditor(section,readOnly=false){
  if(!section.questionProfile?.readingBlocks)return '';
  const blocks=section.readingBlocks||[];
  return `<div class="reading-blocks-editor" data-reading-blocks data-read-only="${readOnly}" data-limit="${section.questionProfile.choices.length}">${blocks.map((block,index)=>row(block,index,readOnly)).join('')}<button type="button" class="nut" data-block-append ${readOnly?'disabled':''}>+ Thêm cụm</button></div>`;
}

export function readingBlocksHtml(section){
  return (section.readingBlocks||[]).map((block,index)=>`<article class="reading-block">${block.imageUrl?`<img src="${esc(block.imageUrl)}" alt="">`:''}<div><h3><b>${letter(index)}</b> ${esc(block.title)}</h3><p>${esc(block.text)}</p></div></article>`).join('');
}

export async function collectReadingBlocks(root){
  if(!root.querySelector('[data-reading-blocks]'))return undefined;
  return Promise.all([...root.querySelectorAll('[data-reading-block]')].map(async card=>{
    const input=card.querySelector('[data-block-image]'),file=input.files?.[0];
    if(file){card.dataset.imageUrl=await uploadQuestionImage(file);input.value='';}
    return {imageUrl:card.dataset.imageUrl||'',title:card.querySelector('[data-block-title]').value,text:card.querySelector('[data-block-text]').value};
  }));
}

export function bindReadingBlocks(root,onChange){
  const container=root.querySelector('[data-reading-blocks]');if(!container||container.dataset.readOnly==='true')return;
  const refresh=()=>{
    const rows=[...container.querySelectorAll('[data-reading-block]')],full=rows.length>=Number(container.dataset.limit);
    rows.forEach((card,index)=>{card.querySelector('[data-block-letter]').textContent=letter(index);});
    container.querySelectorAll('[data-block-add],[data-block-append]').forEach(button=>{button.disabled=full;});
  };
  container.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    const card=button.closest('[data-reading-block]');
    if(button.hasAttribute('data-block-remove'))card.remove();
    else if(button.hasAttribute('data-block-add'))card.insertAdjacentHTML('afterend',row());
    else if(button.hasAttribute('data-block-append'))button.insertAdjacentHTML('beforebegin',row());
    else return;
    refresh();onChange();
  });
  container.addEventListener('input',onChange);
  container.addEventListener('change',event=>{
    const input=event.target;if(input.matches('[data-block-image]')&&input.files?.[0]){
      const preview=input.parentElement.querySelector('span'),reader=new FileReader();
      reader.onload=()=>{preview.innerHTML=`<img src="${esc(reader.result)}" alt="">`;};reader.readAsDataURL(input.files[0]);
    }
    onChange();
  });
  refresh();
}
