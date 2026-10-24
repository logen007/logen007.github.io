import {hmsRequest,hmsPresence} from './speaking-hms.js';
import {speakingPreparationSeconds,SPEAKING_RECOVERY_SECONDS} from '../../src/speaking/exam-model.js';

export const SPEAKING_EXAM_TERMINAL=new Set(['completed','cancelled','interrupted']);
export const SPEAKING_ROOM_CAPACITY_LOCK='g2g-speaking-room-capacity';
const mediaReady=presence=>presence.length===2&&presence.every(p=>p.connected&&p.devices===1&&p.audio&&p.video);
const providerId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const recordingForRoom=(recording,d)=>{if(recording?.room_id!==d.roomId)throw new Error('Recording room mismatch');return recording;};
export function finishSpeakingSession(d,outcome,message,time=Date.now()){
 if(SPEAKING_EXAM_TERMINAL.has(d.state))return;
 d.outcome=outcome;d.error=message||'';d.deadline=null;d.recoveryDeadline=null;d.votes={};
 d.state=d.roomId||d.roomRequestedAt?'finishing':outcome;
 if(SPEAKING_EXAM_TERMINAL.has(d.state)){d.finishedAt=time;d.roomReserved=false;d.roomClosed=true;}
}
export function beginSpeakingStage(d,index,time){
 if(d.markers.length&&!d.markers.at(-1).end)d.markers.at(-1).end=time;
 const stages=d.examSnapshot.speaking.stages;
 if(index>=stages.length){finishSpeakingSession(d,'completed','',time);return;}
 d.state='running';d.stageIndex=index;d.deadline=time+stages[index].seconds*1000;d.remaining=null;d.recoveryDeadline=null;d.votes={};
 d.markers.push({stageId:stages[index].id,title:stages[index].title,start:time,end:null});
}
function pause(d,time,message){
 if(d.state==='running'){d.remaining=Math.max(0,d.deadline-time);d.pausedAt=time;d.recoveryDeadline=time+SPEAKING_RECOVERY_SECONDS*1000;d.state='paused';d.votes={};}
 d.error=message;
}

// Only the leased worker invokes provider mutations. checkpoint commits intent
// before POST: a crash/lost response is recovered with provider GETs, never a
// blind second allocation. These list filters are documented 100ms v2 APIs.
export async function tickSpeakingExam(d,config,{time=Date.now(),request=hmsRequest,presence=hmsPresence,checkpoint=async()=>{},reserveRoom=async()=>true}={}){
 if(SPEAKING_EXAM_TERMINAL.has(d.state)){
  // Processing timeout releases the candidates, but never abandons a retained
  // provider job: a late asset can still be archived without reviving the exam.
  if(d.recordingId&&!d.assetId&&d.recordingStatus!=='failed'){
   const recording=recordingForRoom(await request(config,'recordings/'+encodeURIComponent(d.recordingId)),d);d.recordingStatus=recording.status;
   const asset=(recording.recording_assets||[]).find(a=>a.type==='room-composite'&&a.status==='completed'&&providerId(a.id));
   if(recording.status==='completed'&&asset){d.assetId=asset.id;d.driveArchive={state:'queued',retryAt:0,attempts:0};}
   else d.retryAt=time+60000;
  }
  return;
 }
 if(d.state==='preparing'){
  d.prepDeadline??=time+speakingPreparationSeconds(d.examSnapshot?.speaking)*1000;
  if(time>=d.prepDeadline||d.members.every(m=>d.ready[m.id])){d.state='joining';d.joinDeadline=time+120000;d.error='';}
  else return;
 }
 if(d.roomOpenedAt&&time>=d.roomOpenedAt+55*60000&&!['finishing','processing'].includes(d.state))finishSpeakingSession(d,'interrupted','Phòng thi đã hết thời gian an toàn. Bạn có thể tìm bạn thi lại.',time);
 if(d.state==='joining'&&!d.roomId){
  if(!config){d.error='Chưa kết nối dịch vụ video. Vui lòng thử lại sau.';return;}
  if(!d.roomReserved){
   const reservation=await reserveRoom(d);
   if(!reservation){d.error='Các phòng thi đang bận. Hệ thống sẽ thử lại.';return;}
   if(reservation.config)config=reservation.config;
   d.roomReserved=true;await checkpoint(d);
  }
  const name='g2g-speaking-exam-'+d.id;
  if(d.roomRequestedAt){
   const rooms=await request(config,'rooms?name='+encodeURIComponent(name)+'&limit=10');
   const matches=(rooms.data||[]).filter(r=>r.name===name&&r.template_id===config.templateId);
   if(matches.length>1)throw new Error('Ambiguous speaking room allocation');
   if(matches.length){if(!providerId(matches[0].id))throw new Error('Invalid speaking room identifier');d.roomId=matches[0].id;d.roomOpenedAt=d.roomRequestedAt;await checkpoint(d);}
   else if(time-d.roomRequestedAt>=90000){finishSpeakingSession(d,'interrupted','Không xác nhận được phòng video. Vui lòng tìm bạn thi lại.',time);}
   else return;
  }else{
   d.roomRequestedAt=time;await checkpoint(d);
   const room=await request(config,'rooms',{method:'POST',body:{name,description:'G2G paired speaking exam',template_id:config.templateId,max_duration_seconds:3600}});
   if(!providerId(room?.id))throw new Error('Missing speaking room allocation');
   d.roomId=room.id;d.roomOpenedAt=time;d.joinDeadline=time+120000;await checkpoint(d);
  }
 }
 // Recover an uncertain allocation even when cancellation raced the provider.
 if(d.state==='finishing'&&!d.roomId&&d.roomRequestedAt){
  const rooms=await request(config,'rooms?name='+encodeURIComponent('g2g-speaking-exam-'+d.id)+'&limit=10');
  const match=(rooms.data||[]).find(r=>r.name==='g2g-speaking-exam-'+d.id&&r.template_id===config.templateId);
  if(match){if(!providerId(match.id))throw new Error('Invalid speaking room identifier');d.roomId=match.id;}
  else if(time-d.roomRequestedAt<120000)return;
  else {d.roomReserved=false;d.roomClosed=true;d.state=d.outcome||'interrupted';d.finishedAt=time;return;}
  await checkpoint(d);
 }
 if(['joining','starting','running','paused'].includes(d.state)&&d.roomId){
  try{d.presence=await presence(config,d.roomId,d.members);delete d.presenceFailureAt;}
  catch(error){
   if(!error.providerRetryable)throw error;
   d.presenceFailureAt??=time;pause(d,time,'Đang khôi phục kết nối video. Vui lòng giữ phòng mở.');
   if(time-d.presenceFailureAt>=SPEAKING_RECOVERY_SECONDS*1000)finishSpeakingSession(d,'interrupted','Không thể khôi phục kết nối video. Bạn có thể thi lại.',time);
   else return;
  }
  const present=mediaReady(d.presence||[]);
  if(d.state==='joining'){
   if(present&&d.members.every(m=>d.connectedConsent?.[m.id])){
    d.state='starting';d.recordingRequestedAt=time;d.recordingStatus='starting';await checkpoint(d);
    const recording=await request(config,`recordings/room/${d.roomId}/start`,{method:'POST',body:{destination:config.recordingDestination,resolution:{width:1280,height:720},transcription:{enabled:false}}});
    if(recording.id&&!providerId(recording.id))throw new Error('Invalid speaking recording identifier');
    if(recording.room_id&&recording.room_id!==d.roomId)throw new Error('Recording room mismatch');
    d.recordingId=recording.id;d.recordingStatus=recording.status;await checkpoint(d);
   }else if(time>=d.joinDeadline)finishSpeakingSession(d,'interrupted','Chưa nhận đủ camera và micro của cả hai thí sinh. Bạn có thể thi lại.',time);
  }
  if(['starting','running','paused'].includes(d.state)){
   if(!d.recordingId){
    const recordings=await request(config,'recordings?room_id='+encodeURIComponent(d.roomId)+'&limit=10');
    const matches=(recordings.data||[]).filter(r=>r.room_id===d.roomId);
    if(matches.length>1)throw new Error('Ambiguous speaking recording');
    if(matches[0]){if(!providerId(matches[0].id))throw new Error('Invalid speaking recording identifier');d.recordingId=matches[0].id;await checkpoint(d);}
    else if(time-d.recordingRequestedAt>=90000)finishSpeakingSession(d,'interrupted','Không thể xác nhận ghi hình. Bài thi chưa được bắt đầu.',time);
    else return;
   }
   if(d.recordingId){
    const recording=recordingForRoom(await request(config,'recordings/'+encodeURIComponent(d.recordingId)),d);d.recordingStatus=recording.status;
    if(d.state==='starting'){
     if(recording.status==='running'&&present){d.recordingStartedAt=Date.parse(recording.started_at)||time;beginSpeakingStage(d,0,time);}
     else if(recording.status==='failed'||time-d.recordingRequestedAt>=90000)finishSpeakingSession(d,'interrupted','Không bắt đầu được bản ghi đầy đủ. Bạn có thể thi lại.',time);
    }else if(recording.status!=='running')finishSpeakingSession(d,'interrupted','Bản ghi bị gián đoạn. Bài thi đã dừng để tránh thiếu nội dung.',time);
    else if(d.state==='paused'&&time>=d.recoveryDeadline)finishSpeakingSession(d,'interrupted','Không khôi phục đủ camera và micro trong 120 giây. Bạn có thể thi lại.',time);
    else if(!present){pause(d,time,'Đang chờ khôi phục camera và micro.');if(time>=d.recoveryDeadline)finishSpeakingSession(d,'interrupted','Không khôi phục đủ camera và micro trong 120 giây. Bạn có thể thi lại.',time);}
    else if(d.state==='paused'){d.deadline=time+d.remaining;d.remaining=null;d.recoveryDeadline=null;d.state='running';d.error='';}
    else if(time>=d.deadline||d.members.every(m=>d.votes[m.id]))beginSpeakingStage(d,d.stageIndex+1,time);
   }
  }
 }
 if(d.state==='finishing'&&d.roomId){
  // Each confirmed cleanup step is durable; a failure does not skip the others.
  let failed=false;
  if(d.recordingStopRequestedAt&&!d.recordingStopped){
   try{
    let recording;
    if(d.recordingId)recording=recordingForRoom(await request(config,'recordings/'+encodeURIComponent(d.recordingId)),d);
    else {const result=await request(config,'recordings?room_id='+encodeURIComponent(d.roomId)+'&limit=10');recording=(result.data||[]).find(r=>r.room_id===d.roomId&&providerId(r.id));if(recording)d.recordingId=recording.id;}
    if(recording&&['stopping','post_processing','completed','failed'].includes(recording.status)){d.recordingStopped=true;d.recordingStatus=recording.status;await checkpoint(d);}
   }catch{failed=true;}
  }
  for(const [flag,path,body] of [
   ['recordingStopped',`recordings/room/${d.roomId}/stop`,null],
   ['roomEnded',`active-rooms/${d.roomId}/end-room`,{reason:'G2G speaking exam finished',lock:true}],
   ['roomDisabled',`rooms/${d.roomId}`,{enabled:false}]
  ]){
   if(d[flag]||flag==='recordingStopped'&&!d.recordingRequestedAt)continue;
   try{if(flag==='recordingStopped'){d.recordingStopRequestedAt??=time;await checkpoint(d);}await request(config,path,{method:'POST',...(body?{body}:{}),missing:true});d[flag]=true;await checkpoint(d);}catch{failed=true;}
  }
  if(failed){d.error='Đang xác nhận đóng phòng và xử lý bản ghi. Hệ thống sẽ thử lại.';return;}
  if(d.recordingRequestedAt&&!d.recordingId){
   const recordings=await request(config,'recordings?room_id='+encodeURIComponent(d.roomId)+'&limit=10');
   d.recordingId=(recordings.data||[]).find(r=>r.room_id===d.roomId&&providerId(r.id))?.id;
  }
  d.roomReserved=false;d.roomClosed=true;d.finishedAt=time;d.state=d.recordingId?'processing':d.outcome||'interrupted';
  if(d.markers.length&&!d.markers.at(-1).end)d.markers.at(-1).end=time;
 }
 if(d.state==='processing'){
  if(time-d.finishedAt>=30*60000){d.state='interrupted';d.error='Bản ghi chưa xử lý thành công. Chưa có kết quả để chấm.';return;}
  const recording=recordingForRoom(await request(config,'recordings/'+encodeURIComponent(d.recordingId)),d);d.recordingStatus=recording.status;
  const asset=(recording.recording_assets||[]).find(a=>a.type==='room-composite'&&a.status==='completed'&&providerId(a.id));
  if(recording.status==='completed'&&asset){d.assetId=asset.id;d.state=d.outcome||'completed';d.driveArchive={state:'queued',retryAt:0,attempts:0};d.error=d.state==='completed'?'':d.error;}
  else if(recording.status==='failed'||time-d.finishedAt>=30*60000){d.state='interrupted';d.error='Bản ghi chưa xử lý thành công. Chưa có kết quả để chấm.';}
 }
}
