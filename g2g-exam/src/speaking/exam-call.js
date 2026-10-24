// Shared-provider adapter for real paired exams; the old trial controller is untouched.
export function createSpeakingExamCall({root,getSession,getUser,credentials,onConnected,onChange,onError,loadSdk=()=>import('@100mslive/hms-video-store')}){
 let actions,store,sdk,joining=false,joined=false,reconnecting=false,audioBlocked=false,disposed=false,epoch=0,unsubscribers=[],peers=[];const tiles=new Map();
 const render=()=>{
  const container=root.querySelector('[data-sx-videos]'),session=getSession();if(!container||!session)return;
  for(const [index,member] of [...session.members].sort((a,b)=>a.seat.localeCompare(b.seat)).entries()){
   const peer=peers.find(p=>p.customerUserId===member.id||p.isLocal&&member.id===getUser()?.id);
   let tile=tiles.get(member.id);
   if(!tile){const node=root.ownerDocument.createElement('figure');node.innerHTML='<video autoplay muted playsinline></video><figcaption></figcaption>';tile={node,video:node.querySelector('video'),track:null};tiles.set(member.id,tile);}
   tile.node.querySelector('figcaption').textContent=member.name;tile.node.dataset.seat=member.seat;
   if(container.children[index]!==tile.node)container.insertBefore(tile.node,container.children[index]||null);
   const track=peer?.videoTrack||null;tile.node.classList.toggle('sx-no-video',!track);
   if(tile.track!==track){if(tile.track)void actions?.detachVideo(tile.track,tile.video).catch(()=>{});tile.track=track;if(track)void actions.attachVideo(track,tile.video).catch(onError);}
  }
 };
 const leave=async()=>{epoch++;joined=false;joining=false;reconnecting=false;audioBlocked=false;for(const unsubscribe of unsubscribers)unsubscribe();unsubscribers=[];for(const tile of tiles.values()){if(tile.track)void actions?.detachVideo(tile.track,tile.video).catch(()=>{});tile.node.remove();}tiles.clear();peers=[];await actions?.leave().catch(()=>{});};
 async function join(){
  if(joining||joined||reconnecting||disposed)return;
  const session=getSession();if(!session||!['joining','starting','running','paused'].includes(session.state))throw Error('Phòng thi chỉ mở sau khi kết thúc chuẩn bị.');
  if(!session.canJoin)throw Error('Phòng thi chưa sẵn sàng. Vui lòng chờ một chút.');
  joining=true;const token=++epoch;onChange();
  try{
   const auth=await credentials(),hms=await loadSdk();if(disposed||token!==epoch)return;
   sdk??=new hms.HMSReactiveStore();actions=sdk.getActions();store=sdk.getStore();sdk.triggerOnSubscribe();
   for(const unsubscribe of unsubscribers)unsubscribe();unsubscribers=[];
   unsubscribers.push(store.subscribe(value=>{if(token!==epoch)return;peers=value;render();},hms.selectPeers));
   unsubscribers.push(store.subscribe(value=>{if(token!==epoch)return;joined=value;onChange();},hms.selectIsConnectedToRoom));
   const notifications=sdk.getNotifications?.();
   if(notifications)unsubscribers.push(notifications.onNotification(notification=>{
    if(token!==epoch)return;
    if(notification.type==='RECONNECTING')reconnecting=true;
    if(notification.type==='RECONNECTED'){reconnecting=false;joined=true;void Promise.resolve(onConnected()).catch(onError);}
    if(notification.type==='ERROR'){
     // These error names and unblockAudio are supplied by the installed 100ms SDK.
     if(['AutoplayBlocked','Audio playback error'].includes(notification.data?.name))audioBlocked=true;
     else if(notification.data?.isTerminal){reconnecting=false;joined=false;onError(Error('Cuộc gọi đã ngắt. Kiểm tra kết nối và vào phòng lại.'));}
    }
    onChange();
   }));
   await actions.join({userName:auth.name,authToken:auth.token,settings:{isAudioMuted:false,isVideoMuted:false}});
   if(disposed||token!==epoch){await actions.leave().catch(()=>{});return;}
   joined=true;await onConnected();render();
  }catch(error){joined=false;for(const unsubscribe of unsubscribers)unsubscribe();unsubscribers=[];await actions?.leave().catch(()=>{});onError(error);}
  finally{if(token===epoch){joining=false;onChange();}}
 }
 return {join,leave,render,isJoined:()=>joined,isJoining:()=>joining||reconnecting,isAudioBlocked:()=>audioBlocked,
  unblockAudio:async()=>{await actions?.unblockAudio();audioBlocked=false;onChange();},dispose:()=>{disposed=true;return leave();}};
}
