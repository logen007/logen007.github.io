import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const p=rel=>path.join(root,rel);
const read=rel=>fs.readFileSync(p(rel),'utf8');
const write=(rel,content)=>{fs.mkdirSync(path.dirname(p(rel)),{recursive:true});fs.writeFileSync(p(rel),content);};
const replaceOnce=(source,from,to,label)=>{
  if(!source.includes(from))throw new Error(`Không tìm thấy đoạn cần thay: ${label}`);
  return source.replace(from,to);
};

write('src/part-templates/a1-listening-part-1/validator.js',`export function validateA1ListeningPart1({part,section,group,questions,spec}){
  const context=part||section||group;
  const min=Math.max(1,Number(spec?.questions?.min||1));
  const max=Math.max(min,Number(spec?.questions?.max||min));
  const keys=Array.isArray(spec?.answers?.keys)?spec.answers.keys:['A','B','C'];
  if(!String(context?.instruction||'').trim())throw new Error('Cần nhập đề bài chung.');
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
const questionDraft=(index,score=1)=>({id:id('q'),prompt:'',audioUrl:'',choices:['A','B','C'].map(key=>({key,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,locked:false,partQuestionOrder:index+1});
const stripLegacyGroupFields=item=>{for(const key of ['groupId','groupType','groupOrder','groupInstruction','groupAudioPolicy'])delete item[key];return item;};

function injectStyles(){
  if(document.getElementById('a1ListeningPart1Styles'))return;
  const style=document.createElement('style');style.id='a1ListeningPart1Styles';style.textContent=\`
    .tpl-a1-modal .noi-hop{width:min(1120px,100%)}.tpl-a1-grid{display:grid;grid-template-columns:1fr 180px;gap:12px}.tpl-a1-question{border:1px solid var(--vien);border-radius:var(--r);padding:14px;margin-top:12px;background:#fff}.tpl-a1-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tpl-a1-question-grid{display:grid;grid-template-columns:1fr 130px;gap:10px}.tpl-a1-choice{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;margin-top:8px}.tpl-a1-choice input{width:100%;height:38px;border:1px solid var(--vien);border-radius:5px;padding:0 9px}.tpl-a1-total{font-weight:800}@media(max-width:760px){.tpl-a1-grid,.tpl-a1-question-grid{grid-template-columns:1fr}.tpl-a1-choice{grid-template-columns:36px 1fr}.tpl-a1-choice input:nth-of-type(2){grid-column:2}}
  \`;document.head.appendChild(style);
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
  const legacyGroupId=originalQuestions.map(q=>q.groupId).find(Boolean)||null;
  const legacyGroup=legacyGroupId?(state.questionGroups||[]).find(item=>item.id===legacyGroupId):null;
  if((exam?.locked||originalQuestions.some(q=>q.locked))&&user.role!=='master')throw new Error('Phần này đã được dùng và đang khóa.');
  const uniformScores=[...new Set(originalQuestions.map(q=>Number(q.maxScore)).filter(Number.isFinite))];
  let defaultScore=Math.max(0,Number(legacyGroup?.defaultScore??(uniformScores.length===1?uniformScores[0]:specDefaultScore))||0);
  let questions=(originalQuestions.length?originalQuestions:Array.from({length:Math.min(3,maxQuestions)},(_,index)=>questionDraft(index,defaultScore))).map((q,index)=>({...q,partQuestionOrder:index+1,choices:['A','B','C'].map((key,j)=>normalizeChoice(q.choices?.[j],key)),maxScore:Number(q.maxScore??defaultScore)}));
  const part={
    id:section.id,
    instruction:section.instruction||legacyGroup?.instruction||originalQuestions[0]?.groupInstruction||'',
    defaultScore,
    templateType:section.templateType||spec.template,
  };
  const modal=document.createElement('div');modal.id='partTemplateModal';modal.className='hop-chon tpl-a1-modal';document.body.appendChild(modal);

  const render=()=>{
    modal.innerHTML=\`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">CẤU HÌNH PART</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="tplClose">×</button></div><div class="tpl-a1-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="tplInstruction" style="width:100%;min-height:90px">\${esc(part.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định<input id="tplDefaultScore" type="number" min="0" step="0.25" value="\${part.defaultScore}"><button class="nut nho" id="tplApplyScore" type="button" style="margin-top:8px">Áp dụng toàn bộ</button></label></div><div class="goi-y">Mỗi câu tương ứng một mảnh audio. Hệ thống phát mỗi mảnh \${policy.segmentRepeat} lần và không cho học viên pause hoặc nghe lại.</div><div id="tplQuestions">\${questions.map(questionCard).join('')}</div><div class="chan-hop"><div><span class="phu-de">\${questions.length}/\${maxQuestions} câu · </span><span class="tpl-a1-total">Tổng điểm: <span id="tplTotal">\${questions.reduce((n,q)=>n+Number(q.maxScore||0),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="tplAdd" \${questions.length>=maxQuestions?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="tplSave">Lưu</button></div></div></div>\`;
    modal.querySelector('#tplClose').onclick=()=>modal.remove();
    modal.querySelector('#tplAdd').onclick=()=>{sync();if(questions.length<maxQuestions){questions.push(questionDraft(questions.length,Number(modal.querySelector('#tplDefaultScore').value)||specDefaultScore));render();}};
    modal.querySelector('#tplApplyScore').onclick=()=>{const value=Math.max(0,Number(modal.querySelector('#tplDefaultScore').value)||0);modal.querySelectorAll('.tpl-score').forEach(input=>input.value=String(value));syncTotal();};
    modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{sync();if(questions.length<=minQuestions)return;questions.splice(Number(button.dataset.remove),1);questions.forEach((q,index)=>q.partQuestionOrder=index+1);render();});
    modal.querySelectorAll('.tpl-score').forEach(input=>input.oninput=syncTotal);
    modal.querySelector('#tplSave').onclick=save;
  };

  function questionCard(q,index){
    return \`<section class="tpl-a1-question"><div class="tpl-a1-head"><b>Câu \${index+1}</b><button class="nut nho nguy" data-remove="\${index}" \${questions.length<=minQuestions?'disabled':''}>Xóa câu</button></div><div class="tpl-a1-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="tpl-prompt" data-i="\${index}" style="width:100%;min-height:70px">\${esc(q.prompt||'')}</textarea></label><label class="cai-dat">Điểm<input class="tpl-score" data-i="\${index}" type="number" min="0" step="0.25" value="\${Number(q.maxScore??specDefaultScore)}"><span class="phu-de">Đáp án đúng</span><select class="tpl-correct" data-i="\${index}">\${['A','B','C'].map((key,j)=>\`<option value="\${j}" \${Number(q.correctAnswer)===j?'selected':''}>\${key}</option>\`).join('')}</select></label></div><label class="cai-dat">Audio<input class="tpl-audio" data-i="\${index}" type="file" accept="audio/*"></label><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh tùy chọn</div>\${q.choices.map((choice,j)=>\`<div class="tpl-a1-choice"><strong>\${choice.key}</strong><input class="tpl-choice" data-i="\${index}" data-j="\${j}" value="\${esc(choice.text)}" placeholder="Nội dung \${choice.key}"><input class="tpl-image" data-i="\${index}" data-j="\${j}" type="file" accept="image/*"></div>\`).join('')}</section>\`;
  }

  function sync(){
    part.instruction=modal.querySelector('#tplInstruction')?.value.trim()||'';
    part.defaultScore=Math.max(0,Number(modal.querySelector('#tplDefaultScore')?.value)||0);
    questions=questions.map((q,index)=>({...q,partQuestionOrder:index+1,prompt:modal.querySelector(\`.tpl-prompt[data-i="\${index}"]\`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(\`.tpl-correct[data-i="\${index}"]\`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(\`.tpl-score[data-i="\${index}"]\`)?.value)||0),choices:q.choices.map((choice,j)=>({...choice,text:modal.querySelector(\`.tpl-choice[data-i="\${index}"][data-j="\${j}"]\`)?.value.trim()||''}))}));
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
      validateA1ListeningPart1({part,questions,spec});
      if(typeof commit!=='function')throw new Error('Thiếu ngữ cảnh lưu Part.');
      const now=new Date().toISOString(),questionIds=questions.map(q=>q.id),ops=[];
      questions.forEach((q,index)=>{
        const item=stripLegacyGroupFields({...q,code:\`A1-LIS-01-\${String(index+1).padStart(3,'0')}\`,level:'A1',skill:'Nghe',part:section.name||'Phần 1',partOrder:Number(section.partOrder||1),type:'single',title:\`A1 Nghe 1 · Câu \${index+1}\`,instruction:'',autoGrade:Boolean(spec.scoring?.autoGrade??true),pairs:[],rubric:[],partQuestionOrder:index+1,ownerId:q.ownerId||exam?.ownerId||user.id,ownerName:q.ownerName||exam?.ownerName||user.name||'',status:q.status==='trash'?'active':(q.status||'active'),locked:Boolean(q.locked),usedCount:Number(q.usedCount||0),correctRate:q.correctRate??null,createdAt:q.createdAt||now,updatedAt:now});
        ops.push({collection:'questions',id:q.id,kind:'upsert',item});
      });
      const kept=new Set(questionIds);for(const old of originalQuestions)if(!kept.has(old.id))ops.push({collection:'questions',id:old.id,kind:'upsert',item:{...old,status:'trash',deletedAt:now,updatedAt:now}});
      await commit({operations:ops,sectionPatch:{instruction:part.instruction,questionIds}});
      modal.remove();if(onSaved)await onSaved({sectionId:section.id,instruction:part.instruction,questionIds});
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
  const attempt=(state.attempts||[]).find(item=>item.status==='in_progress'&&visibleIds.some(id=>(item.currentQuestionIds||[]).includes(id)));
  if(!attempt)return;
  const exam=(state.exams||[]).find(item=>item.id===attempt.examId);if(!exam)return;
  const section=(exam.sections||[]).find(item=>item.id===attempt.currentSectionId)||(exam.sections||[]).find(item=>(item.questionIds||[]).some(id=>visibleIds.includes(id)));
  if(!section||section.templateType!==spec.template)return;
  const partQuestions=(section.questionIds||[]).map(id=>(state.questions||[]).find(q=>q.id===id)).filter(q=>q&&visibleIds.includes(q.id));
  if(!partQuestions.length)return;
  examRoot.dataset.a1ListeningPart1Enhanced='1';
  const legacyGroupId=partQuestions.map(q=>q.groupId).find(Boolean)||null;
  const legacyGroup=legacyGroupId?(state.questionGroups||[]).find(item=>item.id===legacyGroupId):null;
  const firstNode=examRoot.querySelector(\`.cau-thi[data-q="\${CSS.escape(partQuestions[0].id)}"]\`);if(!firstNode)return;
  const intro=document.createElement('div');intro.className='qg-listen-intro';
  const sectionSession=attempt.audioSessions?.[section.id];
  const legacySession=legacyGroupId?attempt.audioSessions?.[legacyGroupId]:null;
  const started=sectionSession?.startedAt||legacySession?.startedAt;
  const instruction=section.instruction||legacyGroup?.instruction||partQuestions[0].groupInstruction||'';
  intro.innerHTML=\`<h3>Đề bài</h3><div>\${esc(instruction)}</div><div style="margin-top:12px"><button class="nut chinh tpl-start-listen" \${started?'disabled':''}>\${started?'Audio đã được sử dụng':'Bắt đầu nghe'}</button><div class="qg-listen-status">\${started?'Phiên nghe đã bắt đầu trước đó và không thể phát lại.':\`Khi bắt đầu, audio chạy liên tục. Mỗi mảnh phát \${policy.segmentRepeat} lần.\`}</div></div>\`;
  firstNode.insertAdjacentElement('beforebegin',intro);
  const audioElements=[];
  for(const question of partQuestions){
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
      await templateRequest('/actions/startPartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:section.id}});
      for(let index=0;index<audioElements.length;index++)for(let repeat=0;repeat<Math.max(1,policy.segmentRepeat);repeat++){
        status.textContent=\`Đang nghe mảnh \${index+1}/\${audioElements.length} · lượt \${repeat+1}/\${policy.segmentRepeat}\`;
        await playLocked(audioElements[index].audio,policy);
      }
      await templateRequest('/actions/completePartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:section.id}});
      status.textContent='Đã nghe hết audio. Phiên nghe đã khóa.';button.textContent='Đã hoàn thành audio';
    }catch(error){status.textContent=\`Audio đã khóa. \${error.message}\`;button.textContent='Không thể phát lại';}
  };
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

let app=read('src/app.js');
const oldEditorBlock=`    const existingId=section.questionIds.map(id=>byId(data.questions,id)?.groupId).find(Boolean)||null;
    const commit=ops=>repo.transaction(st=>{for(const op of ops){st[op.collection]||=[];const i=st[op.collection].findIndex(x=>x.id===op.id);if(i>=0)st[op.collection][i]=op.item;else st[op.collection].push(op.item);}});
    await openPartTemplate(section.templateType,{groupId:existingId,state:data,user,commit,onSaved:async group=>{
      await act(()=>repo.transaction(st=>updateSection(st,user,exam.id,section.id,{questionIds:group.questionIds||[]})),'Đã lưu cấu hình Part.');
    }});`;
const newEditorBlock=`    const commit=({operations=[],sectionPatch={}}={})=>repo.transaction(st=>{
      for(const op of operations){
        st[op.collection]||=[];
        const index=st[op.collection].findIndex(item=>item.id===op.id);
        if(op.kind==='delete'){if(index>=0)st[op.collection].splice(index,1);continue;}
        if(index>=0)st[op.collection][index]=op.item;else st[op.collection].push(op.item);
      }
      updateSection(st,user,exam.id,section.id,sectionPatch);
    });
    await openPartTemplate(section.templateType,{exam,section,state:data,user,commit,onSaved:async()=>{
      data=await repo.getState();notify('Đã lưu cấu hình Part.');render();
    }});`;
app=replaceOnce(app,oldEditorBlock,newEditorBlock,'app Part editor commit');
write('src/app.js',app);

let serverAttempts=read('server/src/actions/attempts.js');
const audioStart=serverAttempts.indexOf('async function audioGroupContext');
const audioEnd=serverAttempts.indexOf('export async function setAttemptSection',audioStart);
if(audioStart<0||audioEnd<0)throw new Error('Không tìm thấy khối audio group trong server attempts');
const newAudio=`async function partAudioContext(client,attempt,sectionId){
  const exam=await examById(attempt.exam_id,client);
  const section=(exam.sections||[]).find(item=>item.id===sectionId);
  if(!section)throw appError(404,'Không tìm thấy Part audio.');
  if(attempt.public_data?.currentSectionId!==section.id)throw appError(409,'Part audio không thuộc phần thi hiện tại.');
  const spec=await getA1ListeningPart1Spec();
  if(section.templateType!==spec.template)throw appError(409,'Part này không dùng template audio hiện tại.');
  const policy=spec.audio||{};
  if(Number(policy.maxSessions)<1||Number(policy.segmentRepeat)<1)throw appError(500,'Specification audio không hợp lệ.');
  const allowed=new Set(attempt.public_data.currentQuestionIds||[]);
  const ids=(section.questionIds||[]).filter(id=>allowed.has(id));
  if(!ids.length)throw appError(409,'Part audio không có câu hỏi trong phần thi hiện tại.');
  const questionRows=await client.query(\`SELECT id,data FROM questions WHERE id = ANY($1::text[])\`,[ids]);
  const legacyGroupIds=[...new Set(questionRows.rows.map(row=>row.data?.groupId).filter(Boolean))];
  return {section,ids,legacyGroupIds};
}

function hasStartedPartSession(sessions,sectionId,legacyGroupIds=[]){
  if(sessions?.[sectionId]?.startedAt)return true;
  return legacyGroupIds.some(id=>sessions?.[id]?.startedAt);
}

export async function startPartAudio(user,{attemptId,sectionId}){
  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');
  return withTx(async client=>{
    const result=await client.query(\`SELECT * FROM attempts WHERE id=$1 FOR UPDATE\`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền phát audio của lượt thi này.');
    const {section,legacyGroupIds}=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    if(hasStartedPartSession(sessions,section.id,legacyGroupIds))throw appError(409,'Audio của phần này đã được bắt đầu và không thể phát lại.');
    const startedAt=now();
    sessions[section.id]={startedAt,completedAt:null};
    const out={...publicData,audioSessions:sessions,updatedAt:startedAt};
    await client.query(\`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1\`,[attemptId,JSON.stringify(out)]);
    await audit(user,'start_part_audio','attempt',attemptId,{sectionId:section.id},client);
    return {ok:true,startedAt};
  });
}

export async function completePartAudio(user,{attemptId,sectionId}){
  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');
  return withTx(async client=>{
    const result=await client.query(\`SELECT * FROM attempts WHERE id=$1 FOR UPDATE\`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền cập nhật audio của lượt thi này.');
    const {section,legacyGroupIds}=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    const legacySession=legacyGroupIds.map(id=>sessions[id]).find(item=>item?.startedAt);
    const session=sessions[section.id]||legacySession;
    if(!session?.startedAt)throw appError(409,'Phiên audio chưa được bắt đầu.');
    if(session.completedAt)return {ok:true,completedAt:session.completedAt};
    const completedAt=now();
    sessions[section.id]={...session,completedAt};
    const out={...publicData,audioSessions:sessions,updatedAt:completedAt};
    await client.query(\`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1\`,[attemptId,JSON.stringify(out)]);
    await audit(user,'complete_part_audio','attempt',attemptId,{sectionId:section.id},client);
    return {ok:true,completedAt};
  });
}

async function legacySectionIdForGroup(attemptId,groupId){
  const attemptResult=await query(\`SELECT * FROM attempts WHERE id=$1\`,[attemptId]);
  if(!attemptResult.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
  const attempt=attemptResult.rows[0];
  const groupResult=await query(\`SELECT data FROM question_groups WHERE id=$1\`,[groupId]);
  if(!groupResult.rowCount)throw appError(404,'Không tìm thấy cụm audio cũ.');
  const ids=new Set(groupResult.rows[0].data?.questionIds||[]);
  const exam=await examById(attempt.exam_id);
  const section=(exam.sections||[]).find(item=>(item.questionIds||[]).some(id=>ids.has(id)));
  if(!section)throw appError(409,'Cụm audio cũ không còn gắn với Part hiện tại.');
  return section.id;
}

// Compatibility only for cached/legacy clients during Step 9A. New runtime uses sectionId.
export async function startAudioGroup(user,{attemptId,groupId}){
  return startPartAudio(user,{attemptId,sectionId:await legacySectionIdForGroup(attemptId,groupId)});
}
export async function completeAudioGroup(user,{attemptId,groupId}){
  return completePartAudio(user,{attemptId,sectionId:await legacySectionIdForGroup(attemptId,groupId)});
}

`;
serverAttempts=serverAttempts.slice(0,audioStart)+newAudio+serverAttempts.slice(audioEnd);
write('server/src/actions/attempts.js',serverAttempts);

let actionIndex=read('server/src/actions/index.js');
actionIndex=replaceOnce(actionIndex,
  "import {startAttempt,saveAnswers,startAudioGroup,completeAudioGroup,setAttemptSection,abandonAttempt,submitAttempt} from './attempts.js';",
  "import {startAttempt,saveAnswers,startPartAudio,completePartAudio,startAudioGroup,completeAudioGroup,setAttemptSection,abandonAttempt,submitAttempt} from './attempts.js';",
  'server action import');
actionIndex=replaceOnce(actionIndex,
  "    case 'saveAnswers': return saveAnswers(user,data);\n    case 'startAudioGroup': return startAudioGroup(user,data);\n    case 'completeAudioGroup': return completeAudioGroup(user,data);",
  "    case 'saveAnswers': return saveAnswers(user,data);\n    case 'startPartAudio': return startPartAudio(user,data);\n    case 'completePartAudio': return completePartAudio(user,data);\n    case 'startAudioGroup': return startAudioGroup(user,data);\n    case 'completeAudioGroup': return completeAudioGroup(user,data);",
  'server action cases');
write('server/src/actions/index.js',actionIndex);

let arch=read('tests/architecture.test.mjs');
const marker="test('Media garbage collector được khởi động từ server',()=>{";
const step9Test=`test('Step 9A lưu A1 Nghe 1 theo Part thay vì tạo QuestionGroup mới',()=>{
  const editor=read('src/part-templates/a1-listening-part-1/editor.js');
  const student=read('src/part-templates/a1-listening-part-1/student.js');
  const app=read('src/app.js');
  const attempts=read('server/src/actions/attempts.js');
  const actions=read('server/src/actions/index.js');
  assert.equal(editor.includes("collection:'questionGroups'"),false);
  assert.equal(editor.includes('groupAudioPolicy'),true); // only compatibility cleanup list may mention the legacy field
  assert.ok(editor.includes('sectionPatch'));
  assert.ok(app.includes('openPartTemplate(section.templateType,{exam,section'));
  assert.ok(student.includes('attempt.currentSectionId'));
  assert.ok(student.includes("/actions/startPartAudio"));
  assert.ok(student.includes("/actions/completePartAudio"));
  assert.ok(attempts.includes('partAudioContext'));
  assert.ok(attempts.includes('sessions[section.id]'));
  assert.ok(actions.includes("case 'startPartAudio'"));
  assert.ok(attempts.includes('Compatibility only for cached/legacy clients during Step 9A'));
});

`;
arch=replaceOnce(arch,marker,step9Test+marker,'architecture step9A test');
write('tests/architecture.test.mjs',arch);

console.log('Step 9A part-data refactor applied.');
