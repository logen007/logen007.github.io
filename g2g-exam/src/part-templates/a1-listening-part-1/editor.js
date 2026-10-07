import {templateRequest,uploadTemplateMedia} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';
import {validateA1ListeningPart1} from './validator.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const normalizeChoice=(choice,key)=>choice&&typeof choice==='object'?{key,text:String(choice.text||''),imageUrl:String(choice.imageUrl||'')}:{key,text:String(choice||''),imageUrl:''};
const questionDraft=score=>({id:id('q'),prompt:'',audioUrl:'',choices:['A','B','C'].map(key=>({key,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,locked:false});

function injectStyles(){
  if(document.getElementById('a1ListeningPart1Styles'))return;
  const style=document.createElement('style');style.id='a1ListeningPart1Styles';style.textContent=`
    .tpl-a1-modal .noi-hop{width:min(1120px,100%)}.tpl-a1-grid{display:grid;grid-template-columns:1fr 180px;gap:12px}.tpl-a1-question{border:1px solid var(--vien);border-radius:var(--r);padding:14px;margin-top:12px;background:#fff}.tpl-a1-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tpl-a1-question-grid{display:grid;grid-template-columns:1fr 130px;gap:10px}.tpl-a1-choice{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;margin-top:8px}.tpl-a1-choice input{width:100%;height:38px;border:1px solid var(--vien);border-radius:5px;padding:0 9px}.tpl-a1-total{font-weight:800}@media(max-width:760px){.tpl-a1-grid,.tpl-a1-question-grid{grid-template-columns:1fr}.tpl-a1-choice{grid-template-columns:36px 1fr}.tpl-a1-choice input:nth-of-type(2){grid-column:2}}
  `;document.head.appendChild(style);
}

export async function openA1ListeningPart1Editor({exam=null,section=null,onSaved,state:initialState,user:initialUser,commit}={}){
  injectStyles();
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
  if((exam?.locked||originalQuestions.some(q=>q.locked))&&user.role!=='master')throw new Error('Phần này đã được dùng và đang khóa.');
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
    modal.innerHTML=`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">CẤU HÌNH PART</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="tplClose">×</button></div><div class="tpl-a1-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="tplInstruction" style="width:100%;min-height:90px">${esc(part.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định<input id="tplDefaultScore" type="number" min="0" step="0.25" value="${part.defaultScore}"><button class="nut nho" id="tplApplyScore" type="button" style="margin-top:8px">Áp dụng toàn bộ</button></label></div><div class="goi-y">Mỗi câu tương ứng một mảnh audio. Hệ thống phát mỗi mảnh ${policy.segmentRepeat} lần và không cho học viên pause hoặc nghe lại.</div><div id="tplQuestions">${questions.map(questionCard).join('')}</div><div class="chan-hop"><div><span class="phu-de">${questions.length}/${maxQuestions} câu · </span><span class="tpl-a1-total">Tổng điểm: <span id="tplTotal">${questions.reduce((n,q)=>n+Number(q.maxScore||0),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="tplAdd" ${questions.length>=maxQuestions?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="tplSave">Lưu</button></div></div></div>`;
    modal.querySelector('#tplClose').onclick=()=>modal.remove();
    modal.querySelector('#tplAdd').onclick=()=>{sync();if(questions.length<maxQuestions){questions.push(questionDraft(Number(modal.querySelector('#tplDefaultScore').value)||specDefaultScore));render();}};
    modal.querySelector('#tplApplyScore').onclick=()=>{const value=Math.max(0,Number(modal.querySelector('#tplDefaultScore').value)||0);modal.querySelectorAll('.tpl-score').forEach(input=>input.value=String(value));syncTotal();};
    modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sync();if(questions.length<=minQuestions)return;questions.splice(Number(button.dataset.remove),1);render();});
    modal.querySelectorAll('.tpl-score').forEach(input=>input.oninput=syncTotal);
    modal.querySelector('#tplSave').onclick=save;
  };

  function questionCard(q,index){
    return `<section class="tpl-a1-question"><div class="tpl-a1-head"><b>Câu ${index+1}</b><button class="nut nho nguy" data-remove="${index}" ${questions.length<=minQuestions?'disabled':''}>Xóa câu</button></div><div class="tpl-a1-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="tpl-prompt" data-i="${index}" style="width:100%;min-height:70px">${esc(q.prompt||'')}</textarea></label><label class="cai-dat">Điểm<input class="tpl-score" data-i="${index}" type="number" min="0" step="0.25" value="${Number(q.maxScore??specDefaultScore)}"><span class="phu-de">Đáp án đúng</span><select class="tpl-correct" data-i="${index}">${['A','B','C'].map((key,j)=>`<option value="${j}" ${Number(q.correctAnswer)===j?'selected':''}>${key}</option>`).join('')}</select></label></div><label class="cai-dat">Audio<input class="tpl-audio" data-i="${index}" type="file" accept="audio/*"></label><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh tùy chọn</div>${q.choices.map((choice,j)=>`<div class="tpl-a1-choice"><strong>${choice.key}</strong><input class="tpl-choice" data-i="${index}" data-j="${j}" value="${esc(choice.text)}" placeholder="Nội dung ${choice.key}"><input class="tpl-image" data-i="${index}" data-j="${j}" type="file" accept="image/*"></div>`).join('')}</section>`;
  }

  function sync(){
    part.instruction=modal.querySelector('#tplInstruction')?.value.trim()||'';
    part.defaultScore=Math.max(0,Number(modal.querySelector('#tplDefaultScore')?.value)||0);
    questions=questions.map((q,index)=>({...q,prompt:modal.querySelector(`.tpl-prompt[data-i="${index}"]`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(`.tpl-correct[data-i="${index}"]`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(`.tpl-score[data-i="${index}"]`)?.value)||0),choices:q.choices.map((choice,j)=>({...choice,text:modal.querySelector(`.tpl-choice[data-i="${index}"][data-j="${j}"]`)?.value.trim()||''}))}));
  }
  function syncTotal(){modal.querySelector('#tplTotal').textContent=[...modal.querySelectorAll('.tpl-score')].reduce((sum,input)=>sum+(Number(input.value)||0),0);}

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
      await commit({operations:ops,sectionPatch:{instruction:part.instruction,questionIds}});
      modal.remove();if(onSaved)await onSaved({sectionId:section.id,instruction:part.instruction,questionIds});
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Lưu';}}
  }
  render();
}
