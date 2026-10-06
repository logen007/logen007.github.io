const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
const TYPE='A1_LISTENING_PART_1';
const POLICY=Object.freeze({maxSessions:1,segmentRepeat:2,controls:false,pauseAllowed:false,replayAllowed:false});
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;

async function request(path,{method='GET',body,form}={}){
  const options={method,credentials:'include',headers:{}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  if(form)options.body=form;
  const res=await fetch(`${API}${path}`,options);
  let data={};try{data=await res.json();}catch{}
  if(!res.ok)throw new Error(data?.error||`Máy chủ trả về lỗi ${res.status}.`);
  return data;
}

async function upload(kind,file){
  if(!file)return '';
  const form=new FormData();form.append('file',file,file.name||kind);
  const data=await request(`/media/${kind}`,{method:'POST',form});
  return data.url||'';
}

function injectStyles(){
  if(document.getElementById('qgStyles'))return;
  const style=document.createElement('style');style.id='qgStyles';style.textContent=`
    .qg-hidden-row{display:none!important}.qg-panel{margin:0 0 18px}.qg-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.qg-table{width:100%;border-collapse:collapse}.qg-table th,.qg-table td{padding:11px 12px;border-bottom:1px solid var(--vien);text-align:left;font-size:12px}.qg-table th{color:var(--phu);font-size:11px}.qg-actions{display:flex;gap:6px;flex-wrap:wrap}.qg-modal .noi-hop{width:min(1120px,100%)}.qg-grid{display:grid;grid-template-columns:1fr 160px;gap:12px}.qg-question{border:1px solid var(--vien);border-radius:var(--r);padding:14px;margin-top:12px;background:#fff}.qg-question-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.qg-question-grid{display:grid;grid-template-columns:1fr 130px;gap:10px}.qg-choice{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;margin-top:8px}.qg-choice strong{text-align:center}.qg-choice input{width:100%;height:38px;border:1px solid var(--vien);border-radius:5px;padding:0 9px}.qg-audio-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.qg-total{font-weight:800}.qg-listen-intro{border:1px solid var(--vien);border-radius:var(--r);padding:16px;margin:0 0 14px;background:#fbfbfd}.qg-listen-intro h3{margin:0 0 6px}.qg-listen-status{margin-top:10px;font-size:12px;color:var(--phu)}.qg-choice-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.qg-answer{display:block;border:1px solid var(--vien);border-radius:8px;padding:10px;cursor:pointer;background:#fff}.qg-answer input{margin-right:7px}.qg-answer img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;border-radius:6px;margin:8px 0;background:#f7f7f9}.qg-answer:has(input:checked){border-color:var(--tim);background:var(--tim-nhat)}
    @media(max-width:760px){.qg-grid,.qg-question-grid,.qg-audio-row{grid-template-columns:1fr}.qg-choice{grid-template-columns:36px 1fr}.qg-choice input:nth-of-type(2){grid-column:2}.qg-choice-list{grid-template-columns:1fr}.qg-head{flex-direction:column}.qg-head .nut{width:100%}}
  `;document.head.appendChild(style);
}

async function mountBankPanel(){
  const main=document.querySelector('.noi-dung-quan-tri');
  const title=main?.querySelector('.tieu-de-trang h1');
  if(!main||title?.textContent.trim()!=='Ngân hàng câu hỏi'||main.querySelector('#qgPanel'))return;
  let state;try{state=await request('/state');}catch{return;}
  if(!document.body.contains(main)||main.querySelector('#qgPanel'))return;
  const groups=(state.questionGroups||[]).filter(g=>g.status!=='trash'&&g.structureType===TYPE);
  const groupQuestionIds=new Set(groups.flatMap(g=>g.questionIds||[]));
  for(const button of main.querySelectorAll('[data-action="edit-question"],[data-action="preview-question"],[data-action="delete-question"]')){
    if(groupQuestionIds.has(button.dataset.id))button.closest('tr')?.classList.add('qg-hidden-row');
  }
  const panel=document.createElement('section');panel.id='qgPanel';panel.className='the qg-panel';
  panel.innerHTML=`<div class="qg-head"><div><div class="nhan-muc">CỤM CÂU HỎI</div><h2 style="margin:4px 0">A1 · Nghe · Phần 1</h2><div class="phu-de">Đề bài chung · audio nhiều mảnh · mỗi mảnh phát 2 lần · không pause / không nghe lại.</div></div><button class="nut chinh" id="qgNew">+ Tạo cụm A1 Nghe 1</button></div><div class="table-wrap"><table class="qg-table"><thead><tr><th>Cụm</th><th>Số câu</th><th>Điểm</th><th>Người tạo</th><th>Thao tác</th></tr></thead><tbody>${groups.map(g=>{const qs=(state.questions||[]).filter(q=>(g.questionIds||[]).includes(q.id)&&q.status!=='trash');const total=qs.reduce((n,q)=>n+Number(q.maxScore||0),0);return `<tr><td><b>${esc(g.title||'A1 · Nghe · Phần 1')}</b><div class="phu-de">${esc(g.instruction||'Chưa có đề bài')}</div></td><td>${qs.length}/10</td><td>${total}</td><td>${esc(g.ownerName||'')}</td><td><div class="qg-actions"><button class="nut nho" data-qg-edit="${g.id}">Sửa cụm</button><button class="nut nho nguy" data-qg-delete="${g.id}">Xóa</button></div></td></tr>`;}).join('')||'<tr><td colspan="5" class="rong">Chưa có cụm A1 Nghe Phần 1.</td></tr>'}</tbody></table></div>`;
  main.querySelector('.tieu-de-trang')?.insertAdjacentElement('afterend',panel);
  panel.querySelector('#qgNew').onclick=()=>openEditor();
  panel.querySelectorAll('[data-qg-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.qgEdit));
  panel.querySelectorAll('[data-qg-delete]').forEach(b=>b.onclick=()=>softDeleteGroup(b.dataset.qgDelete));
}

function normalizeChoice(choice,key){return choice&&typeof choice==='object'?{key,text:String(choice.text||''),imageUrl:String(choice.imageUrl||'')}:{key,text:String(choice||''),imageUrl:''};}
function questionDraft(index,score=1){return {id:id('q'),groupOrder:index+1,prompt:'',audioUrl:'',choices:['A','B','C'].map(k=>({key:k,text:'',imageUrl:''})),correctAnswer:0,maxScore:score,locked:false};}

export async function openA1ListeningPart1Editor({groupId=null,onSaved,state:initialState,user:initialUser,commit}={}){
  injectStyles();
  return openEditor(groupId,onSaved,initialState,initialUser,commit);
}

async function openEditor(groupId=null,onSaved=null,initialState=null,initialUser=null,commit=null){
  let state=initialState,user=initialUser;
  if(!state||!user){try{const me=await request('/auth/me');state=await request('/state');user=me.user;}catch(error){alert(error.message);return;}}
  if(!user||!['teacher','master'].includes(user.role)){alert('Chỉ giáo viên hoặc quản trị viên được sửa cụm câu hỏi.');return;}
  const existing=groupId?(state.questionGroups||[]).find(g=>g.id===groupId):null;
  const originalQuestions=existing?(state.questions||[]).filter(q=>(existing.questionIds||[]).includes(q.id)).sort((a,b)=>(a.groupOrder||0)-(b.groupOrder||0)):[];
  if(existing&&(existing.locked||originalQuestions.some(q=>q.locked))&&user.role!=='master'){alert('Cụm đã được dùng trong đề và đang khóa.');return;}
  let questions=(originalQuestions.length?originalQuestions:[questionDraft(0),questionDraft(1),questionDraft(2)]).map((q,i)=>({...q,groupOrder:i+1,choices:['A','B','C'].map((k,j)=>normalizeChoice(q.choices?.[j],k)),maxScore:Number(q.maxScore??existing?.defaultScore??1)}));
  const group={
    id:existing?.id||id('qg'),level:'A1',skill:'Nghe',skillKey:'listening',part:'Phần 1',partOrder:1,
    title:existing?.title||'A1 · Nghe · Phần 1',instruction:existing?.instruction||'',structureType:TYPE,
    audioPolicy:{...POLICY},defaultScore:Number(existing?.defaultScore??1),ownerId:existing?.ownerId||user.id,ownerName:existing?.ownerName||user.name||'',status:existing?.status||'active',locked:Boolean(existing?.locked),version:Number(existing?.version||1),createdAt:existing?.createdAt||new Date().toISOString(),
  };
  const modal=document.createElement('div');modal.id='qgModal';modal.className='hop-chon qg-modal';document.body.appendChild(modal);

  const render=()=>{
    modal.innerHTML=`<div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">${existing?'CHỈNH SỬA':'TẠO'} CỤM CÂU HỎI</div><h2>A1 · Nghe · Phần 1</h2></div><button class="nut nho" id="qgClose">×</button></div><div class="qg-grid" style="margin-top:14px"><label class="cai-dat">Đề bài chung<textarea id="qgInstruction" style="width:100%;min-height:90px">${esc(group.instruction)}</textarea></label><label class="cai-dat">Điểm mặc định cho câu mới<input id="qgDefaultScore" type="number" min="0" step="0.25" value="${group.defaultScore}"><button class="nut nho" id="qgApplyScore" type="button" style="margin-top:8px">Áp dụng cho toàn bộ câu</button></label></div><div class="goi-y">Audio là một phiên chung. Mỗi câu tương ứng một mảnh audio; hệ thống tự phát mảnh đó 2 lần rồi chuyển sang mảnh kế tiếp. Học viên không có Pause, Stop, tua hoặc nghe lại.</div><div id="qgQuestions">${questions.map((q,i)=>questionCard(q,i)).join('')}</div><div class="chan-hop"><div><span class="phu-de">${questions.length}/10 câu · </span><span class="qg-total">Tổng điểm: <span id="qgTotal">${questions.reduce((n,q)=>n+Number(q.maxScore||0),0)}</span></span></div><div class="nhom-nut"><button class="nut" id="qgAdd" ${questions.length>=10?'disabled':''}>+ Thêm câu</button><button class="nut chinh" id="qgSave">Lưu cụm</button></div></div></div>`;
    modal.querySelector('#qgClose').onclick=()=>modal.remove();
    modal.querySelector('#qgAdd').onclick=()=>{syncFromDom();if(questions.length<10){questions.push(questionDraft(questions.length,Number(modal.querySelector('#qgDefaultScore').value)||1));render();}};
    modal.querySelector('#qgApplyScore').onclick=()=>{const v=Math.max(0,Number(modal.querySelector('#qgDefaultScore').value)||0);modal.querySelectorAll('.qg-score').forEach(x=>x.value=String(v));syncTotal();};
    modal.querySelectorAll('[data-qg-remove]').forEach(b=>b.onclick=()=>{syncFromDom();if(questions.length<=1){alert('Mỗi cụm phải có ít nhất 1 câu.');return;}questions.splice(Number(b.dataset.qgRemove),1);questions.forEach((q,i)=>q.groupOrder=i+1);render();});
    modal.querySelectorAll('.qg-score').forEach(x=>x.oninput=syncTotal);
    modal.querySelector('#qgSave').onclick=save;
  };

  function questionCard(q,i){
    return `<section class="qg-question"><div class="qg-question-head"><div><b>Câu ${i+1}</b><div class="phu-de">Mảnh audio ${i+1} sẽ phát 2 lần</div></div><button class="nut nho nguy" data-qg-remove="${i}" ${questions.length<=1?'disabled':''}>Xóa câu</button></div><div class="qg-question-grid" style="margin-top:10px"><label class="cai-dat">Câu hỏi<textarea class="qg-prompt" data-i="${i}" style="width:100%;min-height:70px">${esc(q.prompt||'')}</textarea></label><label class="cai-dat">Điểm<input class="qg-score" data-i="${i}" type="number" min="0" step="0.25" value="${Number(q.maxScore??1)}"><br><span class="phu-de">Đáp án đúng</span><select class="qg-correct" data-i="${i}" style="width:100%;height:38px"><option value="0" ${Number(q.correctAnswer)===0?'selected':''}>A</option><option value="1" ${Number(q.correctAnswer)===1?'selected':''}>B</option><option value="2" ${Number(q.correctAnswer)===2?'selected':''}>C</option></select></label></div><div class="qg-audio-row cai-dat"><label>Audio URL<input class="qg-audio-url" data-i="${i}" value="${esc(q.audioUrl||'')}"></label><label>Tải mảnh audio<input class="qg-audio-file" data-i="${i}" type="file" accept="audio/*"></label></div><div style="margin-top:12px"><div class="phu-de"><b>Đáp án A / B / C</b> · hình ảnh là tùy chọn</div>${q.choices.map((c,j)=>`<div class="qg-choice"><strong>${c.key}</strong><input class="qg-choice-text" data-i="${i}" data-j="${j}" placeholder="Nội dung ${c.key}" value="${esc(c.text)}"><div><input class="qg-image-url" data-i="${i}" data-j="${j}" placeholder="URL hình ${c.key}" value="${esc(c.imageUrl)}"><input class="qg-image-file" data-i="${i}" data-j="${j}" type="file" accept="image/*" style="height:auto;margin-top:5px"></div></div>`).join('')}</div></section>`;
  }

  function syncFromDom(){
    group.instruction=modal.querySelector('#qgInstruction')?.value.trim()||'';
    group.defaultScore=Math.max(0,Number(modal.querySelector('#qgDefaultScore')?.value)||0);
    questions=questions.map((q,i)=>({...q,groupOrder:i+1,prompt:modal.querySelector(`.qg-prompt[data-i="${i}"]`)?.value.trim()||'',audioUrl:modal.querySelector(`.qg-audio-url[data-i="${i}"]`)?.value.trim()||'',correctAnswer:Number(modal.querySelector(`.qg-correct[data-i="${i}"]`)?.value||0),maxScore:Math.max(0,Number(modal.querySelector(`.qg-score[data-i="${i}"]`)?.value)||0),choices:q.choices.map((c,j)=>({...c,text:modal.querySelector(`.qg-choice-text[data-i="${i}"][data-j="${j}"]`)?.value.trim()||'',imageUrl:modal.querySelector(`.qg-image-url[data-i="${i}"][data-j="${j}"]`)?.value.trim()||''}))}));
  }
  function syncTotal(){modal.querySelector('#qgTotal').textContent=[...modal.querySelectorAll('.qg-score')].reduce((n,x)=>n+(Number(x.value)||0),0);}

  async function save(){
    const button=modal.querySelector('#qgSave');button.disabled=true;button.textContent='Đang lưu...';
    try{
      syncFromDom();
      if(!group.instruction)throw new Error('Cần nhập đề bài chung.');
      if(questions.length<1||questions.length>10)throw new Error('Mỗi cụm phải có từ 1 đến 10 câu.');
      for(let i=0;i<questions.length;i++){
        const q=questions[i];
        const audioFile=modal.querySelector(`.qg-audio-file[data-i="${i}"]`)?.files?.[0];
        if(audioFile)q.audioUrl=await upload('audio',audioFile);
        for(let j=0;j<3;j++){
          const imageFile=modal.querySelector(`.qg-image-file[data-i="${i}"][data-j="${j}"]`)?.files?.[0];
          if(imageFile)q.choices[j].imageUrl=await upload('image',imageFile);
        }
        if(!q.prompt)throw new Error(`Câu ${i+1} chưa có nội dung câu hỏi.`);
        if(!q.audioUrl)throw new Error(`Câu ${i+1} chưa có mảnh audio.`);
        if(q.choices.some(c=>!c.text))throw new Error(`Câu ${i+1} cần đủ nội dung A, B và C.`);
        if(q.maxScore<0)throw new Error(`Điểm câu ${i+1} không hợp lệ.`);
      }
      const now=new Date().toISOString(),questionIds=questions.map(q=>q.id);
      const groupItem={...group,questionIds,updatedAt:now};
      const ops=[{collection:'questionGroups',id:group.id,kind:'upsert',item:groupItem}];
      questions.forEach((q,i)=>ops.push({collection:'questions',id:q.id,kind:'upsert',item:{...q,code:`A1-LIS-01-${String(i+1).padStart(3,'0')}`,level:'A1',skill:'Nghe',part:'Phần 1',partOrder:1,type:'single',title:`A1 Nghe 1 · Câu ${i+1}`,instruction:'',autoGrade:true,pairs:[],rubric:[],groupId:group.id,groupType:TYPE,groupOrder:i+1,groupInstruction:group.instruction,groupAudioPolicy:{...POLICY},ownerId:q.ownerId||group.ownerId,ownerName:q.ownerName||group.ownerName,status:q.status==='trash'?'active':(q.status||'active'),locked:Boolean(q.locked),usedCount:Number(q.usedCount||0),correctRate:q.correctRate??null,createdAt:q.createdAt||now,updatedAt:now}}));
      const kept=new Set(questionIds);
      for(const old of originalQuestions)if(!kept.has(old.id))ops.push({collection:'questions',id:old.id,kind:'upsert',item:{...old,status:'trash',deletedAt:now,updatedAt:now}});
      if(commit)await commit(ops);else await request('/commit',{method:'POST',body:{operations:ops}});
      modal.remove();
      if(onSaved)await onSaved(groupItem);
      else location.reload();
    }catch(error){alert(error.message);}finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Lưu cụm';}}
  }
  render();
}

async function softDeleteGroup(groupId){
  if(!confirm('Đưa toàn bộ cụm và các câu bên trong vào Thùng rác?'))return;
  try{
    const state=await request('/state'),group=(state.questionGroups||[]).find(g=>g.id===groupId);
    if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
    const qs=(state.questions||[]).filter(q=>(group.questionIds||[]).includes(q.id));
    if((group.locked||qs.some(q=>q.locked)))throw new Error('Cụm đã dùng trong đề nên đang khóa.');
    const now=new Date().toISOString(),ops=[{collection:'questionGroups',id:group.id,kind:'upsert',item:{...group,status:'trash',deletedAt:now,updatedAt:now}}];
    qs.forEach(q=>ops.push({collection:'questions',id:q.id,kind:'upsert',item:{...q,status:'trash',deletedAt:now,updatedAt:now}}));
    await request('/commit',{method:'POST',body:{operations:ops}});location.reload();
  }catch(error){alert(error.message);}
}

function choiceText(choice){return choice&&typeof choice==='object'?String(choice.text||''):String(choice||'');}
function choiceImage(choice){return choice&&typeof choice==='object'?String(choice.imageUrl||''):'';}

async function enhanceExam(){
  const examRoot=document.querySelector('.thi');
  if(!examRoot||examRoot.dataset.qgEnhanced==='1')return;
  examRoot.dataset.qgEnhanced='1';
  let state;try{state=await request('/state');}catch{return;}
  const visibleIds=[...examRoot.querySelectorAll('.cau-thi[data-q]')].map(x=>x.dataset.q);
  const qs=(state.questions||[]).filter(q=>visibleIds.includes(q.id)&&q.groupType===TYPE&&q.groupId);
  const groupIds=[...new Set(qs.map(q=>q.groupId))];
  for(const groupId of groupIds){
    const groupQuestions=qs.filter(q=>q.groupId===groupId).sort((a,b)=>(a.groupOrder||0)-(b.groupOrder||0));
    if(!groupQuestions.length)continue;
    const group=(state.questionGroups||[]).find(g=>g.id===groupId)||{instruction:groupQuestions[0].groupInstruction,audioPolicy:groupQuestions[0].groupAudioPolicy};
    const firstNode=examRoot.querySelector(`.cau-thi[data-q="${CSS.escape(groupQuestions[0].id)}"]`);if(!firstNode)continue;
    const attempt=(state.attempts||[]).find(a=>a.status==='in_progress'&&(a.currentQuestionIds||[]).includes(groupQuestions[0].id));if(!attempt)continue;
    const intro=document.createElement('div');intro.className='qg-listen-intro';
    const started=attempt.audioSessions?.[groupId]?.startedAt;
    intro.innerHTML=`<h3>Đề bài</h3><div>${esc(group.instruction||groupQuestions[0].groupInstruction||'')}</div><div style="margin-top:12px"><button class="nut chinh qg-start-listen" ${started?'disabled':''}>${started?'Audio đã được sử dụng':'Bắt đầu nghe'}</button><div class="qg-listen-status">${started?'Phiên nghe này đã được bắt đầu trước đó và không thể phát lại.':'Khi bắt đầu, audio sẽ chạy liên tục đến hết. Mỗi mảnh phát 2 lần.'}</div></div>`;
    firstNode.insertAdjacentElement('beforebegin',intro);
    const audioElements=[];
    for(const q of groupQuestions){
      const node=examRoot.querySelector(`.cau-thi[data-q="${CSS.escape(q.id)}"]`);if(!node)continue;
      const wrap=node.querySelector('.audio-thi');if(wrap){wrap.style.display='none';const audio=wrap.querySelector('audio');if(audio){audio.controls=false;audioElements.push({q,audio});}}
      const select=node.querySelector('.answer-one');
      if(select&&Array.isArray(q.choices)&&q.choices.some(c=>typeof c==='object')){
        const list=document.createElement('div');list.className='qg-choice-list';
        q.choices.slice(0,3).forEach((choice,index)=>{const label=document.createElement('label');label.className='qg-answer';const image=choiceImage(choice);label.innerHTML=`<div><input type="radio" name="qg-${esc(q.id)}" value="${index}" ${String(attempt.answers?.[q.id])===String(index)?'checked':''}><b>${String.fromCharCode(65+index)}.</b> ${esc(choiceText(choice))}</div>${image?`<img src="${esc(image)}" alt="Đáp án ${String.fromCharCode(65+index)}">`:''}`;label.querySelector('input').onchange=async()=>{try{await request('/actions/saveAnswers',{method:'POST',body:{attemptId:attempt.id,answers:{[q.id]:index}}});document.getElementById('saveState').textContent='Đã lưu';}catch(error){alert(error.message);}};list.appendChild(label);});
        select.replaceWith(list);
      }
    }
    const startButton=intro.querySelector('.qg-start-listen'),status=intro.querySelector('.qg-listen-status');
    if(startButton&&!started)startButton.onclick=async()=>{
      startButton.disabled=true;
      try{
        await request('/actions/startAudioGroup',{method:'POST',body:{attemptId:attempt.id,groupId}});
        const repeat=Math.max(1,Number(group.audioPolicy?.segmentRepeat||2));
        for(let i=0;i<audioElements.length;i++)for(let r=0;r<repeat;r++){
          status.textContent=`Đang nghe mảnh ${i+1}/${audioElements.length} · lượt ${r+1}/${repeat}`;
          await playLocked(audioElements[i].audio);
        }
        await request('/actions/completeAudioGroup',{method:'POST',body:{attemptId:attempt.id,groupId}});
        status.textContent='Đã nghe hết audio. Phiên nghe đã khóa.';startButton.textContent='Đã hoàn thành audio';
      }catch(error){status.textContent=`Audio đã khóa. ${error.message}`;startButton.textContent='Không thể phát lại';}
    };
  }
}

function playLocked(audio){
  return new Promise((resolve,reject)=>{
    let active=true;
    const cleanup=()=>{active=false;audio.onended=null;audio.onerror=null;audio.onpause=null;audio.onseeking=null;};
    audio.controls=false;audio.currentTime=0;
    audio.onseeking=()=>{if(active&&audio.currentTime<0)audio.currentTime=0;};
    audio.onpause=()=>{if(active&&!audio.ended)setTimeout(()=>audio.play().catch(()=>{}),0);};
    audio.onended=()=>{cleanup();resolve();};
    audio.onerror=()=>{cleanup();reject(new Error('Không phát được một mảnh audio.'));};
    audio.play().catch(error=>{cleanup();reject(error);});
  });
}

let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(async()=>{scheduled=false;injectStyles();await mountBankPanel();await enhanceExam();});}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
schedule();
