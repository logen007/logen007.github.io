import {speakingExamRequest as request} from './exam-route.js';
import {speakingExamErrors,validateSpeakingReview,speakingMaxScore,SPEAKING_MAX_STAGES} from './exam-model.js';
import {speakingEditorHtml,speakingQueueHtml,speakingSessionHtml,preparationHtml,stageHtml,terminalHtml,speakingReviewsHtml,speakingGradingHtml,speakingResultsHtml,speakingStateLabel,sxButton} from './exam-views.js';
import {createSpeakingAutosave} from './exam-autosave.js';
import {createSpeakingExamCall} from './exam-call.js';
import {acquirePreview,mediaAvailable,mediaErrorText,stopMedia} from './devices.js';
import {isPhone,clockText} from './model.js';
import {drawQr} from './qr.js';
import {uploadQuestionImage} from '../media.js';
import {confirmAction} from '../ui/confirm.js';
import {esc} from '../ui/format.js';
import {bindDialogKeyboard} from '../ui/dialog-keyboard.js';

const activeStates=new Set(['preparing','joining','starting','running','paused']);
const callStates=new Set(['joining','starting','running','paused']);
const doneStates=new Set(['finishing','processing','completed','cancelled','interrupted']);
const clone=value=>JSON.parse(JSON.stringify(value));
const milliseconds=value=>typeof value==='number'?value:Date.parse(value)||0;
const uid=()=>globalThis.crypto?.randomUUID?.()||'sx-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const ask=(message,options={})=>new Promise(resolve=>confirmAction(message,()=>resolve(true),{...options,onCancel:()=>resolve(false)}));

export function createSpeakingExamsController({root,context,layout,navigate,notify=()=>{},onChanged=()=>{},afterRender=()=>{},services={}}){
 let route=null,key='',generation=0,abort=null,live=false,exam=null,session=null,queue=null,items=[],nextOffset=null,save=null,reviewSave=null;
 let selectedPart='',closeEditorDialog=null;
 let selectedStudent='',reviewDraft=null,stream=null,deviceEpoch=0,devicesBusy=false,checked=false,call=null,clock=null,poll=null,refreshing=null;
 let offset=0,prepKey='',stageKey='',terminalKey='',matchShown=false,operation=false,uploadBusy=false,leaving=null,connectedPending=false,connectedFlight=null;
 const getUser=()=>context()?.user;
 const phone=()=>services.isPhone?.()??isPhone(globalThis.navigator?.userAgent||'');
 const find=selector=>root.querySelector(selector);
 const setText=(selector,text)=>{const node=find(selector);if(node&&node.textContent!==text)node.textContent=text;};
 const show=(selector,visible)=>{const node=find(selector);if(node)node.hidden=!visible;};
 const error=problem=>{const node=find('[data-sx-error]');if(node){node.textContent=problem?.message||String(problem||'');node.hidden=!problem;}};
 const paint=html=>{root.innerHTML=layout(html);afterRender();};
 const report=problem=>{if(problem?.name!=='AbortError')error(problem);};
 const api=(path,options={})=>(services.request||request)(path,{...options,signal:abort?.signal});
 const stopPreview=()=>{deviceEpoch++;stopMedia(stream);stream=null;checked=false;const video=find('[data-sx-preview]');if(video)video.srcObject=null;};
 const clearRuntime=()=>{closeEditorDialog?.();closeEditorDialog=null;window.removeEventListener('resize',fitTitle);clearTimeout(poll);clearInterval(clock);poll=null;clock=null;abort?.abort();abort=null;stopPreview();devicesBusy=false;operation=false;void call?.dispose();call=null;save?.dispose();reviewSave?.dispose();save=null;reviewSave=null;refreshing=null;connectedPending=false;connectedFlight=null;};
 const status=(state,problem)=>{
  setText('[data-sx-save]',({changed:'Đang chờ lưu…',saving:'Đang lưu…',saved:'Đã lưu',error:'Chưa lưu được'})[state]||'');
  if(route?.page==='edit')show('[data-sx-save]',state!=='saved');
  show('[data-sx-action="retry-save"]',state==='error'&&route?.page==='edit');
  show('[data-sx-action="retry-review"]',state==='error'&&route?.page==='grade');
  if(state==='error'&&problem?.status===409&&!find('[data-sx-conflict]'))find('[data-sx-error]')?.insertAdjacentHTML('afterend',sxButton('Tải lại bản mới','reload',{attrs:'data-sx-conflict'}));
  if(state==='saved')find('[data-sx-conflict]')?.remove();
  if(problem)error(problem);
 };
 const beginClock=()=>{clearInterval(clock);clock=setInterval(tick,1000);tick();};
 const schedule=()=>{
  clearTimeout(poll);
  if(!live||!['queue','session'].includes(route?.page)||route.page==='session'&&['cancelled','interrupted'].includes(session?.state))return;
  const delay=route.page==='session'&&session?.state==='completed'?15000:3000;
  poll=setTimeout(()=>void refresh().catch(report),delay);
 };
 function fitTitle(){const title=find('.exam-title-input');if(title){title.style.height='auto';title.style.height=title.scrollHeight+'px';}}
 const renderEditor=()=>{if(!exam.speaking.stages.some(part=>part.id===selectedPart))selectedPart=exam.speaking.stages[0]?.id||'';paint(speakingEditorHtml(exam,selectedPart));fitTitle();if(save)status(save.dirty()?'changed':'saved');window.addEventListener('resize',fitTitle);};
 function editorDialog(preview=false){
  closeEditorDialog?.();
  const modal=document.createElement('div');modal.className='hop-chon';
  modal.innerHTML=`<section class="noi-hop sx-editor-dialog" role="dialog" aria-modal="true" aria-label="${preview?'Xem trước đề nói':'Cài đặt đề'}"><div class="tieu-de-trang"><h2>${preview?'Xem trước':'Cài đặt đề'}</h2><button class="icon-btn" data-dismiss aria-label="Đóng">×</button></div>${preview?`<div class="nhom-nut" role="group" aria-label="Thí sinh">${['A','B'].map(seat=>`<button class="nut ${seat==='A'?'chinh':''}" data-preview-seat="${seat}" aria-pressed="${seat==='A'}">Thí sinh ${seat}</button>`).join('')}</div><div class="sx-shell" data-editor-preview></div>`:`<div class="sx-field"><label for="sx-provider">Loại đề</label><select id="sx-provider" class="truong">${[['','G2G'],['GOETHE','Goethe'],['TELC','TELC'],['FID','FID']].map(([value,label])=>`<option value="${value}" ${value===(exam.provider||'')?'selected':''}>${label}</option>`).join('')}</select></div><div class="sx-field"><label for="sx-level">Trình độ</label><select id="sx-level" class="truong">${['A1','A2','B1','B2','C1','C2'].map(level=>`<option ${level===exam.level?'selected':''}>${level}</option>`).join('')}</select></div>`}</section>`;
  document.body.append(modal);closeEditorDialog=bindDialogKeyboard(modal,{onDismiss:()=>{closeEditorDialog=null;}});
  if(preview){
   const showSeat=seat=>{modal.querySelector('[data-editor-preview]').innerHTML=preparationHtml(exam.speaking.stages.map(stage=>({title:stage.title,instruction:stage.instruction,prompt:stage['prompt'+seat],image:stage['image'+seat+'Url']})));for(const button of modal.querySelectorAll('[data-preview-seat]')){const active=button.dataset.previewSeat===seat;button.classList.toggle('chinh',active);button.setAttribute('aria-pressed',String(active));}};
   modal.addEventListener('click',event=>{const button=event.target.closest('[data-preview-seat]');if(button)showSeat(button.dataset.previewSeat);});showSeat('A');
  }else modal.addEventListener('change',event=>{if(exam.status==='published')return;if(event.target.id==='sx-provider')exam.provider=event.target.value||null;else if(event.target.id==='sx-level')exam.level=event.target.value;else return;save.changed();renderEditor();});
  modal.querySelector('button')?.focus();
 }
 function editorSave(){
  save=createSpeakingAutosave({version:exam.version,read:()=>exam,write:async(value,version)=>(await api('/'+encodeURIComponent(exam.id),{method:'PUT',body:{version,exam:value}})).exam,
   accept:updated=>{exam.version=updated.version;exam.updatedAt=updated.updatedAt;},status});
 }
 function readReview(){
  const scores=Object.create(null);for(const input of root.querySelectorAll('[data-sx-score]'))if(input.value!=='')scores[input.dataset.sxScore]=Number(input.value);
  return {scores,feedback:find('[data-sx-feedback]')?.value||''};
 }
 function gradeSave(){
  reviewSave?.dispose();const id=selectedStudent,existing=session.reviews?.[id]||{version:0};reviewDraft={scores:clone(existing.scores||{}),feedback:existing.feedback||''};
  reviewSave=createSpeakingAutosave({version:existing.version,read:()=>reviewDraft,write:async(review,version)=>(await api('/sessions/'+encodeURIComponent(session.id)+'/review/'+encodeURIComponent(id),{method:'PUT',body:{version,review}})).review,
   accept:review=>{session.reviews??={};session.reviews[id]=review;},status});
 }
 function renderGrade(){
  const video=find('[data-sx-recording]');paint(speakingGradingHtml(session,selectedStudent));
  const replacement=find('[data-sx-recording]');if(video&&replacement)replacement.replaceWith(video);
  if(!session.hasRecording)find('.tieu-de-trang').insertAdjacentHTML('beforeend',sxButton('Tải lại video','reload'));
 }
 async function load(){
  const current=generation;paint('<main class="khung sx-shell"><p role="status">Đang mở đề nói…</p></main>');
  try{
   if(route.page==='edit'){
    const result=await api('/'+encodeURIComponent(route.examId));if(current!==generation)return;exam=result.exam;
    renderEditor();editorSave();
   }else if(route.page==='queue'){
    paint(speakingQueueHtml({phone:phone()}));if(!phone()){void qr();return;}
    await refresh();beginClock();
   }else if(route.page==='session'){
    paint(speakingSessionHtml(phone()));if(!phone()){void qr();return;}
    find('[data-sx-call-status]').insertAdjacentHTML('afterend',sxButton('Bật tiếng cuộc gọi','unblock-audio',{attrs:'hidden'}));
    call=(services.createCall||createSpeakingExamCall)({root,getSession:()=>session,getUser,credentials:()=>api('/sessions/'+encodeURIComponent(route.id)+'/join',{method:'POST',body:{}}),
     onConnected:async()=>{connectedPending=true;await confirmConnected();},onChange:()=>{if(live)updateSession();},onError:report});
    await refresh();beginClock();
   }else if(route.page==='reviews'){
    const result=await api('/reviews');if(current!==generation)return;items=result.sessions||[];nextOffset=result.nextOffset??null;paint(speakingReviewsHtml(items,nextOffset));
   }else if(route.page==='grade'){
    const result=await api('/sessions/'+encodeURIComponent(route.id)+'/grading');if(current!==generation)return;session=result;
    selectedStudent=session.members?.[0]?.id||'';renderGrade();gradeSave();
   }else if(route.page==='results'){
    const result=await api('/results');if(current!==generation)return;items=result.results||[];nextOffset=result.nextOffset??null;paint(speakingResultsHtml(items,nextOffset));
   }
  }catch(problem){if(current!==generation)return;paint(`<main class="khung sx-shell"><p data-sx-error role="alert">${esc(problem.message)}</p>${sxButton('Thử lại','reload')}${sxButton('Trở về','home')}</main>`);}
 }
 async function qr(){try{await (services.drawQr||drawQr)(find('[data-sx-qr]'),globalThis.location.href);}catch(problem){report(problem);}}
 function acceptSession(value){
  if(!value||!live)return;if(session?.id===value.id&&Number(value.revision)<Number(session.revision))return;
  session=value;offset=milliseconds(value.serverNow)-Date.now();updateSession();tick();
 }
 async function refresh(){
  if(refreshing)return refreshing;
  if(root.ownerDocument.hidden){schedule();return;}
  const current=generation;
  refreshing=(async()=>{
   if(route.page==='queue'){
    const result=await api('/queue');if(current!==generation)return;
    if(result.session){queue=null;navigate({page:'session',id:result.session.id});return;}
    queue=result.queue||null;offset=queue?.serverNow?milliseconds(queue.serverNow)-Date.now():0;updateQueue();
   }else if(route.page==='session'){
    const result=await api('/sessions/'+encodeURIComponent(route.id));if(current!==generation)return;acceptSession(result);await confirmConnected();
   }
  })().finally(()=>{if(current===generation){refreshing=null;schedule();}});
  return refreshing;
 }
 async function confirmConnected(){
  if(!connectedPending||connectedFlight||!call?.isJoined()||!callStates.has(session?.state))return;
  const current=generation;
  connectedFlight=(async()=>{
   try{const value=await api('/sessions/'+encodeURIComponent(session.id)+'/connected',{method:'POST',body:{consent:true}});if(current!==generation)return;connectedPending=false;acceptSession(value);}
   catch(problem){if(current===generation&&problem.status!==409)report(problem);}
   finally{if(current===generation)connectedFlight=null;}
  })();
  return connectedFlight;
 }
 function updateQueue(){
  if(route?.page!=='queue')return;
  show('[data-sx-queue-idle]',!queue);show('[data-sx-queue-wait]',Boolean(queue));
  const button=find('[data-sx-action="queue-start"]');if(button)button.disabled=!checked||!mediaAvailable(stream)||operation;
  if(queue?.examId&&queue.examId!==route.examId)error('Bạn đang tìm bạn thi cho một đề khác. Dừng tìm trước khi đổi đề.');
  tick();
 }
 async function cancelQueue(){
  const result=await api('/queue/cancel',{method:'POST',body:{}});
  if(result.session)await api('/sessions/'+encodeURIComponent(result.session.id)+'/leave',{method:'POST',body:{}});
  queue=null;updateQueue();
 }
 function updateSession(){
  if(route?.page!=='session'||!session||!phone())return;
  setText('[data-sx-title]',session.title||'Đề nói');setText('[data-sx-state]',speakingStateLabel(session.state));
  if(session.state==='preparing'&&!matchShown){matchShown=true;setText('[data-sx-partner]',session.members?.find(member=>member.id!==getUser()?.id)?.name||'Bạn thi đã sẵn sàng');show('[data-sx-match]',true);}
  if(session.state!=='preparing')show('[data-sx-match]',false);
  show('[data-sx-preparing]',session.state==='preparing');
  if(session.state==='preparing'){
   const next=JSON.stringify(session.preparation);if(next!==prepKey){prepKey=next;find('[data-sx-prep-prompts]').innerHTML=preparationHtml(session.preparation);}
   setText('[data-sx-readiness]',session.members.map(member=>member.name+': '+(member.ready?'Sẵn sàng':'Đang chuẩn bị')).join(' · '));
   const button=find('[data-sx-action="ready"]'),ready=Boolean(session.ready?.[getUser()?.id]);button.disabled=ready||operation;button.querySelector('span').textContent=ready?'Đã sẵn sàng':'Tôi đã sẵn sàng';
  }
  const inCall=callStates.has(session.state)&&(call?.isJoined()||call?.isJoining());
  show('[data-sx-join]',callStates.has(session.state)&&!inCall);show('[data-sx-call]',Boolean(inCall));
  const join=find('[data-sx-action="join"]');if(join)join.disabled=!session.canJoin||!checked||!mediaAvailable(stream)||operation;
  if(inCall){
   call.render();
   show('[data-sx-action="unblock-audio"]',Boolean(call.isAudioBlocked?.()));
   const key=JSON.stringify([session.state,session.stage]);if(stageKey!==key){stageKey=key;find('[data-sx-stage]').innerHTML=stageHtml(session.stage);}
   const paused=session.state==='paused';
   setText('[data-sx-call-status]',paused?'Đang chờ đủ hình và tiếng. Đồng hồ phần thi đã tạm dừng.':session.state==='joining'?'Đang chờ bạn cùng thi và xác nhận hình, tiếng.':session.state==='starting'?'Đang bật ghi hình. Phần thi chưa bắt đầu.':session.partnerFinished?'Bạn cùng thi đã hoàn thành lượt nói.':'');
   show('[data-sx-stage-actions]',session.state==='running');
   const next=find('[data-sx-action="next"]');next.disabled=Boolean(session.finished)||operation;next.querySelector('span').textContent=session.finished?'Đang chờ chuyển phần':session.stage?.isSpeaker===false?'Sẵn sàng chuyển phần':'Tôi đã nói xong';
  }
  const terminal=doneStates.has(session.state);show('[data-sx-terminal]',terminal);show('.sx-session-controls',activeStates.has(session.state));
  if(terminal){
   stopPreview();if(call?.isJoined()||call?.isJoining())void call.leave();
   const key=JSON.stringify([session.state,session.result,session.archiveState,session.driveArchive]);if(key!==terminalKey){terminalKey=key;find('[data-sx-terminal]').innerHTML=terminalHtml(session);}
  }
  if(session.error)error(session.error);
 }
 function tick(){
  const now=Date.now()+offset;
  if(route?.page==='queue'&&queue){const elapsed=Math.max(0,Math.floor((now-milliseconds(queue.joinedAt||queue.createdAt||now))/1000));setText('[data-sx-queue-clock]',clockText(elapsed));setText('[data-sx-queue-policy]',elapsed<60?'Đang ưu tiên người cùng lớp.':'Đang tìm thêm người cùng đề và trình độ ngoài lớp.');}
  if(route?.page==='session'&&session){
   const deadline=session.state==='preparing'?session.prepDeadline:session.state==='running'?session.deadline:session.state==='paused'?session.recoveryDeadline:null;
   const seconds=deadline?Math.max(0,Math.ceil((milliseconds(deadline)-now)/1000)):session.state==='paused'?session.remaining:null;
   setText('[data-sx-clock]',seconds==null?'':(session.state==='paused'?'Kết nối lại · ':'')+clockText(seconds));
  }
 }
 async function devices(){
  if(devicesBusy||!phone())return;devicesBusy=true;const current=++deviceEpoch;stopMedia(stream);stream=null;checked=false;
  setText('[data-sx-device-status]','Đang mở camera và micro…');
  try{
   const acquired=await (services.acquirePreview||acquirePreview)(find('[data-sx-preview]'));
   if(!live||current!==deviceEpoch){stopMedia(acquired);return;}
   stream=acquired;checked=mediaAvailable(stream);setText('[data-sx-device-status]','Đã nhận hình và tiếng.');
   for(const track of stream.getTracks())track.addEventListener?.('ended',()=>{checked=false;setText('[data-sx-device-status]','Thiết bị đã ngắt. Hãy kiểm tra lại.');updateQueue();updateSession();},{once:true});
  }catch(problem){if(current===deviceEpoch)setText('[data-sx-device-status]',mediaErrorText(problem));}
  finally{if(current===deviceEpoch){devicesBusy=false;updateQueue();updateSession();}}
 }
 function changeField(input){
  if(route?.page!=='edit'||exam.status==='published')return;
  const path=input.dataset.sxField.split('.'),value=input.type==='number'?(input.value===''?null:Number(input.value)):input.value;
  if(path.length===1&&['title','level'].includes(path[0]))exam[path[0]]=value;
  else if(path[0]==='stages'){
   const stage=exam.speaking.stages[Number(path[1])];if(!stage)return;
   if(path.length===3&&['title','instruction','promptA','promptB','seconds','speakerSeat'].includes(path[2]))stage[path[2]]=value;
   else if(path.length===5&&path[2]==='criteria'&&['label','maxScore'].includes(path[4])){const criterion=stage.criteria[Number(path[3])];if(criterion)criterion[path[4]]=value;else return;}
   else return;
  }else return;
  error(null);save.changed();if(path[0]==='title')fitTitle();
  if(path[0]==='stages'){const stage=exam.speaking.stages[Number(path[1])],button=[...root.querySelectorAll('[data-sx-action="part-select"]')].find(node=>node.dataset.id===stage.id);if(button){button.querySelector('span').textContent=stage.title||'Bài '+(Number(path[1])+1);button.title=stage.title||'Bài '+(Number(path[1])+1);button.querySelector('small').textContent=stage.criteria.reduce((sum,item)=>sum+(Number(item.maxScore)||0),0)+' điểm';}setText('.goethe-skill>div>span',speakingMaxScore(exam.speaking)+' điểm');}
 }
 function changeReview(){
  if(!session.hasRecording||session.reviews?.[selectedStudent]?.publishedAt)return;
  reviewDraft=readReview();
  reviewSave.changed();
  try{const checked=validateSpeakingReview(session.examSnapshot.speaking,reviewDraft);setText('[data-sx-grade-total]',checked.total+' / '+checked.maxScore+' điểm');error(null);}
  catch(problem){error(problem);}
 }
 async function upload(input){
  const file=input.files?.[0],stage=exam?.speaking.stages[Number(input.dataset.sxUpload)],seat=input.dataset.seat;if(!file||!stage||exam.status==='published'||uploadBusy)return;
  uploadBusy=true;const current=generation;input.disabled=true;
  try{const url=await (services.uploadImage||uploadQuestionImage)(file);if(current!==generation)return;stage['image'+seat+'Url']=url;save.changed();renderEditor();}
  catch(problem){report(problem);}finally{uploadBusy=false;input.disabled=false;input.value='';}
 }
 async function editorAction(action,button){
  if(action==='part-select'){selectedPart=button.dataset.id;renderEditor();return;}
  if(action==='preview'){editorDialog(true);return;}
  if(action==='settings'){if(exam.status!=='published')editorDialog();return;}
  if(action==='retry-save'){await save.flush();return;}
  if(uploadBusy)throw Error('Chờ tải ảnh xong trước khi tiếp tục.');
  if(action==='publish'||action==='unpublish'){
   if(action==='publish'){await save.flush();const errors=speakingExamErrors(exam);if(errors.length)throw Error(errors.join('\n'));}
   const result=await api('/'+encodeURIComponent(exam.id)+'/'+action,{method:'POST',body:{version:exam.version}});save.dispose();exam=result.exam;renderEditor();editorSave();await onChanged({exam});return;
  }
  if(exam.status==='published')return;
  const stages=exam.speaking.stages,index=Number(button.dataset.index),stage=stages[index];
  if(action==='part-add'){
   if(stages.length>=SPEAKING_MAX_STAGES)throw Error('Đề nói có tối đa 20 phần.');
   stages.push({id:uid(),title:'',instruction:'',promptA:'',promptB:'',imageAUrl:'',imageBUrl:'',seconds:null,speakerSeat:'both',criteria:[{id:uid(),label:'',maxScore:null}]});selectedPart=stages.at(-1).id;
  }else if(action==='part-remove'&&stage){if(!await ask('Bỏ phần thi này khỏi đề?',{confirmLabel:'Bỏ phần thi',danger:true}))return;stages.splice(index,1);}
  else if(action==='part-up'&&index>0)[stages[index-1],stages[index]]=[stages[index],stages[index-1]];
  else if(action==='part-down'&&index<stages.length-1)[stages[index+1],stages[index]]=[stages[index],stages[index+1]];
  else if(action==='criterion-add'&&stage)stage.criteria.push({id:uid(),label:'',maxScore:null});
  else if(action==='criterion-remove'&&stage)stage.criteria.splice(Number(button.dataset.criterion),1);
  else if(action==='remove-image'&&stage&&['A','B'].includes(button.dataset.seat))stage['image'+button.dataset.seat+'Url']='';
  else return;
  save.changed();renderEditor();
 }
 async function action(button){
  const name=button.dataset.sxAction;if(!name||button.disabled||operation)return;error(null);
  if(name==='devices'){await devices();return;}
  const current=generation;operation=true;button.disabled=true;
  try{
   if(name==='home'){await go({page:getUser()?.role==='student'?'catalog':'manage'});return;}
   if(name==='reload'){if(save?.dirty()||reviewSave?.dirty()){if(!await ask('Tải lại sẽ bỏ phần chưa lưu. Tiếp tục?',{confirmLabel:'Tải lại'}))return;}await mount(route,true);return;}
   if(route.page==='edit'){await editorAction(name,button);return;}
   if(name==='queue-start'){
    if(!checked||!mediaAvailable(stream))throw Error('Hãy kiểm tra camera và micro trước.');
    const result=await api('/'+encodeURIComponent(route.examId)+'/queue',{method:'POST',body:{}});
    if(result.session){queue=null;navigate({page:'session',id:result.session.id});}else{queue=result.queue;offset=queue?.serverNow?milliseconds(queue.serverNow)-Date.now():0;updateQueue();schedule();}
   }else if(name==='queue-cancel')await cancelQueue();
   else if(name==='ready')acceptSession(await api('/sessions/'+encodeURIComponent(session.id)+'/ready',{method:'POST',body:{revision:session.revision}}));
   else if(name==='join'){
    if(!session.canJoin||!checked||!mediaAvailable(stream))throw Error('Hãy kiểm tra lại camera và micro.');
    stopPreview();void call.join().catch(report);
   }else if(name==='next')acceptSession(await api('/sessions/'+encodeURIComponent(session.id)+'/next',{method:'POST',body:{stageIndex:session.stageIndex}}));
   else if(name==='unblock-audio')await call?.unblockAudio?.();
   else if(name==='leave'){if(await ask('Dừng lượt thi này?',{confirmLabel:'Dừng lượt thi',danger:true}))acceptSession(await api('/sessions/'+encodeURIComponent(session.id)+'/leave',{method:'POST',body:{}}));}
   else if(name==='new-attempt')await go({page:'queue',examId:session.examId});
   else if(name==='grade')await go({page:'grade',id:button.dataset.id});
   else if(name==='reviews')await go({page:'reviews'});
   else if(name==='more'&&nextOffset!==null){
    const result=await api('/'+route.page+'?offset='+encodeURIComponent(nextOffset));
    const page=result[route.page==='reviews'?'sessions':'results']||[],known=new Set(items.map(item=>item.id||item.sessionId));items.push(...page.filter(item=>!known.has(item.id||item.sessionId)));nextOffset=result.nextOffset??null;
    paint(route.page==='reviews'?speakingReviewsHtml(items,nextOffset):speakingResultsHtml(items,nextOffset));
   }
   else if(name==='seek'){const video=find('[data-sx-recording]');if(video)video.currentTime=Number(button.dataset.at)||0;}
   else if(name==='candidate'){
    await reviewSave.flush();selectedStudent=button.dataset.student;renderGrade();gradeSave();
   }else if(name==='retry-review')await reviewSave.flush();
   else if(name==='publish-review'){
    if(!session.hasRecording)throw Error('Chờ video được lưu an toàn trước khi chấm.');
    validateSpeakingReview(session.examSnapshot.speaking,reviewDraft,{complete:true});await reviewSave.flush();
    const saved=session.reviews?.[selectedStudent]||{};
    const result=await api('/sessions/'+encodeURIComponent(session.id)+'/review/'+encodeURIComponent(selectedStudent)+'/publish',{method:'POST',body:{version:saved.version||0}});
    session.reviews[selectedStudent]=result.review;renderGrade();gradeSave();await onChanged({session});notify('Đã công bố kết quả cho thí sinh.');
   }
  }catch(problem){if(current===generation)report(problem);}
  finally{if(current===generation){operation=false;if(button.isConnected)button.disabled=false;updateQueue();updateSession();}}
 }
 const click=event=>{const button=event.target.closest?.('[data-sx-action]');if(button&&root.contains(button)){event.preventDefault();void action(button);}};
 const input=event=>{const target=event.target;if(target.matches('[data-sx-field]'))changeField(target);else if(target.matches('[data-sx-score],[data-sx-feedback]'))changeReview();};
 const change=event=>{if(event.target.matches('[data-sx-upload]'))void upload(event.target);};
 const visibility=()=>{if(live&&!root.ownerDocument.hidden)void refresh().catch(report);};
 const unload=event=>{if(live&&(operation||uploadBusy||save?.dirty()||reviewSave?.dirty()||queue||route?.page==='session'&&activeStates.has(session?.state))){event.preventDefault();event.returnValue='';}};
 function attach(){if(live)return;live=true;root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);root.ownerDocument.addEventListener('visibilitychange',visibility);globalThis.window?.addEventListener('beforeunload',unload);}
 async function mount(next,force=false){
  const nextKey=JSON.stringify([getUser()?.id,next]);attach();
  if(key===nextKey&&!force){if(route.page==='session')updateSession();return;}
  generation++;clearRuntime();route={...next};key=nextKey;abort=new AbortController();exam=null;session=null;queue=null;items=[];nextOffset=null;selectedStudent='';reviewDraft=null;offset=0;prepKey='';stageKey='';terminalKey='';matchShown=false;
  await load();
 }
 async function beforeLeave(fromAction=false){
  if(!live)return true;if(leaving)return leaving;
  if(operation&&!fromAction){notify('Chờ thao tác hiện tại hoàn tất trước khi rời trang.');return false;}
  leaving=(async()=>{
   if(uploadBusy){notify('Chờ ảnh tải xong trước khi rời trang.');return false;}
   try{await save?.flush();await reviewSave?.flush();}catch(problem){error(problem);if(!await ask('Có nội dung chưa lưu được. Rời trang và bỏ phần chưa lưu?',{confirmLabel:'Rời trang',danger:true}))return false;}
   if(queue){if(!await ask('Dừng tìm bạn thi để rời trang?',{confirmLabel:'Dừng tìm'}))return false;await cancelQueue();}
   if(route?.page==='session'&&activeStates.has(session?.state)){if(!await ask('Rời trang sẽ dừng lượt thi đang diễn ra.',{confirmLabel:'Dừng và rời trang',danger:true}))return false;acceptSession(await api('/sessions/'+encodeURIComponent(session.id)+'/leave',{method:'POST',body:{}}));}
   return true;
  })().catch(problem=>{report(problem);return false;}).finally(()=>{leaving=null;});return leaving;
 }
 async function go(next){if(await beforeLeave(true)){navigate(next);return true;}return false;}
 async function open(next){if(await beforeLeave()){navigate(next);return true;}return false;}
 function dispose(){generation++;clearRuntime();live=false;key='';route=null;root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);root.ownerDocument.removeEventListener('visibilitychange',visibility);globalThis.window?.removeEventListener('beforeunload',unload);}
 return {mount,open,beforeLeave,dispose};
}
