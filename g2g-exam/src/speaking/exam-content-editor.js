import {speakingPromptContent} from './exam-model.js';
import {uploadCourseImage} from '../media.js';

// Use the course editor directly, including image alignment, resize and history.
export function bindSpeakingContentEditors(root,{exam,onChange,onBusy,notify,bindEditor,uploadImage=uploadCourseImage}){
 let closed=false,pending=0;const bindings=[];
 const ready=bindEditor?Promise.resolve({bindKnowledgeVisualEditor:bindEditor}):import('../courses/knowledge-visual-editor.js');
 void ready.then(({bindKnowledgeVisualEditor})=>{
  if(closed)return;
  for(const holder of root.querySelectorAll('[data-sx-content]')){
   const stage=exam.speaking.stages[Number(holder.dataset.sxContent)],seat=holder.dataset.seat,node=holder.querySelector('[data-knowledge-editor]');if(!node)continue;
   let binding,pickerPoint=null;
   const upload=async(files,options={})=>{
    if(closed||pending)return;pending++;onBusy(true);
    const indicator=node.querySelector('[data-course-upload-status]');indicator.textContent='Đang tải ảnh…';
    try{
     const urls=[];for(const file of options.replaceId?Array.from(files).slice(0,1):Array.from(files)){if(closed)return;urls.push(await uploadImage(file));}
     if(!closed&&urls.length)binding.insertImages(urls,options);
     if(!closed)indicator.textContent='';
    }catch(error){if(!closed){indicator.textContent=error.message;notify(error.message);}}
    finally{binding.release(options.point);pending--;if(!closed)onBusy(false);}
   };
   binding=bindKnowledgeVisualEditor(node,{lesson:speakingPromptContent(stage,seat),label:'Đề thí sinh '+seat,notify,onChange:blocks=>{if(closed)return;stage['prompt'+seat+'Blocks']=blocks;stage['prompt'+seat]=blocks.filter(block=>block.type==='text').map(block=>block.text).join('\n\n');onChange();},onFiles:(files,options)=>void upload(files,options)});
   const click=event=>{const button=event.target.closest('[data-course-pick]');if(!button||button.disabled||pending)return;event.preventDefault();if(pickerPoint)binding.release(pickerPoint.point);pickerPoint={point:binding.capture(),...(button.hasAttribute('data-knowledge-replace')?{replaceId:binding.selectedImage()}:{})};node.querySelector('input[type=file]').click();};
   const change=event=>{if(event.target.type!=='file')return;const files=Array.from(event.target.files||[]),options=pickerPoint||{point:binding.capture()};pickerPoint=null;event.target.value='';if(files.length)void upload(files,options);else binding.release(options.point);};
   node.addEventListener('click',click);node.addEventListener('change',change);
   bindings.push(()=>{node.removeEventListener('click',click);node.removeEventListener('change',change);binding.destroy();});
  }
 }).catch(error=>{if(!closed){root.querySelectorAll('[data-knowledge-canvas]').forEach(node=>node.textContent='Không mở được trình soạn. Vui lòng tải lại trang.');notify(error.message);}});
 return {destroy(){closed=true;bindings.forEach(dispose=>dispose());}};
}
