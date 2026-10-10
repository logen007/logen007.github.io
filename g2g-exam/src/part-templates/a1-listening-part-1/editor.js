import {templateRequest,uploadTemplateMedia} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';
import {validateA1ListeningPart1} from './validator.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const normalizeChoice=(choice,key)=>choice&&typeof choice==='object'?{key,text:String(choice.text||''),imageUrl:String(choice.imageUrl||'')}:{key,text:String(choice||''),imageUrl:''};
const questionDraft=score=>({id:id('q'),prompt:'',audioUrl:'',choices:['A','B','C'].map(key=>({key,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,example:false,locked:false});


export async function openA1ListeningPart1Editor({exam=null,section=null,onSaved,state:initialState,user:initialUser,commit}={}){
  let state=initialState,user=initialUser;
  if(!state||!user){
    const me=await templateRequest('/auth/me');state=await templateRequest('/state');user=me.user;
  }
  if(!user||!['teacher','master'].includes(user.role))throw new Error('Chỉ giáo viên hoặc quản trị viên được sửa phần này.');
  if(!section?.id)throw new Error('Không tìm thấy Part cần cấu hình.');
  const spec=await getA1ListeningPart1Spec(),policy=audioPolicyFromSpec(spec);
  const minQuestions=Math.max(1,Number(spec.questions?.min||1)),maxQuestions=Math.max(minQuestions,Number(spec.questions?.max||minQuestions));
  const specDefaultScore=Math.max(0,Number(spec.scoring?.default??1));
  const originalQuestions=(section.questionIds||[]).map(questionId=>(state.questions||[]).find(q=>q.id===questionId)).filter(Boolean);
  if(exam?.ownerId!==user.id&&user.role!=='master')throw new Error('Bạn không có quyền sửa đề này.');
  const uniformScores=[...new Set(originalQuestions.map(q=>Number(q.maxScore)).filter(Number.isFinite))];
  const defaultScore=Math.max(0,Number(uniformScores.length===1?uniformScores[0]:specDefaultScore)||0);
  let questions=(originalQuestions.length?originalQuestions:Array.from({length:Math.min(3,maxQuestions)},()=>questionDraft(defaultScore))).map(q=>({...q,choices:['A','B','C'].map((key,j)=>normalizeChoice(q.choices?.[j],key)),maxScore:Number(q.maxScore??defaultScore)}));
  const part={
    id:section.id,
    instruction:section.instruction||'',
    defaultScore,
    templateType:section.templateType||spec.template,
  };
  const modal=document.createElement('div');modal.id='partTemplateModal';modal.className='hop-chon tpl-a1-modal';document.body.appendChild(modal);

  const render=()=>{
    const realCount=questions.filter(q=>!q.example).length;
    modal.innerHTML=`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">CẤU HÌNH PART</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="tplClose">×</button></div><div class="tpl-a1-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="tplInstruction" style="width:100%;min-height:90px">${esc(part.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định<input id="tplDefaultScore" type="number" min="0" step="0.25" value="${part.defaultScore}"><button class="nut nho" id="tplApplyScore" type="button" style="margin-top:8px">Áp dụng toàn bộ</button></label></div><div class="goi-y">Audio câu ví dụ phát một lần. Audio các câu còn lại phát ${policy.segmentRepeat} lần và học viên không thể pause hoặc nghe lại.</div><div id="tplQuestions">${questions.map(questionCard).join('')}</div><div class="chan-hop"><div><span class="phu-de">${realCount}/${maxQuestions} câu · </span><span class="tpl-a1-total">Tổng điểm: <span id="tplTotal">${questions.reduce((n,q)=>n+(q.example?0:Number(q.maxScore||0)),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="tplAdd" ${realCount>=maxQuestions?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="tplSave">Lưu</button></div></div></div>`;
    modal.querySelector('#tplClose').onclick=()=>modal.remove();
    modal.querySelector('#tplAdd').onclick=()=>{sync();if(questions.filter(q=>!q.example).length<maxQuestions){questions.push(questionDraft(Number(modal.querySelector('#tplDefaultScore').value)||specDefaultScore));render();}};
    modal.querySelector('#tplApplyScore').onclick=()=>{const value=Math.max(0,Number(modal.querySelector('#tplDefaultScore').value)||0);modal.querySelectorAll('.tpl-score:not(:disabled)').forEach(input=>input.value=String(value));syncTotal();};
    modal.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>{
      sync();const index=Number(button.dataset.example),question=questions[index],makeExample=!question.example;question.example=makeExample;
      if(!makeExample){render();return;}
      const cards=[...modal.querySelectorAll('.tpl-a1-question')],before=new Map(cards.map(card=>[card,card.getBoundingClientRect()])),card=cards[index];
      questions.splice(index,1);questions.unshift(question);card.parentElement.insertBefore(card,cards[0]);
      cards.forEach(item=>{const first=before.get(item),last=item.getBoundingClientRect(),dy=first.top-last.top;if(dy)item.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.22,.8,.25,1)'});});
      setTimeout(render,370);
    });
    modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sync();const index=Number(button.dataset.remove),selected=questions[index];if(!selected?.example&&questions.filter(q=>!q.example).length<=minQuestions)return;questions.splice(index,1);render();});
    modal.querySelectorAll('.tpl-score').forEach(input=>input.oninput=syncTotal);
    modal.querySelector('#tplSave').onclick=save;
  };

  function questionCard(q,index){
    const number=questions.slice(0,index+1).filter(item=>!item.example).length;
    const cannotRemove=!q.example&&questions.filter(item=>!item.example).length<=minQuestions;
    return `<section class="tpl-a1-question ${q.example?'is-example':''}"><div class="tpl-a1-head"><b>${q.example?'Beispiel':`Câu ${number}`}</b><div><button class="nut nho" data-example="${index}">${q.example?'Bỏ ví dụ':'Ví dụ'}</button><button class="nut nho nguy" data-remove="${index}" ${cannotRemove?'disabled':''}>Xóa câu</button></div></div><div class="tpl-a1-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="tpl-prompt" data-i="${index}" style="width:100%;min-height:70px">${esc(q.prompt||'')}</textarea></label><label class="cai-dat ${q.example?'is-disabled':''}">Điểm<input class="tpl-score" data-i="${index}" type="number" min="0" step="0.25" value="${Number(q.maxScore??specDefaultScore)}" ${q.example?'disabled':''}><span class="phu-de">Đáp án đúng</span><select class="tpl-correct" data-i="${index}">${['A','B','C'].map((key,j)=>`<option value="${j}" ${Number(q.correctAnswer)===j?'selected':''}>${key}</option>`).join('')}</select></label></div><label class="cai-dat">Audio<input class="tpl-audio" data-i="${index}" type="file" accept="audio/*"></label><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh tùy chọn</div>${q.choices.map((choice,j)=>`<div class="tpl-a1-choice"><strong>${choice.key}</strong><input class="tpl-choice" data-i="${index}" data-j="${j}" value="${esc(choice.text)}" placeholder="Nội dung ${choice.key}"><input class="tpl-image" data-i="${index}" data-j="${j}" type="file" accept="image/*"></div>`).join('')}</section>`;
  }

  function sync(){
    part.instruction=modal.querySelector('#tplInstruction')?.value.trim()||'';
    part.defaultScore=Math.max(0,Number(modal.querySelector('#tplDefaultScore')?.value)||0);
    questions=questions.map((q,index)=>({...q,prompt:modal.querySelector(`.tpl-prompt[data-i="${index}"]`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(`.tpl-correct[data-i="${index}"]`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(`.tpl-score[data-i="${index}"]`)?.value)||0),choices:q.choices.map((choice,j)=>({...choice,text:modal.querySelector(`.tpl-choice[data-i="${index}"][data-j="${j}"]`)?.value.trim()||''}))}));
  }
  function syncTotal(){modal.querySelector('#tplTotal').textContent=[...modal.querySelectorAll('.tpl-score:not(:disabled)')].reduce((sum,input)=>sum+(Number(input.value)||0),0);}

  async function save(){
    const button=modal.querySelector('#tplSave');button.disabled=true;button.textContent='Đang lưu...';
    try{
      sync();
      for(let index=0;index<questions.length;index++){
        const question=questions[index];
        const audioFile=modal.querySelector(`.tpl-audio[data-i="${index}"]`)?.files?.[0];
        if(audioFile)question.audioUrl=await uploadTemplateMedia('audio',audioFile);
        for(let j=0;j<question.choices.length;j++){
          const imageFile=modal.querySelector(`.tpl-image[data-i="${index}"][data-j="${j}"]`)?.files?.[0];
          if(imageFile)question.choices[j].imageUrl=await uploadTemplateMedia('image',imageFile);
        }
      }
      validateA1ListeningPart1({part,questions,spec});
      if(typeof commit!=='function')throw new Error('Thiếu ngữ cảnh lưu Part.');
      const now=new Date().toISOString(),questionIds=questions.map(q=>q.id),ops=[];
      questions.forEach((q,index)=>{
        const item={...q,code:`A1-LIS-01-${String(index+1).padStart(3,'0')}`,level:'A1',skill:'Nghe',part:section.name||'Phần 1',partOrder:Number(section.partOrder||1),type:'single',title:`A1 Nghe 1 · Câu ${index+1}`,instruction:'',autoGrade:Boolean(spec.scoring?.autoGrade??true),pairs:[],rubric:[],ownerId:q.ownerId||exam?.ownerId||user.id,ownerName:q.ownerName||exam?.ownerName||user.name||'',status:q.status==='trash'?'active':(q.status||'active'),locked:Boolean(q.locked),usedCount:Number(q.usedCount||0),correctRate:q.correctRate??null,createdAt:q.createdAt||now,updatedAt:now};
        ops.push({collection:'questions',id:q.id,kind:'upsert',item});
      });
      const kept=new Set(questionIds);for(const old of originalQuestions)if(!kept.has(old.id))ops.push({collection:'questions',id:old.id,kind:'upsert',item:{...old,status:'trash',deletedAt:now,updatedAt:now}});
      const sectionPatch={instruction:part.instruction,questionIds};
      await commit({operations:ops,sectionPatch});
      modal.remove();if(onSaved)await onSaved({sectionId:section.id,...sectionPatch});
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Lưu';}}
  }
  render();
}
