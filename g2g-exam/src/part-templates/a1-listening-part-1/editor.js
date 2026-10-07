import {templateRequest,uploadTemplateMedia} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';
import {validateA1ListeningPart1} from './validator.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const normalizeChoice=(choice,key)=>choice&&typeof choice==='object'?{key,text:String(choice.text||''),imageUrl:String(choice.imageUrl||'')}:{key,text:String(choice||''),imageUrl:''};
const questionDraft=(index,score=1)=>({id:id('q'),groupOrder:index+1,prompt:'',audioUrl:'',choices:['A','B','C'].map(key=>({key,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,locked:false});

function injectStyles(){
  if(document.getElementById('a1ListeningPart1Styles'))return;
  const style=document.createElement('style');style.id='a1ListeningPart1Styles';style.textContent=`
    .tpl-a1-modal .noi-hop{width:min(1120px,100%)}.tpl-a1-grid{display:grid;grid-template-columns:1fr 180px;gap:12px}.tpl-a1-question{border:1px solid var(--vien);border-radius:var(--r);padding:14px;margin-top:12px;background:#fff}.tpl-a1-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tpl-a1-question-grid{display:grid;grid-template-columns:1fr 130px;gap:10px}.tpl-a1-choice{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;margin-top:8px}.tpl-a1-choice input{width:100%;height:38px;border:1px solid var(--vien);border-radius:5px;padding:0 9px}.tpl-a1-total{font-weight:800}@media(max-width:760px){.tpl-a1-grid,.tpl-a1-question-grid{grid-template-columns:1fr}.tpl-a1-choice{grid-template-columns:36px 1fr}.tpl-a1-choice input:nth-of-type(2){grid-column:2}}
  `;document.head.appendChild(style);
}

export async function openA1ListeningPart1Editor({groupId=null,onSaved,state:initialState,user:initialUser,commit}={}){
  injectStyles();
  let state=initialState,user=initialUser;
  if(!state||!user){
    const me=await templateRequest('/auth/me');state=await templateRequest('/state');user=me.user;
  }
  if(!user||!['teacher','master'].includes(user.role))throw new Error('Chỉ giáo viên hoặc quản trị viên được sửa phần này.');
  const spec=await getA1ListeningPart1Spec(),policy=audioPolicyFromSpec(spec);
  const minQuestions=Math.max(1,Number(spec.questions?.min||1)),maxQuestions=Math.max(minQuestions,Number(spec.questions?.max||minQuestions));
  const defaultScore=Math.max(0,Number(spec.scoring?.default??1));
  const existing=groupId?(state.questionGroups||[]).find(group=>group.id===groupId):null;
  const originalQuestions=existing?(state.questions||[]).filter(q=>(existing.questionIds||[]).includes(q.id)).sort((a,b)=>(a.groupOrder||0)-(b.groupOrder||0)):[];
  if(existing&&(existing.locked||originalQuestions.some(q=>q.locked))&&user.role!=='master')throw new Error('Phần này đã được dùng và đang khóa.');
  let questions=(originalQuestions.length?originalQuestions:Array.from({length:Math.min(3,maxQuestions)},(_,index)=>questionDraft(index,defaultScore))).map((q,index)=>({...q,groupOrder:index+1,choices:['A','B','C'].map((key,j)=>normalizeChoice(q.choices?.[j],key)),maxScore:Number(q.maxScore??existing?.defaultScore??defaultScore)}));
  const group={
    id:existing?.id||id('qg'),level:'A1',skill:'Nghe',skillKey:'listening',part:'Phần 1',partOrder:1,
    title:existing?.title||'A1 · Nghe · Phần 1',instruction:existing?.instruction||'',structureType:spec.template,
    audioPolicy:{...policy},defaultScore:Number(existing?.defaultScore??defaultScore),ownerId:existing?.ownerId||user.id,ownerName:existing?.ownerName||user.name||'',status:existing?.status||'active',locked:Boolean(existing?.locked),version:Number(existing?.version||1),createdAt:existing?.createdAt||new Date().toISOString(),
  };
  const modal=document.createElement('div');modal.id='partTemplateModal';modal.className='hop-chon tpl-a1-modal';document.body.appendChild(modal);

  const render=()=>{
    modal.innerHTML=`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">CẤU HÌNH PART</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="tplClose">×</button></div><div class="tpl-a1-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="tplInstruction" style="width:100%;min-height:90px">${esc(group.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định<input id="tplDefaultScore" type="number" min="0" step="0.25" value="${group.defaultScore}"><button class="nut nho" id="tplApplyScore" type="button" style="margin-top:8px">Áp dụng toàn bộ</button></label></div><div class="goi-y">Mỗi câu tương ứng một mảnh audio. Hệ thống phát mỗi mảnh ${policy.segmentRepeat} lần và không cho học viên pause hoặc nghe lại.</div><div id="tplQuestions">${questions.map(questionCard).join('')}</div><div class="chan-hop"><div><span class="phu-de">${questions.length}/${maxQuestions} câu · </span><span class="tpl-a1-total">Tổng điểm: <span id="tplTotal">${questions.reduce((n,q)=>n+Number(q.maxScore||0),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="tplAdd" ${questions.length>=maxQuestions?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="tplSave">Lưu</button></div></div></div>`;
    modal.querySelector('#tplClose').onclick=()=>modal.remove();
    modal.querySelector('#tplAdd').onclick=()=>{sync();if(questions.length<maxQuestions){questions.push(questionDraft(questions.length,Number(modal.querySelector('#tplDefaultScore').value)||defaultScore));render();}};
    modal.querySelector('#tplApplyScore').onclick=()=>{const value=Math.max(0,Number(modal.querySelector('#tplDefaultScore').value)||0);modal.querySelectorAll('.tpl-score').forEach(input=>input.value=String(value));syncTotal();};
    modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sync();if(questions.length<=minQuestions)return;questions.splice(Number(button.dataset.remove),1);questions.forEach((q,index)=>q.groupOrder=index+1);render();});
    modal.querySelectorAll('.tpl-score').forEach(input=>input.oninput=syncTotal);
    modal.querySelector('#tplSave').onclick=save;
  };

  function questionCard(q,index){
    return `<section class="tpl-a1-question"><div class="tpl-a1-head"><b>Câu ${index+1}</b><button class="nut nho nguy" data-remove="${index}" ${questions.length<=minQuestions?'disabled':''}>Xóa câu</button></div><div class="tpl-a1-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="tpl-prompt" data-i="${index}" style="width:100%;min-height:70px">${esc(q.prompt||'')}</textarea></label><label class="cai-dat">Điểm<input class="tpl-score" data-i="${index}" type="number" min="0" step="0.25" value="${Number(q.maxScore??defaultScore)}"><span class="phu-de">Đáp án đúng</span><select class="tpl-correct" data-i="${index}">${['A','B','C'].map((key,j)=>`<option value="${j}" ${Number(q.correctAnswer)===j?'selected':''}>${key}</option>`).join('')}</select></label></div><label class="cai-dat">Audio<input class="tpl-audio" data-i="${index}" type="file" accept="audio/*"></label><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh tùy chọn</div>${q.choices.map((choice,j)=>`<div class="tpl-a1-choice"><strong>${choice.key}</strong><input class="tpl-choice" data-i="${index}" data-j="${j}" value="${esc(choice.text)}" placeholder="Nội dung ${choice.key}"><input class="tpl-image" data-i="${index}" data-j="${j}" type="file" accept="image/*"></div>`).join('')}</section>`;
  }

  function sync(){
    group.instruction=modal.querySelector('#tplInstruction')?.value.trim()||'';
    group.defaultScore=Math.max(0,Number(modal.querySelector('#tplDefaultScore')?.value)||0);
    questions=questions.map((q,index)=>({...q,groupOrder:index+1,prompt:modal.querySelector(`.tpl-prompt[data-i="${index}"]`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(`.tpl-correct[data-i="${index}"]`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(`.tpl-score[data-i="${index}"]`)?.value)||0),choices:q.choices.map((choice,j)=>({...choice,text:modal.querySelector(`.tpl-choice[data-i="${index}"][data-j="${j}"]`)?.value.trim()||''}))}));
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
      validateA1ListeningPart1({group,questions,spec});
      const now=new Date().toISOString(),questionIds=questions.map(q=>q.id),groupItem={...group,questionIds,updatedAt:now};
      const ops=[{collection:'questionGroups',id:group.id,kind:'upsert',item:groupItem}];
      questions.forEach((q,index)=>ops.push({collection:'questions',id:q.id,kind:'upsert',item:{...q,code:`A1-LIS-01-${String(index+1).padStart(3,'0')}`,level:'A1',skill:'Nghe',part:'Phần 1',partOrder:1,type:'single',title:`A1 Nghe 1 · Câu ${index+1}`,instruction:'',autoGrade:Boolean(spec.scoring?.autoGrade??true),pairs:[],rubric:[],groupId:group.id,groupType:spec.template,groupOrder:index+1,groupInstruction:group.instruction,groupAudioPolicy:{...policy},ownerId:q.ownerId||group.ownerId,ownerName:q.ownerName||group.ownerName,status:q.status==='trash'?'active':(q.status||'active'),locked:Boolean(q.locked),usedCount:Number(q.usedCount||0),correctRate:q.correctRate??null,createdAt:q.createdAt||now,updatedAt:now}}));
      const kept=new Set(questionIds);for(const old of originalQuestions)if(!kept.has(old.id))ops.push({collection:'questions',id:old.id,kind:'upsert',item:{...old,status:'trash',deletedAt:now,updatedAt:now}});
      if(commit)await commit(ops);else await templateRequest('/commit',{method:'POST',body:{operations:ops}});
      modal.remove();if(onSaved)await onSaved(groupItem);
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Lưu';}}
  }
  render();
}
