import {esc} from '../ui/format.js';
import {speakingApi} from './api.js';
import {isPhone,LAB_STATES,clockText} from './model.js';
import {loadPublicSettings} from '../settings/api.js';
import {acceptPublicSettings} from '../settings/theme.js';

const root=document.getElementById('speaking-app'),id=new URL(location.href).searchParams.get('session');
let state,user,stream,actions,store,sdk,joined=false,joining=false,checked=false,timer,clock,serverOffset=0,recordingUrl,recorder,recordStop,unsubscribers=[];
const tiles=new Map(),el=s=>root.querySelector(s),path=s=>'sessions/'+encodeURIComponent(id)+(s?'/'+s:'');
const terminal=s=>['finishing','processing','completed','cancelled','interrupted'].includes(s);
function showError(error){if(el('[data-error]'))el('[data-error]').textContent=error.message;}
function stopPreview(){if(recordStop)clearTimeout(recordStop);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;}
function cleanup(){clearTimeout(timer);clearInterval(clock);stopPreview();unsubscribers.forEach(fn=>fn());unsubscribers=[];actions?.leave().catch(()=>{});if(recordingUrl)URL.revokeObjectURL(recordingUrl);}
window.addEventListener('pagehide',cleanup);
async function main(){
 if(!id||!/^[a-f0-9-]{36}$/.test(id))throw Error('Link ca thử không hợp lệ. Hãy mở link do giáo viên gửi.');
 const response=await fetch('/api/auth/me',{credentials:'include'});user=(await response.json()).user;
 if(!user){root.innerHTML=`<section class="the speaking-welcome"><h1>Thi Nói thử nghiệm</h1><p>Đăng nhập đúng tài khoản được giáo viên xếp vào ca thi.</p><a class="nut chinh" href="/api/auth/google?return=${encodeURIComponent(location.pathname+location.search)}">Đăng nhập Google</a></section>`;return;}
 state=await speakingApi(path());
 if(!isPhone(navigator.userAgent)){
  root.innerHTML=`<section class="the speaking-welcome"><h1>Tiếp tục trên điện thoại</h1><p>${esc(state.title)}</p><canvas data-qr aria-label="QR chuyển sang điện thoại"></canvas><p>Quét QR bằng camera điện thoại, đăng nhập tài khoản <strong>${esc(user.email)}</strong>. Điện thoại dùng để xem đề, nghe–nói và ghi hình; máy tính không tham gia cuộc gọi.</p><p class="speaking-note">Safari trên iPhone hoặc Chrome trên Android. Không mở bằng trình duyệt bên trong Zalo/Facebook.</p><a class="nut" href="/">Về G2G</a></section>`;
  const QR=await import('qrcode');await QR.toCanvas(el('[data-qr]'),location.href,{width:224,margin:2});return;
 }
 root.innerHTML=`<header class="speaking-phone-heading"><div><span class="speaking-label">Thử nghiệm · không tính điểm thật</span><h1 data-title></h1></div><a href="/" class="text-link" data-back>G2G</a></header><p class="speaking-note">Giờ hẹn: ${esc(new Date(state.scheduledAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))} · ${esc(user.name||user.email)} · vị trí ${esc(state.seat||'người xem')}</p><section class="the speaking-live"><div class="speaking-status"><span data-status role="status" aria-live="polite"></span><strong data-clock></strong></div><p data-members class="speaking-note"></p><p data-error role="alert"></p><section data-preflight><h2>Trước khi vào phòng</h2><ol><li>Đặt điện thoại cố định, thấy rõ mặt; đeo tai nghe, cắm sạc và bật Không làm phiền.</li><li>Cho phép camera/micro. Thu thử, nghe lại và kiểm tra hình của bạn.</li><li>Giữ trang mở, không khóa màn hình hay chuyển ứng dụng trong khi thi.</li></ol><video data-preview autoplay playsinline muted></video><div class="backup-actions"><button class="nut" data-check>Kiểm tra camera / micro</button><button class="nut" data-record disabled>Thu thử 3 giây</button></div><audio data-sample controls hidden></audio><label class="speaking-check"><input type="checkbox" data-heard>Tôi thấy hình rõ và đã nghe lại tiếng của mình.</label><label class="speaking-check"><input type="checkbox" data-consent>Tôi đồng ý ghi hình ca thử để giáo viên xem và nhận xét. Video thử trên 100ms mặc định giữ 15 ngày.</label><button class="nut chinh" data-join disabled>Vào phòng thử</button></section><div class="speaking-videos" data-videos hidden></div><div class="backup-actions" data-call-controls hidden><button class="nut" data-audio>Micro: bật</button><button class="nut" data-video>Camera: bật</button><button class="nut" data-leave>Rời phòng</button></div><section data-wait hidden><h2>Chờ bạn thi</h2><p>Hai bạn kiểm tra nghe–nói rồi cùng bấm Sẵn sàng. Đến giờ hẹn, hệ thống bật ghi hình và mở đề khi đủ điều kiện.</p><button class="nut chinh" data-ready>Sẵn sàng</button></section><section data-stage hidden><div class="speaking-stage-heading"><h2 data-stage-title></h2><span data-stage-number></span></div><details data-help open><summary>Hướng dẫn phần này</summary><p data-instruction></p></details><div class="speaking-prompt" data-prompt></div><p class="speaking-note">Mỗi người chỉ thấy đề của mình. Muốn chuyển sớm, cả hai cùng bấm nút dưới; hết giờ hệ thống tự chuyển. Mở hướng dẫn không dừng giờ.</p><button class="nut" data-next>Xin chuyển phần</button><p data-vote role="status"></p></section><section data-finished hidden><h2>Ca thử đã kết thúc</h2><p>Hệ thống đóng phòng và xử lý bản ghi. Giáo viên sẽ xem lại và nhận xét; không cập nhật kết quả thi thật.</p></section></section>`;
 el('[data-title]').textContent=state.title;
 const updateJoin=()=>{el('[data-join]').disabled=!checked||!el('[data-heard]').checked||!el('[data-consent]').checked||joining;};
 el('[data-heard]').onchange=updateJoin;el('[data-consent]').onchange=updateJoin;
 el('[data-check]').onclick=async()=>{
  const b=el('[data-check]');b.disabled=true;try{
   stopPreview();checked=false;el('[data-heard]').checked=false;updateJoin();
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Trình duyệt không hỗ trợ. Hãy mở bằng Safari iPhone hoặc Chrome Android.');
   stream=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
   el('[data-preview]').srcObject=stream;await el('[data-preview]').play();el('[data-record]').disabled=false;el('[data-error]').textContent='';
   stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{checked=false;updateJoin();}));
  }catch(e){showError({message:'Chưa dùng được camera/micro. Cho phép quyền trong trình duyệt và thử lại. '+e.message});}finally{b.disabled=false;}
 };
 el('[data-record]').onclick=()=>{
  try{
   if(!stream||typeof MediaRecorder==='undefined')throw Error('Không thu thử được trên trình duyệt này. Hãy cập nhật Safari/Chrome.');
   const chunks=[],b=el('[data-record]');b.disabled=true;b.textContent='Đang thu…';
   recorder=new MediaRecorder(new MediaStream(stream.getAudioTracks()));
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>{b.disabled=false;b.textContent='Thu thử 3 giây';showError({message:'Thu thử thất bại. Hãy thử lại.'});};
   recorder.onstop=()=>{if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));el('[data-sample]').src=recordingUrl;el('[data-sample]').hidden=false;b.disabled=false;b.textContent='Thu lại 3 giây';checked=chunks.length>0;updateJoin();};
   recorder.start();recordStop=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},3000);
  }catch(e){showError(e);}
 };
 el('[data-join]').onclick=async()=>{
  joining=true;updateJoin();try{
   const credentials=await speakingApi(path('join'),{});stopPreview();el('[data-preview]').srcObject=null;
   const hms=await import('@100mslive/hms-video-store');sdk??=new hms.HMSReactiveStore();actions=sdk.getActions();store=sdk.getStore();sdk.triggerOnSubscribe();
   unsubscribers.forEach(fn=>fn());unsubscribers=[];
   unsubscribers.push(store.subscribe(peers=>renderPeers(peers,state.members),hms.selectPeers));
   unsubscribers.push(store.subscribe(value=>{joined=value;if(!value&&!joining&&!terminal(state.state)){showError({message:'Kết nối cuộc gọi đang gián đoạn. Giữ trang mở để kết nối lại; nếu không khôi phục, kiểm tra thiết bị và vào lại.'});}paint();},hms.selectIsConnectedToRoom));
   await actions.join({userName:credentials.name,authToken:credentials.token,settings:{isAudioMuted:false,isVideoMuted:false}});
   joined=true;el('[data-error]').textContent='';await refresh();
  }catch(e){showError(e);checked=false;}finally{joining=false;paint();updateJoin();}
 };
 el('[data-ready]').onclick=async()=>{const b=el('[data-ready]');b.disabled=true;try{await speakingApi(path('ready'),{consent:true});await refresh();}catch(e){showError(e);b.disabled=false;}};
 el('[data-next]').onclick=async()=>{const b=el('[data-next]');b.disabled=true;try{await speakingApi(path('next'),{stageIndex:state.stageIndex});el('[data-vote]').textContent='Đã gửi yêu cầu. Chờ bạn thi đồng ý hoặc hết giờ.';}catch(e){showError(e);b.disabled=false;}};
 el('[data-audio]').onclick=async()=>{try{const on=!store.getState((await import('@100mslive/hms-video-store')).selectIsLocalAudioEnabled);await actions.setLocalAudioEnabled(on);el('[data-audio]').textContent='Micro: '+(on?'bật':'tắt');}catch(e){showError(e);}};
 el('[data-video]').onclick=async()=>{try{const on=!store.getState((await import('@100mslive/hms-video-store')).selectIsLocalVideoEnabled);await actions.setLocalVideoEnabled(on);el('[data-video]').textContent='Camera: '+(on?'bật':'tắt');}catch(e){showError(e);}};
 el('[data-leave]').onclick=async()=>{try{await actions.leave();joined=false;checked=false;paint();updateJoin();}catch(e){showError(e);}};
 el('[data-back]').onclick=e=>{if(joined){e.preventDefault();showError({message:'Hãy bấm Rời phòng trước khi rời trang. Ca thi sẽ tạm dừng nếu thiếu một người.'});}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&joined)showError({message:'Bạn vừa rời màn hình thi. Quay lại và kiểm tra camera/micro; ca thi có thể đã tạm dừng.'});if(!document.hidden){clearTimeout(timer);refresh();}});
 clock=setInterval(updateClock,1000);paint();await refresh();
}
function renderPeers(peers,members){
 const container=el('[data-videos]');if(!container)return;
 const allowed=peers.filter(p=>members.some(m=>m.id===p.customerUserId)||p.isLocal);
 const ids=new Set(allowed.map(p=>p.id));
 for(const [id,t]of tiles)if(!ids.has(id)){if(t.track)actions.detachVideo(t.track,t.video).catch(()=>{});t.node.remove();tiles.delete(id);}
 for(const peer of allowed){
  let t=tiles.get(peer.id);if(!t){const node=document.createElement('figure');node.innerHTML='<video autoplay muted playsinline></video><figcaption></figcaption>';container.append(node);t={node,video:node.querySelector('video'),track:null};tiles.set(peer.id,t);}
  t.node.querySelector('figcaption').textContent=peer.name+(peer.isLocal?' · Bạn':'');
  if(t.track!==peer.videoTrack){if(t.track)actions.detachVideo(t.track,t.video).catch(()=>{});t.track=peer.videoTrack;if(t.track)actions.attachVideo(t.track,t.video).catch(showError);}
 }
}
let stageKey;
function paint(){
 if(!el('[data-status]'))return;const done=terminal(state.state),active=['running','paused'].includes(state.state);
 el('[data-status]').textContent=LAB_STATES[state.state]||state.state;
 el('[data-members]').textContent=state.members.map(m=>m.seat+' · '+m.name+(m.presence?.devices>1?' · đang mở nhiều thiết bị':m.presence?.connected?' · đã kết nối':' · chưa kết nối')).join(' / ');
 el('[data-preflight]').hidden=joined||done||!state.participant;el('[data-videos]').hidden=!joined;el('[data-call-controls]').hidden=!joined;
 el('[data-wait]').hidden=!joined||!['waiting','starting','scheduled'].includes(state.state);
 el('[data-ready]').disabled=!!state.members.find(m=>m.id===user.id)?.ready||state.state==='starting';
 el('[data-ready]').textContent=state.members.find(m=>m.id===user.id)?.ready?'Đã sẵn sàng':'Sẵn sàng';
 el('[data-stage]').hidden=!active||!joined;el('[data-finished]').hidden=!done;
 if(state.error)showError({message:state.error});
 if(active&&state.stage){
  const key=state.stageIndex;if(stageKey!==key){stageKey=key;el('[data-help]').open=true;el('[data-next]').disabled=false;el('[data-vote]').textContent='';}
  el('[data-stage-title]').textContent=state.stage.title;el('[data-stage-number]').textContent=(state.stageIndex+1)+' / '+state.stageCount;
  el('[data-instruction]').textContent=state.stage.instruction;el('[data-prompt]').textContent=state.stage.prompt;el('[data-next]').disabled=state.state==='paused'||!!el('[data-vote]').textContent;
 }
 if(done&&joined){actions?.leave().catch(()=>{});joined=false;}
 updateClock();
}
function updateClock(){if(!el('[data-clock]'))return;el('[data-clock]').textContent=state.state==='paused'?clockText(state.remaining/1000):state.deadline&&state.state==='running'?clockText((state.deadline-Date.now()-serverOffset)/1000):'';}
let fetching=false;
async function refresh(){
 clearTimeout(timer);if(fetching||document.hidden)return;fetching=true;
 try{state=await speakingApi(path());serverOffset=state.serverNow-Date.now();paint();}catch(e){showError(e);}finally{fetching=false;if(!['completed','cancelled','interrupted'].includes(state.state))timer=setTimeout(refresh,3000);}
}
main().catch(e=>{cleanup();root.innerHTML=`<section class="the speaking-welcome"><h1>Không mở được ca thử</h1><p role="alert">${esc(e.message)}</p><a class="nut" href="/">Về G2G</a></section>`;}).finally(()=>root.removeAttribute('aria-busy'));
loadPublicSettings().then(acceptPublicSettings).catch(()=>{});
