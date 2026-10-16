import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {speakingApi} from './api.js';
import {isPhone,clockText} from './model.js';
import {loadPublicSettings} from '../settings/api.js';
import {initializeTheme,acceptPublicSettings} from '../settings/theme.js';
import {drawQr} from './qr.js';
import {acquirePreview,mediaAvailable,mediaErrorText,recordSample} from './devices.js';
import {speakingRoomHtml,privatePromptHtml,readinessHtml,finishedCopy,finishedIconHtml} from './phone-view.js';

const root=document.getElementById('speaking-app'),id=new URL(location.href).searchParams.get('session');
let state,user,stream,actions,store,sdk,joined=false,entered=false,joining=false,checked=false,timer,clock,serverOffset=0,recordingUrl,recorder,sampleClock,unsubscribers=[],lastPeers=[],votedStage=null,stageKey,memberKey;
const tiles=new Map(),el=s=>root.querySelector(s),path=s=>'sessions/'+encodeURIComponent(id)+(s?'/'+s:'');
const terminal=s=>['finishing','processing','completed','cancelled','interrupted'].includes(s);
const actionLabel=(node,text,icon)=>{node.innerHTML=iconHtml(icon)+'<span>'+text+'</span>';};
function showError(error){const n=el('[data-error]');if(n){n.textContent=error?.message||'';n.hidden=!n.textContent;}}
function stopPreview(){clearInterval(sampleClock);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;}
function cleanup(){clearTimeout(timer);clearInterval(clock);stopPreview();unsubscribers.forEach(fn=>fn());unsubscribers=[];actions?.leave().catch(()=>{});if(recordingUrl)URL.revokeObjectURL(recordingUrl);}
window.addEventListener('pagehide',cleanup);
window.addEventListener('beforeunload',event=>{if(entered&&!terminal(state?.state)){event.preventDefault();event.returnValue='';}});
function updateJoin(){const b=el('[data-join]');if(b)b.disabled=!checked||!mediaAvailable(stream)||!el('[data-environment]').checked||joining;}
async function checkDevices(){
 const b=el('[data-check]');b.disabled=true;el('[data-device-status]').textContent='Cho phép camera/micro khi trình duyệt hỏi. Hãy kết thúc mọi cuộc gọi trước khi kiểm tra.';
 try{
  stopPreview();checked=false;updateJoin();el('[data-record]').disabled=true;el('[data-listen]').disabled=true;
  stream=await acquirePreview(el('[data-preview]'));checked=true;el('[data-record]').disabled=false;showError();b.hidden=true;updateJoin();
  el('[data-device-status]').textContent='Có thể thu thử và nghe lại nếu cần.';
  const interrupted=()=>{if(!mediaAvailable(stream)){checked=false;el('[data-record]').disabled=true;b.hidden=false;el('[data-device-status]').textContent=mediaErrorText({name:'DeviceInterruptedError'});updateJoin();}};
  stream.getTracks().forEach(t=>{t.addEventListener('ended',interrupted);t.addEventListener('mute',interrupted);});
 }catch(error){stream=null;b.hidden=false;el('[data-device-status]').textContent=mediaErrorText(error);}
 finally{b.disabled=false;actionLabel(b,'Kiểm tra thiết bị','preview');}
}
async function main(){
 if(!id||!/^[a-f0-9-]{36}$/.test(id))throw Error('Link ca thử không hợp lệ. Hãy mở link do giáo viên gửi.');
 const response=await fetch('/api/auth/me',{credentials:'include'});if(!response.ok)throw Error('Không kiểm tra được đăng nhập. Hãy tải lại trang.');user=(await response.json()).user;
 if(!user){root.innerHTML='<section class="the speaking-welcome"><h1>Thi Nói thử nghiệm</h1><p>Đăng nhập đúng tài khoản được giáo viên xếp vào ca thi.</p><a class="nut chinh" href="/api/auth/google?return='+encodeURIComponent(location.pathname+location.search)+'">Đăng nhập Google</a></section>';return;}
 state=await speakingApi(path());
 if(!isPhone(navigator.userAgent)){
  root.innerHTML='<section class="the speaking-welcome"><h1>Tiếp tục trên điện thoại</h1><p>'+esc(state.title)+'</p><canvas data-qr aria-label="QR chuyển sang điện thoại"></canvas><p>Quét QR bằng camera điện thoại, đăng nhập tài khoản <strong>'+esc(user.email)+'</strong>. Điện thoại dùng để xem đề, nghe–nói và ghi hình; máy tính không tham gia cuộc gọi.</p><p class="speaking-note">Safari trên iPhone hoặc Chrome trên Android. Không mở bằng trình duyệt bên trong Zalo/Facebook.</p><a class="nut" href="/">Về G2G</a></section>';await drawQr(el('[data-qr]'),location.href);return;
 }
 root.classList.add('speaking-room');root.innerHTML=speakingRoomHtml();
 el('[data-environment]').onchange=updateJoin;el('[data-check]').onclick=checkDevices;
 el('[data-record]').onclick=async()=>{
  const b=el('[data-record]');b.disabled=true;el('[data-check]').disabled=true;el('[data-listen]').disabled=true;actionLabel(b,'Đang thu…','speaking');
  let remaining=3;el('[data-device-status]').textContent='Nói vài từ · còn 3 giây';sampleClock=setInterval(()=>{remaining=Math.max(0,remaining-1);el('[data-device-status]').textContent='Đang thu · còn '+remaining+' giây';},1000);
  try{
   const blob=await recordSample(stream,{onRecorder:value=>{recorder=value;}});
   if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=URL.createObjectURL(blob);el('[data-sample]').src=recordingUrl;el('[data-listen]').disabled=false;el('[data-device-status]').textContent='Bản thu thử đã sẵn sàng để nghe lại.';
  }catch(error){el('[data-device-status]').textContent=mediaErrorText(error);}
  finally{clearInterval(sampleClock);b.disabled=!mediaAvailable(stream);actionLabel(b,'Thu thử','speaking');el('[data-check]').disabled=false;updateJoin();}
 };
 el('[data-listen]').onclick=async()=>{
  const b=el('[data-listen]');b.disabled=true;let timeout;
  try{el('[data-sample]').currentTime=0;await Promise.race([el('[data-sample]').play(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Không phát được bản thu. Hãy kết thúc cuộc gọi rồi thử lại.')),8000);})]);}
  catch(error){el('[data-device-status]').textContent=error.message;}finally{clearTimeout(timeout);b.disabled=false;}
 };
 el('[data-join]').onclick=async()=>{
  joining=true;updateJoin();try{
   const credentials=await speakingApi(path('join'),{});stopPreview();el('[data-preview]').srcObject=null;
   const hms=await import('@100mslive/hms-video-store');sdk??=new hms.HMSReactiveStore();actions=sdk.getActions();store=sdk.getStore();sdk.triggerOnSubscribe();
   unsubscribers.forEach(fn=>fn());unsubscribers=[];
   unsubscribers.push(store.subscribe(peers=>{lastPeers=peers;renderPeers(peers,state.members);},hms.selectPeers));
   unsubscribers.push(store.subscribe(value=>{joined=value;paint();},hms.selectIsConnectedToRoom));
   await actions.join({userName:credentials.name,authToken:credentials.token,settings:{isAudioMuted:false,isVideoMuted:false}});
   joined=true;entered=true;showError();await refresh();
  }catch(error){if(!entered)await actions?.leave().catch(()=>{});showError(error);checked=false;el('[data-check]').hidden=false;}
  finally{joining=false;paint();updateJoin();}
 };
 el('[data-ready]').onclick=async()=>{const b=el('[data-ready]');b.disabled=true;try{await speakingApi(path('ready'),{consent:true});await refresh();}catch(error){showError(error);b.disabled=false;}};
 el('[data-next]').onclick=async()=>{
  const b=el('[data-next]'),index=state.stageIndex;b.disabled=true;
  try{await speakingApi(path('next'),{stageIndex:index});votedStage=index;paint();await refresh();}
  catch(error){showError(error);b.disabled=false;}
 };
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
 clock=setInterval(updateClock,1000);paint();await refresh();
}
function renderPeers(peers,members){
 const container=el('[data-videos]');if(!container)return;
 const ordered=[...members].sort((a,b)=>(a.seat||'').localeCompare(b.seat||''));
 for(const [index,member] of ordered.entries()){
  const peer=peers.find(p=>p.customerUserId===member.id||p.isLocal&&member.id===user.id);
  let tile=tiles.get(member.id);
  if(!tile){const node=document.createElement('figure');node.innerHTML='<video autoplay muted playsinline></video><figcaption></figcaption>';tile={node,video:node.querySelector('video'),track:null};tiles.set(member.id,tile);}
  tile.node.dataset.seat=member.seat|| (index===0?'A':'B');tile.node.querySelector('figcaption').textContent=member.name;tile.node.querySelector('figcaption').title=member.name;if(container.children[index]!==tile.node)container.insertBefore(tile.node,container.children[index]||null);
  const track=peer?.videoTrack||null;tile.node.classList.toggle('speaking-no-video',!track);
  if(tile.track!==track){if(tile.track)actions?.detachVideo(tile.track,tile.video).catch(()=>{});tile.track=track;if(track)actions.attachVideo(track,tile.video).catch(showError);}
 }
}
function paint(){
 if(!el('[data-status]'))return;
 const done=terminal(state.state),active=['running','paused'].includes(state.state),paused=active&&(state.state==='paused'||entered&&!joined),waiting=['waiting','starting','scheduled'].includes(state.state);
 root.dataset.view=done?'finished':paused?'paused':entered?(active?'stage':'waiting'):'preflight';
 el('[data-title]').textContent=done?'G2G · Thi nói':!entered?'Trước khi thi':active?(state.title.startsWith('DTZ')?'DTZ · Phần 2':state.stage?.title||'Thi nói'):'Phòng chờ';
 el('[data-status]').textContent=paused?'Tạm dừng':done?'Ca thử nghiệm':!entered?'Thử nghiệm':active?'Ghi hình':state.state==='starting'?'Đang bật ghi hình':new Date(state.scheduledAt).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
 el('[data-preflight]').hidden=entered||done||!state.participant;el('[data-preview-wrap]').hidden=entered||done;el('[data-videos]').hidden=!entered||done;
 el('[data-wait]').hidden=!entered||!waiting||done;el('[data-stage]').hidden=!active||!entered||paused;el('[data-paused]').hidden=!paused;el('[data-finished]').hidden=!done;
 const me=state.members.find(m=>m.id===user.id),ready=!!me?.ready;el('[data-ready]').disabled=ready||state.state==='starting';actionLabel(el('[data-ready]'),ready?'Đã sẵn sàng':'Sẵn sàng','example');
 el('[data-wait-note]').textContent=state.state==='starting'?'Đang bật ghi hình. Giữ trang mở.':state.mode==='instant'?'Cả hai sẵn sàng, phòng tự bắt đầu.':'Đến giờ và đủ hai bạn, phòng tự bắt đầu.';
 const names=JSON.stringify(state.members);if(memberKey!==names){memberKey=names;el('[data-members]').innerHTML=readinessHtml(state.members);}
 if(state.error)showError({message:state.error});
 if(active&&state.stage){
  const key=state.stageIndex;if(stageKey!==key){stageKey=key;votedStage=null;el('[data-task]').scrollTop=0;showError();}
  const finished=state.finished||votedStage===key,isSpeaker=state.stage.isSpeaker!==false;
  const contentKey=JSON.stringify(state.stage);if(el('[data-prompt]').dataset.key!==contentKey){el('[data-prompt]').dataset.key=contentKey;el('[data-prompt]').innerHTML=privatePromptHtml(state.stage);el('[data-stage-title]').textContent=state.stage.title;el('[data-task-icon]').innerHTML=iconHtml(state.stage.image?'image':'speaking');}
  el('[data-task]').hidden=!isSpeaker;el('[data-listening]').hidden=isSpeaker;
  el('[data-speaker]').textContent=state.stage.speakerName+(state.partnerFinished?' đã nói xong':' đang nói');
  el('[data-turn]').textContent=finished?'Đã xong':state.stage.speakerName?'Đến lượt bạn':'Cùng trao đổi';el('[data-turn]').classList.toggle('speaking-turn-neutral',finished);
  el('[data-stage-footer]').hidden=!isSpeaker&&!state.partnerFinished&&!finished;
  el('[data-next]').hidden=finished;el('[data-next]').disabled=paused||finished;actionLabel(el('[data-next]'),isSpeaker?'Tôi đã nói xong':'Đã nghe xong','arrowRight');
  el('[data-vote]').hidden=!finished;
 }
 if(done){const copy=finishedCopy(state),icon=el('[data-finished-icon]');icon.dataset.outcome=state.state;icon.innerHTML=finishedIconHtml(state);el('[data-finished-title]').textContent=copy.title;el('[data-finished-note]').textContent=copy.note;if(entered){entered=false;joined=false;actions?.leave().catch(()=>{});}}
 if(!done)renderPeers(lastPeers,state.members);
 updateClock();
}
function updateClock(){if(!el('[data-clock]'))return;const value=state.state==='paused'?clockText(state.remaining/1000):state.deadline&&state.state==='running'?clockText((state.deadline-Date.now()-serverOffset)/1000):'';el('[data-clock]').textContent=value;el('[data-clock]').hidden=!value;}
let fetching=false;
async function refresh(){
 clearTimeout(timer);if(fetching||document.hidden)return;fetching=true;
 try{state=await speakingApi(path());serverOffset=state.serverNow-Date.now();paint();}catch(error){showError(error);}finally{fetching=false;if(!['completed','cancelled','interrupted'].includes(state.state))timer=setTimeout(refresh,3000);}
}
initializeTheme().catch(()=>{});loadPublicSettings().then(acceptPublicSettings).catch(()=>{});
main().catch(error=>{cleanup();root.classList.remove('speaking-room');root.innerHTML='<section class="the speaking-welcome"><h1>Không mở được ca thử</h1><p role="alert">'+esc(error.message)+'</p><a class="nut" href="/">Về G2G</a></section>';}).finally(()=>root.removeAttribute('aria-busy'));
