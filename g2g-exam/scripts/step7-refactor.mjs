import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('g2g-exam');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,content)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);};
const remove=rel=>{const file=path.join(root,rel);if(fs.existsSync(file))fs.rmSync(file,{force:true});};
const replaceOnce=(rel,from,to)=>{const source=read(rel);if(!source.includes(from))throw new Error(`Không tìm thấy đoạn cần thay trong ${rel}: ${from.slice(0,80)}`);write(rel,source.replace(from,to));};
const replaceRegexOnce=(rel,re,to)=>{const source=read(rel);if(!re.test(source))throw new Error(`Không tìm thấy pattern cần thay trong ${rel}: ${re}`);write(rel,source.replace(re,to));};

// 1) Migrate the already-implemented A1 Listening Part 1 behaviour into the approved Part spec.
{
  const rel='specs/goethe/a1/listening/part-01.json';
  const spec=JSON.parse(read(rel));
  spec.questions={min:1,max:10};
  spec.answers={type:'single',keys:['A','B','C'],imageOptional:true};
  spec.audio={mode:'per_question_segment',maxSessions:1,segmentRepeat:2,controls:false,pauseAllowed:false,replayAllowed:false};
  spec.scoring={default:1,perQuestionEditable:true,autoGrade:true};
  write(rel,JSON.stringify(spec,null,2)+'\n');
}

// 2) Generic approved Part loader: one source for browser modules and tests.
{
  const rel='src/exam-specs/spec-loader.js';
  let source=read(rel);
  if(!source.includes('export async function loadApprovedPartSpec')){
    source += `\nexport async function loadApprovedPartSpec(relativePath){\n  const url=new URL(relativePath,import.meta.url);\n  return requireApproved(await readJson(url),\`Part spec \${url.pathname}\`);\n}\n`;
    write(rel,source);
  }
}

write('src/part-templates/shared/api.js',`const API=String(globalThis.G2G_API_BASE||'/api').replace(/\\/$/,'');

export async function templateRequest(path,{method='GET',body,form}={}){
  const options={method,credentials:'include',headers:{}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  if(form)options.body=form;
  const response=await fetch(\`\${API}\${path}\`,options);
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data?.error||\`Máy chủ trả về lỗi \${response.status}.\`);
  return data;
}

export async function uploadTemplateMedia(kind,file){
  if(!file)return '';
  const form=new FormData();form.append('file',file,file.name||kind);
  const data=await templateRequest(\`/media/\${kind}\`,{method:'POST',form});
  return data.url||'';
}
`);

write('src/part-templates/a1-listening-part-1/spec.js',`import {loadApprovedPartSpec} from '../../exam-specs/spec-loader.js';

let cached=null;
export async function getA1ListeningPart1Spec(){
  cached ||= loadApprovedPartSpec('../../../specs/goethe/a1/listening/part-01.json');
  return cached;
}

export function audioPolicyFromSpec(spec){
  const audio=spec?.audio||{};
  return Object.freeze({
    maxSessions:Number(audio.maxSessions||1),
    segmentRepeat:Number(audio.segmentRepeat||1),
    controls:Boolean(audio.controls),
    pauseAllowed:Boolean(audio.pauseAllowed),
    replayAllowed:Boolean(audio.replayAllowed),
  });
}
`);

write('src/part-templates/a1-listening-part-1/validator.js',`export function validateA1ListeningPart1({group,questions,spec}){
  const min=Math.max(1,Number(spec?.questions?.min||1));
  const max=Math.max(min,Number(spec?.questions?.max||min));
  const keys=Array.isArray(spec?.answers?.keys)?spec.answers.keys:['A','B','C'];
  if(!String(group?.instruction||'').trim())throw new Error('Cần nhập đề bài chung.');
  if(!Array.isArray(questions)||questions.length<min||questions.length>max)throw new Error(\`Phần này phải có từ \${min} đến \${max} câu.\`);
  for(let index=0;index<questions.length;index++){
    const question=questions[index];
    if(!String(question?.prompt||'').trim())throw new Error(\`Câu \${index+1} chưa có nội dung câu hỏi.\`);
    if(!String(question?.audioUrl||'').trim())throw new Error(\`Câu \${index+1} chưa có mảnh audio.\`);
    if(!Array.isArray(question?.choices)||question.choices.length!==keys.length)throw new Error(\`Câu \${index+1} phải có đủ đáp án \${keys.join('/')} .\`);
    if(question.choices.some(choice=>!String(choice?.text??choice??'').trim()))throw new Error(\`Câu \${index+1} cần đủ nội dung \${keys.join(', ')}.\`);
    const correct=Number(question.correctAnswer);
    if(!Number.isInteger(correct)||correct<0||correct>=keys.length)throw new Error(\`Câu \${index+1} chưa có đáp án đúng hợp lệ.\`);
    const score=Number(question.maxScore);
    if(!Number.isFinite(score)||score<0)throw new Error(\`Điểm câu \${index+1} không hợp lệ.\`);
  }
  return true;
}
`);

write('src/part-templates/a1-listening-part-1/editor.js',`import {templateRequest,uploadTemplateMedia} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';
import {validateA1ListeningPart1} from './validator.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const id=prefix=>\`\${prefix}-\${crypto.randomUUID()}\`;
const normalizeChoice=(choice,key)=>choice&&typeof choice==='object'?{key,text:String(choice.text||''),imageUrl:String(choice.imageUrl||'')}:{key,text:String(choice||''),imageUrl:''};
const questionDraft=(index,score=1)=>({id:id('q'),groupOrder:index+1,prompt:'',audioUrl:'',choices:['A','B','C'].map(key=>({key,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,locked:false});

function injectStyles(){
  if(document.getElementById('a1ListeningPart1Styles'))return;
  const style=document.createElement('style');style.id='a1ListeningPart1Styles';style.textContent=\`
    .tpl-a1-modal .noi-hop{width:min(1120px,100%)}.tpl-a1-grid{display:grid;grid-template-columns:1fr 180px;gap:12px}.tpl-a1-question{border:1px solid var(--vien);border-radius:var(--r);padding:14px;margin-top:12px;background:#fff}.tpl-a1-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tpl-a1-question-grid{display:grid;grid-template-columns:1fr 130px;gap:10px}.tpl-a1-choice{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;margin-top:8px}.tpl-a1-choice input{width:100%;height:38px;border:1px solid var(--vien);border-radius:5px;padding:0 9px}.tpl-a1-total{font-weight:800}@media(max-width:760px){.tpl-a1-grid,.tpl-a1-question-grid{grid-template-columns:1fr}.tpl-a1-choice{grid-template-columns:36px 1fr}.tpl-a1-choice input:nth-of-type(2){grid-column:2}}
  \`;document.head.appendChild(style);
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
    modal.innerHTML=\`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">CẤU HÌNH PART</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="tplClose">×</button></div><div class="tpl-a1-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="tplInstruction" style="width:100%;min-height:90px">\${esc(group.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định<input id="tplDefaultScore" type="number" min="0" step="0.25" value="\${group.defaultScore}"><button class="nut nho" id="tplApplyScore" type="button" style="margin-top:8px">Áp dụng toàn bộ</button></label></div><div class="goi-y">Mỗi câu tương ứng một mảnh audio. Hệ thống phát mỗi mảnh \${policy.segmentRepeat} lần và không cho học viên pause hoặc nghe lại.</div><div id="tplQuestions">\${questions.map(questionCard).join('')}</div><div class="chan-hop"><div><span class="phu-de">\${questions.length}/\${maxQuestions} câu · </span><span class="tpl-a1-total">Tổng điểm: <span id="tplTotal">\${questions.reduce((n,q)=>n+Number(q.maxScore||0),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="tplAdd" \${questions.length>=maxQuestions?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="tplSave">Lưu</button></div></div></div>\`;
    modal.querySelector('#tplClose').onclick=()=>modal.remove();
    modal.querySelector('#tplAdd').onclick=()=>{sync();if(questions.length<maxQuestions){questions.push(questionDraft(questions.length,Number(modal.querySelector('#tplDefaultScore').value)||defaultScore));render();}};
    modal.querySelector('#tplApplyScore').onclick=()=>{const value=Math.max(0,Number(modal.querySelector('#tplDefaultScore').value)||0);modal.querySelectorAll('.tpl-score').forEach(input=>input.value=String(value));syncTotal();};
    modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sync();if(questions.length<=minQuestions)return;questions.splice(Number(button.dataset.remove),1);questions.forEach((q,index)=>q.groupOrder=index+1);render();});
    modal.querySelectorAll('.tpl-score').forEach(input=>input.oninput=syncTotal);
    modal.querySelector('#tplSave').onclick=save;
  };

  function questionCard(q,index){
    return \`<section class="tpl-a1-question"><div class="tpl-a1-head"><b>Câu \${index+1}</b><button class="nut nho nguy" data-remove="\${index}" \${questions.length<=minQuestions?'disabled':''}>Xóa câu</button></div><div class="tpl-a1-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="tpl-prompt" data-i="\${index}" style="width:100%;min-height:70px">\${esc(q.prompt||'')}</textarea></label><label class="cai-dat">Điểm<input class="tpl-score" data-i="\${index}" type="number" min="0" step="0.25" value="\${Number(q.maxScore??defaultScore)}"><span class="phu-de">Đáp án đúng</span><select class="tpl-correct" data-i="\${index}">\${['A','B','C'].map((key,j)=>\`<option value="\${j}" \${Number(q.correctAnswer)===j?'selected':''}>\${key}</option>\`).join('')}</select></label></div><label class="cai-dat">Audio<input class="tpl-audio" data-i="\${index}" type="file" accept="audio/*"></label><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh tùy chọn</div>\${q.choices.map((choice,j)=>\`<div class="tpl-a1-choice"><strong>\${choice.key}</strong><input class="tpl-choice" data-i="\${index}" data-j="\${j}" value="\${esc(choice.text)}" placeholder="Nội dung \${choice.key}"><input class="tpl-image" data-i="\${index}" data-j="\${j}" type="file" accept="image/*"></div>\`).join('')}</section>\`;
  }

  function sync(){
    group.instruction=modal.querySelector('#tplInstruction')?.value.trim()||'';
    group.defaultScore=Math.max(0,Number(modal.querySelector('#tplDefaultScore')?.value)||0);
    questions=questions.map((q,index)=>({...q,groupOrder:index+1,prompt:modal.querySelector(\`.tpl-prompt[data-i="\${index}"]\`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(\`.tpl-correct[data-i="\${index}"]\`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(\`.tpl-score[data-i="\${index}"]\`)?.value)||0),choices:q.choices.map((choice,j)=>({...choice,text:modal.querySelector(\`.tpl-choice[data-i="\${index}"][data-j="\${j}"]\`)?.value.trim()||''}))}));
  }
  function syncTotal(){modal.querySelector('#tplTotal').textContent=[...modal.querySelectorAll('.tpl-score')].reduce((sum,input)=>sum+(Number(input.value)||0),0);}

  async function save(){
    const button=modal.querySelector('#tplSave');button.disabled=true;button.textContent='Đang lưu...';
    try{
      sync();
      for(let index=0;index<questions.length;index++){
        const question=questions[index];
        const audioFile=modal.querySelector(\`.tpl-audio[data-i="\${index}"]\`)?.files?.[0];
        if(audioFile)question.audioUrl=await uploadTemplateMedia('audio',audioFile);
        for(let j=0;j<question.choices.length;j++){
          const imageFile=modal.querySelector(\`.tpl-image[data-i="\${index}"][data-j="\${j}"]\`)?.files?.[0];
          if(imageFile)question.choices[j].imageUrl=await uploadTemplateMedia('image',imageFile);
        }
      }
      validateA1ListeningPart1({group,questions,spec});
      const now=new Date().toISOString(),questionIds=questions.map(q=>q.id),groupItem={...group,questionIds,updatedAt:now};
      const ops=[{collection:'questionGroups',id:group.id,kind:'upsert',item:groupItem}];
      questions.forEach((q,index)=>ops.push({collection:'questions',id:q.id,kind:'upsert',item:{...q,code:\`A1-LIS-01-\${String(index+1).padStart(3,'0')}\`,level:'A1',skill:'Nghe',part:'Phần 1',partOrder:1,type:'single',title:\`A1 Nghe 1 · Câu \${index+1}\`,instruction:'',autoGrade:Boolean(spec.scoring?.autoGrade??true),pairs:[],rubric:[],groupId:group.id,groupType:spec.template,groupOrder:index+1,groupInstruction:group.instruction,groupAudioPolicy:{...policy},ownerId:q.ownerId||group.ownerId,ownerName:q.ownerName||group.ownerName,status:q.status==='trash'?'active':(q.status||'active'),locked:Boolean(q.locked),usedCount:Number(q.usedCount||0),correctRate:q.correctRate??null,createdAt:q.createdAt||now,updatedAt:now}}));
      const kept=new Set(questionIds);for(const old of originalQuestions)if(!kept.has(old.id))ops.push({collection:'questions',id:old.id,kind:'upsert',item:{...old,status:'trash',deletedAt:now,updatedAt:now}});
      if(commit)await commit(ops);else await templateRequest('/commit',{method:'POST',body:{operations:ops}});
      modal.remove();if(onSaved)await onSaved(groupItem);
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Lưu';}}
  }
  render();
}
`);

write('src/part-templates/a1-listening-part-1/student.js',`import {templateRequest} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const choiceText=choice=>choice&&typeof choice==='object'?String(choice.text||''):String(choice||'');
const choiceImage=choice=>choice&&typeof choice==='object'?String(choice.imageUrl||''):'';

export async function mountStudentRuntime({state:initialState=null,examRoot:initialRoot=null}={}){
  const examRoot=initialRoot||document.querySelector('.thi');
  if(!examRoot||examRoot.dataset.a1ListeningPart1Enhanced==='1')return;
  let state=initialState;if(!state){try{state=await templateRequest('/state');}catch{return;}}
  const spec=await getA1ListeningPart1Spec(),policy=audioPolicyFromSpec(spec);
  const visibleIds=[...examRoot.querySelectorAll('.cau-thi[data-q]')].map(node=>node.dataset.q);
  const questions=(state.questions||[]).filter(q=>visibleIds.includes(q.id)&&q.groupType===spec.template&&q.groupId);
  if(!questions.length)return;
  examRoot.dataset.a1ListeningPart1Enhanced='1';
  const groupIds=[...new Set(questions.map(q=>q.groupId))];
  for(const groupId of groupIds){
    const groupQuestions=questions.filter(q=>q.groupId===groupId).sort((a,b)=>(a.groupOrder||0)-(b.groupOrder||0));
    if(!groupQuestions.length)continue;
    const group=(state.questionGroups||[]).find(item=>item.id===groupId)||{instruction:groupQuestions[0].groupInstruction};
    const firstNode=examRoot.querySelector(\`.cau-thi[data-q="\${CSS.escape(groupQuestions[0].id)}"]\`);if(!firstNode)continue;
    const attempt=(state.attempts||[]).find(item=>item.status==='in_progress'&&(item.currentQuestionIds||[]).includes(groupQuestions[0].id));if(!attempt)continue;
    const intro=document.createElement('div');intro.className='qg-listen-intro';
    const started=attempt.audioSessions?.[groupId]?.startedAt;
    intro.innerHTML=\`<h3>Đề bài</h3><div>\${esc(group.instruction||groupQuestions[0].groupInstruction||'')}</div><div style="margin-top:12px"><button class="nut chinh tpl-start-listen" \${started?'disabled':''}>\${started?'Audio đã được sử dụng':'Bắt đầu nghe'}</button><div class="qg-listen-status">\${started?'Phiên nghe đã bắt đầu trước đó và không thể phát lại.':\`Khi bắt đầu, audio chạy liên tục. Mỗi mảnh phát \${policy.segmentRepeat} lần.\`}</div></div>\`;
    firstNode.insertAdjacentElement('beforebegin',intro);
    const audioElements=[];
    for(const question of groupQuestions){
      const node=examRoot.querySelector(\`.cau-thi[data-q="\${CSS.escape(question.id)}"]\`);if(!node)continue;
      const wrap=node.querySelector('.audio-thi');if(wrap){wrap.style.display='none';const audio=wrap.querySelector('audio');if(audio){audio.controls=Boolean(policy.controls);audioElements.push({question,audio});}}
      const select=node.querySelector('.answer-one');
      if(select&&Array.isArray(question.choices)&&question.choices.some(choice=>typeof choice==='object')){
        const list=document.createElement('div');list.className='qg-choice-list';
        question.choices.slice(0,3).forEach((choice,index)=>{const label=document.createElement('label');label.className='qg-answer';const image=choiceImage(choice);label.innerHTML=\`<div><input type="radio" name="tpl-\${esc(question.id)}" value="\${index}" \${String(attempt.answers?.[question.id])===String(index)?'checked':''}><b>\${String.fromCharCode(65+index)}.</b> \${esc(choiceText(choice))}</div>\${image?\`<img src="\${esc(image)}" alt="Đáp án \${String.fromCharCode(65+index)}">\`:''}\`;label.querySelector('input').onchange=async()=>{await templateRequest('/actions/saveAnswers',{method:'POST',body:{attemptId:attempt.id,answers:{[question.id]:index}}});const save=document.getElementById('saveState');if(save)save.textContent='Đã lưu';};list.appendChild(label);});
        select.replaceWith(list);
      }
    }
    const button=intro.querySelector('.tpl-start-listen'),status=intro.querySelector('.qg-listen-status');
    if(button&&!started)button.onclick=async()=>{
      button.disabled=true;
      try{
        await templateRequest('/actions/startAudioGroup',{method:'POST',body:{attemptId:attempt.id,groupId}});
        for(let index=0;index<audioElements.length;index++)for(let repeat=0;repeat<Math.max(1,policy.segmentRepeat);repeat++){
          status.textContent=\`Đang nghe mảnh \${index+1}/\${audioElements.length} · lượt \${repeat+1}/\${policy.segmentRepeat}\`;
          await playLocked(audioElements[index].audio,policy);
        }
        await templateRequest('/actions/completeAudioGroup',{method:'POST',body:{attemptId:attempt.id,groupId}});
        status.textContent='Đã nghe hết audio. Phiên nghe đã khóa.';button.textContent='Đã hoàn thành audio';
      }catch(error){status.textContent=\`Audio đã khóa. \${error.message}\`;button.textContent='Không thể phát lại';}
    };
  }
}

function playLocked(audio,policy){
  return new Promise((resolve,reject)=>{
    let active=true;const cleanup=()=>{active=false;audio.onended=null;audio.onerror=null;audio.onpause=null;audio.onseeking=null;};
    audio.controls=Boolean(policy.controls);audio.currentTime=0;
    audio.onseeking=()=>{if(active&&!policy.replayAllowed&&audio.currentTime<0)audio.currentTime=0;};
    audio.onpause=()=>{if(active&&!policy.pauseAllowed&&!audio.ended)setTimeout(()=>audio.play().catch(()=>{}),0);};
    audio.onended=()=>{cleanup();resolve();};audio.onerror=()=>{cleanup();reject(new Error('Không phát được một mảnh audio.'));};
    audio.play().catch(error=>{cleanup();reject(error);});
  });
}
`);

write('src/part-templates/a1-listening-part-1/index.js',`export {openA1ListeningPart1Editor as openEditor} from './editor.js';
export {mountStudentRuntime} from './student.js';
export {validateA1ListeningPart1} from './validator.js';
`);

write('src/part-templates/index.js',`const loaders={
  A1_LISTENING_PART_1:()=>import('./a1-listening-part-1/index.js'),
};

export function hasPartTemplate(type){return Boolean(loaders[type]);}

async function loadPartTemplate(type){
  const load=loaders[type];
  if(!load)throw new Error(\`Chưa có module cho template \${type||'không xác định'}.\`);
  return load();
}

export async function openPartTemplate(type,options={}){
  const module=await loadPartTemplate(type);
  if(typeof module.openEditor!=='function')throw new Error(\`Template \${type} chưa có editor.\`);
  return module.openEditor(options);
}

export async function mountPartTemplateStudent(type,options={}){
  const module=await loadPartTemplate(type);
  if(typeof module.mountStudentRuntime!=='function')return;
  return module.mountStudentRuntime(options);
}
`);

write('src/part-templates/runtime.js',`import {templateRequest} from './shared/api.js';
import {hasPartTemplate,mountPartTemplateStudent} from './index.js';

let busy=false;
async function mount(){
  if(busy)return;
  const examRoot=document.querySelector('.thi');if(!examRoot)return;
  busy=true;
  try{
    const state=await templateRequest('/state');
    const visibleIds=new Set([...examRoot.querySelectorAll('.cau-thi[data-q]')].map(node=>node.dataset.q));
    const types=[...new Set((state.questions||[]).filter(q=>visibleIds.has(q.id)&&q.groupType).map(q=>q.groupType))].filter(hasPartTemplate);
    for(const type of types)await mountPartTemplateStudent(type,{state,examRoot});
  }catch(error){console.error('Không nạp được Part runtime',error);}finally{busy=false;}
}
let frame=0;const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;mount();});};
new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
schedule();
`);

// 3) The domain owns generic group lifecycle only; template-specific rules live in the Part module/spec.
write('src/domain/question-groups.js',`import {clone,uid,nowIso,isTeacher,isMaster,audit} from './base.js';

function numberInRange(value,min,max,label){
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(\`\${label} phải nằm trong khoảng \${min}–\${max}.\`);return n;
}

export function validateQuestionGroup(group,state=null){
  if(!group)throw new Error('Thiếu dữ liệu cụm câu hỏi.');
  if(!String(group.level||'').trim())throw new Error('Cụm câu hỏi chưa có trình độ.');
  if(!String(group.skill||'').trim())throw new Error('Cụm câu hỏi chưa có kỹ năng.');
  numberInRange(group.partOrder,1,99,'Thứ tự phần');
  const ids=[...new Set(group.questionIds||[])];if(ids.length<1)throw new Error('Cụm phải có ít nhất 1 câu.');
  numberInRange(group.defaultScore??1,0,1000,'Điểm mặc định');
  if(state){const byId=new Map((state.questions||[]).map(q=>[q.id,q]));for(const id of ids)if(!byId.has(id))throw new Error(\`Không tìm thấy câu \${id} của cụm.\`);}
  return true;
}

export function createQuestionGroup(state,user,input={}){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo cụm câu hỏi.');
  const group={id:input.id||uid('qg'),level:input.level||'',skill:input.skill||'',skillKey:input.skillKey||'',part:input.part||'',partOrder:Number(input.partOrder||1),title:String(input.title||'').trim(),instruction:String(input.instruction||'').trim(),structureType:input.structureType||'GENERIC',audioPolicy:clone(input.audioPolicy||{}),defaultScore:Number(input.defaultScore??1),questionIds:[...new Set(input.questionIds||[])],ownerId:user.id,ownerName:user.name||'',status:input.status||'active',version:Number(input.version||1),createdAt:nowIso(),updatedAt:nowIso()};
  validateQuestionGroup(group,state);state.questionGroups||=[];state.questionGroups.push(group);audit(state,user,'create','question_group',group.id,{title:group.title});return group;
}

export function updateQuestionGroup(state,user,id,patch={}){
  const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  if(!(isMaster(user)||group.ownerId===user.id))throw new Error('Bạn không có quyền sửa cụm câu hỏi này.');
  if(group.locked&&!isMaster(user))throw new Error('Cụm câu hỏi đã được khóa vì đang dùng trong đề.');
  const allowed=['level','skill','skillKey','part','partOrder','title','instruction','structureType','audioPolicy','defaultScore','questionIds','status','version'];for(const key of allowed)if(key in patch)group[key]=clone(patch[key]);
  group.updatedAt=nowIso();validateQuestionGroup(group,state);audit(state,user,'update','question_group',id);return group;
}

export function softDeleteQuestionGroup(state,user,id){
  const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  if(!(isMaster(user)||group.ownerId===user.id))throw new Error('Bạn không có quyền xóa cụm câu hỏi này.');if(group.locked&&!isMaster(user))throw new Error('Cụm câu hỏi đã khóa nên không thể xóa.');
  group.status='trash';group.deletedAt=nowIso();group.updatedAt=nowIso();for(const q of state.questions||[])if(group.questionIds.includes(q.id)&&q.status!=='trash'){q.status='trash';q.deletedAt=nowIso();q.deletedByGroupId=id;q.updatedAt=nowIso();}audit(state,user,'trash','question_group',id);return group;
}

export function restoreQuestionGroup(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ Quản trị cấp cao được khôi phục cụm câu hỏi.');const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  group.status='active';delete group.deletedAt;group.updatedAt=nowIso();for(const q of state.questions||[])if(q.deletedByGroupId===id){q.status='active';delete q.deletedAt;delete q.deletedByGroupId;q.updatedAt=nowIso();}audit(state,user,'restore','question_group',id);return group;
}

export function permanentlyDeleteQuestionGroup(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ Quản trị cấp cao được xóa vĩnh viễn cụm câu hỏi.');const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');if(group.status!=='trash')throw new Error('Hãy đưa cụm câu hỏi vào Thùng rác trước khi xóa vĩnh viễn.');
  const ids=new Set(group.questionIds||[]);const refs=(state.exams||[]).filter(exam=>(exam.sections||[]).some(section=>(section.questionIds||[]).some(questionId=>ids.has(questionId))));if(refs.length)throw new Error('Cụm vẫn có câu hỏi đang được dùng trong bài thi. Hãy gỡ khỏi bài thi trước khi xóa vĩnh viễn.');
  state.questionGroups=(state.questionGroups||[]).filter(x=>x.id!==id);state.questions=(state.questions||[]).filter(q=>!ids.has(q.id));audit(state,user,'delete_forever','question_group',id,{questionCount:ids.size});
}

export function groupTotalScore(group,state){const ids=new Set(group?.questionIds||[]);return (state?.questions||[]).filter(q=>ids.has(q.id)&&q.status!=='trash').reduce((sum,q)=>sum+Number(q.maxScore||0),0);}
`);

// 4) Server reads the same Part spec for audio-session enforcement.
write('server/src/specs.js',`import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../specs');
const cache=new Map();
export async function loadApprovedServerPartSpec(relativePath){
  if(cache.has(relativePath))return cache.get(relativePath);
  const data=JSON.parse(await fs.readFile(path.join(root,relativePath),'utf8'));
  if(data?.status!=='APPROVED')throw new Error(\`Part spec \${relativePath} chưa được APPROVED.\`);
  cache.set(relativePath,data);return data;
}
export const getA1ListeningPart1Spec=()=>loadApprovedServerPartSpec('goethe/a1/listening/part-01.json');
`);
replaceOnce('server/Dockerfile','COPY specs /app/public/specs\n','COPY specs /app/public/specs\nCOPY specs /app/specs\n');
replaceOnce('server/src/actions/attempts.js',"import {examById,questionMap,scoreQuestion,resultFor,sectionMeta} from './shared.js';\n","import {examById,questionMap,scoreQuestion,resultFor,sectionMeta} from './shared.js';\nimport {getA1ListeningPart1Spec} from '../specs.js';\n");
replaceRegexOnce('server/src/actions/attempts.js',/  if\(group\.structureType!=='A1_LISTENING_PART_1'\)throw appError\(409,'Cụm này không dùng chế độ audio một lần\.'\);\n  const policy=group\.audioPolicy\|\|\{};\n  if\(Number\(policy\.maxSessions\)!==1\|\|Number\(policy\.segmentRepeat\)!==2\|\|policy\.replayAllowed!==false\|\|policy\.pauseAllowed!==false\)throw appError\(409,'Chính sách audio của cụm không hợp lệ\.'\);/,`  const spec=await getA1ListeningPart1Spec();\n  if(group.structureType!==spec.template)throw appError(409,'Cụm này không dùng template audio hiện tại.');\n  const policy=spec.audio||{};\n  if(Number(policy.maxSessions)<1||Number(policy.segmentRepeat)<1)throw appError(500,'Specification audio không hợp lệ.');`);

// 5) Remove the standalone question-bank UI and picker, while keeping internal group lifecycle/trash for now.
replaceOnce('src/views/admin.js',"  ATTEMPT_STATUS,byId,isMaster,isTeacher,canEditQuestion,canEditExam,getVisibleQuestions,\n  pendingGradingAttempts,gradebookRows,summarizeExam\n","  ATTEMPT_STATUS,byId,isMaster,isTeacher,canEditExam,\n  pendingGradingAttempts,gradebookRows,summarizeExam\n");
replaceOnce('src/views/admin.js',"import {esc,fmtDate,statusClass,statusText,typeLabel} from '../ui/format.js';","import {esc,fmtDate,statusClass,statusText} from '../ui/format.js';");
replaceRegexOnce('src/views/admin.js',/\nexport function bankAdminHtml\([\s\S]*?\nexport function gradingAdminHtml/,"\nexport function gradingAdminHtml");
replaceOnce('src/views/modals.js',"import {ATTEMPT_STATUS,byId,getVisibleQuestions} from '../core.js';","import {ATTEMPT_STATUS,byId} from '../core.js';");
replaceRegexOnce('src/views/modals.js',/\nexport function bankPickerHtml\([\s\S]*?\nexport function previewExamModalHtml/,"\nexport function previewExamModalHtml");

replaceOnce('src/app.js',"  adminShellHtml,examAdminHtml,bankAdminHtml,gradingAdminHtml,gradesAdminHtml,\n","  adminShellHtml,examAdminHtml,gradingAdminHtml,gradesAdminHtml,\n");
replaceOnce('src/app.js',"  questionModalHtml,bankPickerHtml,previewExamModalHtml,previewQuestionModalHtml,\n","  questionModalHtml,previewExamModalHtml,previewQuestionModalHtml,\n");
replaceOnce('src/app.js',"import {createExamDraft,ensureExamMatchesConfiguredSpec} from './controllers/exam-factory.js';\n","import {createExamDraft,ensureExamMatchesConfiguredSpec} from './controllers/exam-factory.js';\nimport {hasPartTemplate,openPartTemplate} from './part-templates/index.js';\n");
replaceOnce('src/app.js',"  else if(ui.adminTab==='bank')content=bankAdminHtml({data,user});\n",'');
replaceRegexOnce('src/app.js',/\nfunction bankPicker\(\)\{[\s\S]*?\nfunction previewExamModal/,"\nfunction previewExamModal");
replaceOnce('src/app.js',"  app.querySelectorAll('[data-action=\"edit-a1-group\"]').forEach(b=>b.onclick=async()=>{\n    const exam=byId(data.exams,ui.builderExamId),section=exam?.sections.find(s=>s.id===ui.builderSectionId);\n    if(!exam||!section)return;\n    if((exam.provider&&exam.provider!=='GOETHE')||exam.level!=='A1'){\n      notify('Template cụm này hiện chỉ áp dụng cho Goethe A1 · Nghe · Phần 1.');\n      return;\n    }\n    const existingId=section.questionIds.map(id=>byId(data.questions,id)?.groupId).find(Boolean)||null;\n    const {openA1ListeningPart1Editor}=await import('./question-groups/bootstrap.js');\n    const commit=ops=>repo.transaction(st=>{for(const op of ops){st[op.collection]||=[];const i=st[op.collection].findIndex(x=>x.id===op.id);if(i>=0)st[op.collection][i]=op.item;else st[op.collection].push(op.item);}});\n    await openA1ListeningPart1Editor({groupId:existingId,state:data,user,commit,onSaved:async group=>{\n      await act(()=>repo.transaction(st=>updateSection(st,user,exam.id,section.id,{questionIds:group.questionIds||[]})),'Đã lưu cụm A1 Nghe Phần 1.');\n    }});\n  });",
"  app.querySelectorAll('[data-action=\"edit-part-template\"]').forEach(b=>b.onclick=async()=>{\n    const exam=byId(data.exams,ui.builderExamId),section=exam?.sections.find(s=>s.id===ui.builderSectionId);\n    if(!exam||!section)return;\n    if(!hasPartTemplate(section.templateType)){notify('Part này chưa có template riêng.');return;}\n    const existingId=section.questionIds.map(id=>byId(data.questions,id)?.groupId).find(Boolean)||null;\n    const commit=ops=>repo.transaction(st=>{for(const op of ops){st[op.collection]||=[];const i=st[op.collection].findIndex(x=>x.id===op.id);if(i>=0)st[op.collection][i]=op.item;else st[op.collection].push(op.item);}});\n    await openPartTemplate(section.templateType,{groupId:existingId,state:data,user,commit,onSaved:async group=>{\n      await act(()=>repo.transaction(st=>updateSection(st,user,exam.id,section.id,{questionIds:group.questionIds||[]})),'Đã lưu cấu hình Part.');\n    }});\n  });");
replaceOnce('src/app.js',"  app.querySelectorAll('[data-action=\"edit-a1-group\"]').forEach(button=>{\n    if((exam.provider&&exam.provider!=='GOETHE')||exam.level!=='A1'){\n      button.disabled=true;\n      button.textContent='Template phần này sẽ cấu hình riêng';\n    }\n  });",
"  app.querySelectorAll('[data-action=\"edit-part-template\"]').forEach(button=>{\n    const section=exam.sections.find(item=>item.id===ui.builderSectionId);\n    if(!hasPartTemplate(section?.templateType)){button.disabled=true;button.textContent='Template phần này chưa cấu hình';}\n  });");

replaceOnce('src/views/builder.js','data-action="edit-a1-group">Cấu hình cụm A1 · Nghe · Phần 1</button>','data-action="edit-part-template">Cấu hình phần</button>');

write('src/feature-loader.js',`const app=document.getElementById('app');
const loaded=new Map();let frame=0;let settingsTimer=null;
function load(path){if(loaded.has(path))return loaded.get(path);const task=import(path).catch(error=>{console.error(\`Không tải được module \${path}\`,error);loaded.delete(path);});loaded.set(path,task);return task;}
function syncRolePath(){if(globalThis.G2G_DEMO_BYPASS)return;const badge=app?.querySelector('.thanh-dau .nhan')?.textContent?.trim()||'';let target='';if(badge==='Quản trị cấp cao')target='/adm';else if(badge==='Giáo viên')target='/teacher';else if(badge==='Học viên'&&['/adm','/teacher'].includes(location.pathname))target='/';if(target&&location.pathname!==target)history.replaceState(null,'',target);}
function inspect(){
  if(!app)return;syncRolePath();const admin=app.querySelector('.khung-quan-tri');
  if(admin){const activeTab=app.querySelector('[data-action="admin-tab"].active')?.dataset.tab||'';const heading=app.querySelector('.noi-dung-quan-tri .tieu-de-trang h1')?.textContent?.trim()||'';if(activeTab==='trash'||heading==='Thùng rác')load('./question-groups/trash.js');if(!globalThis.G2G_DEMO_BYPASS){if(!settingsTimer&&!loaded.has('./settings.js'))settingsTimer=setTimeout(()=>{settingsTimer=null;if(app.querySelector('.khung-quan-tri'))load('./settings.js');},250);if(activeTab==='teachers'||heading==='Giáo viên & tài khoản'||heading==='Danh sách người dùng')load('./users/bootstrap.js');}}
  if(!globalThis.G2G_DEMO_BYPASS&&app.querySelector('.thi'))load('./part-templates/runtime.js');
}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;inspect();});}
if(app)new MutationObserver(schedule).observe(app,{childList:true});document.addEventListener('click',event=>{if(event.target.closest?.('[data-action="admin-tab"]'))setTimeout(schedule,0);},true);schedule();
`);

remove('src/question-groups/bootstrap.js');
remove('src/question-groups/picker.js');

// 6) Tests: generic group lifecycle + template validator/spec rules.
write('tests/question-groups.test.mjs',`import assert from 'node:assert/strict';
import {createQuestionGroup,updateQuestionGroup,groupTotalScore} from '../src/core.js';
import {loadApprovedPartSpec} from '../src/exam-specs/spec-loader.js';
import {validateA1ListeningPart1} from '../src/part-templates/a1-listening-part-1/validator.js';

const user={id:'teacher-1',name:'Giáo viên',role:'teacher'};
const questions=[1,2,3].map(n=>({id:\`q\${n}\`,title:\`Câu \${n}\`,prompt:\`Prompt \${n}\`,audioUrl:\`/audio/\${n}.mp3\`,choices:['A','B','C'].map(key=>({key,text:key,imageUrl:''})),correctAnswer:0,maxScore:n===3?2:1,status:'active',ownerId:user.id}));
const state={users:[user],questionGroups:[],questions,exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};
const spec=await loadApprovedPartSpec('../../specs/goethe/a1/listening/part-01.json');
const group=createQuestionGroup(state,user,{id:'g1',level:'A1',skill:'Nghe',skillKey:'listening',part:'Phần 1',partOrder:1,title:'A1 · Nghe · Phần 1',instruction:'Nghe và chọn đáp án đúng.',structureType:spec.template,audioPolicy:{...spec.audio},defaultScore:1,questionIds:['q1','q2','q3']});
assert.equal(group.questionIds.length,3);assert.equal(groupTotalScore(group,state),4);
updateQuestionGroup(state,user,'g1',{defaultScore:1.5});assert.equal(state.questionGroups[0].defaultScore,1.5);
assert.equal(validateA1ListeningPart1({group,questions,spec}),true);
const badAudio=questions.map(q=>({...q}));badAudio[0]={...badAudio[0],audioUrl:''};assert.throws(()=>validateA1ListeningPart1({group,questions:badAudio,spec}),/audio/i);
const tooMany=Array.from({length:11},(_,index)=>({...questions[0],id:\`x\${index}\`}));assert.throws(()=>validateA1ListeningPart1({group,questions:tooMany,spec}),/1.*10|10 câu/i);
assert.equal(spec.audio.segmentRepeat,2);assert.equal(spec.audio.pauseAllowed,false);assert.equal(spec.audio.replayAllowed,false);
console.log('✓ A1 Nghe Phần 1 dùng spec chung cho validator, audio policy và điểm.');
`);

{
  const rel='tests/architecture.test.mjs';let source=read(rel);
  const marker="test('Media garbage collector được khởi động từ server',()=>{";
  const addition=`test('Part template A1 Nghe 1 đã tách module và bỏ legacy question bank',()=>{\n  const registry=read('src/part-templates/index.js'),loader=read('src/feature-loader.js'),admin=read('src/views/admin.js'),modals=read('src/views/modals.js'),server=read('server/src/actions/attempts.js');\n  assert.ok(registry.includes("./a1-listening-part-1/index.js"));\n  for(const rel of ['src/part-templates/a1-listening-part-1/editor.js','src/part-templates/a1-listening-part-1/student.js','src/part-templates/a1-listening-part-1/validator.js','src/part-templates/shared/api.js'])assert.ok(fs.existsSync(path.join(root,rel)),\`Thiếu module: \${rel}\`);\n  assert.equal(fs.existsSync(path.join(root,'src/question-groups/bootstrap.js')),false);\n  assert.equal(fs.existsSync(path.join(root,'src/question-groups/picker.js')),false);\n  assert.equal(admin.includes('bankAdminHtml'),false);assert.equal(modals.includes('bankPickerHtml'),false);assert.equal(loader.includes('Ngân hàng câu hỏi'),false);\n  assert.ok(server.includes('getA1ListeningPart1Spec'));assert.equal(server.includes('segmentRepeat)!==2'),false);\n});\n\n`;
  if(!source.includes("Part template A1 Nghe 1 đã tách module")){if(!source.includes(marker))throw new Error('Không thấy marker architecture test');source=source.replace(marker,addition+marker);write(rel,source);}
}

console.log('Step 7 refactor applied.');
