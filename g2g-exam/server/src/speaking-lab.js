import crypto from 'node:crypto';
import {query,withTx,appError} from './db.js';
import {requireUser,requireRole} from './auth.js';
import {readHmsConfig,saveHmsConfig,hmsRequest,hmsToken,hmsPresence} from './speaking-hms.js';
import {validateTrial,trialView,canManage,isPhone} from '../../src/speaking/model.js';

const terminal=['completed','cancelled','interrupted'];
async function persist(c,row){await c.query('UPDATE speaking_lab_sessions SET data=$2::jsonb,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(row.data)]);}
async function locked(id,user,fn){return withTx(async c=>{
 const r=await c.query('SELECT * FROM speaking_lab_sessions WHERE id=$1 FOR UPDATE',[id]),row=r.rows[0];
 if(!row)throw appError(404,'Không tìm thấy ca thử.');
 trialView(row,user);const result=await fn(row,c);await persist(c,row);return result??trialView(row,user);
});}
function phone(request){if(!isPhone(request.headers['user-agent']))throw appError(400,'Phần thi Nói chỉ mở trên điện thoại. Quét QR để tiếp tục.');}
function member(row,user){if(!row.data.members.some(m=>m.id===user.id))throw appError(403,'Bạn không phải thí sinh trong ca này.');}
function joinWindow(d){const time=Date.now(),scheduled=Date.parse(d.scheduledAt);if(time<scheduled-15*60000||time>scheduled+90*60000||terminal.includes(d.state)||['finishing','processing'].includes(d.state))throw appError(409,'Phòng chỉ mở từ 15 phút trước lịch thi và đóng chậm nhất sau lịch 90 phút.');}
export function registerSpeakingLabRoutes(app){
 app.get('/api/speaking-lab/accounts',async request=>{
  await requireRole(request,'teacher','master');
  const text=String(request.query.q||'').trim().slice(0,120);
  if(text.length<2)return {accounts:[]};
  const pattern='%'+text.replace(/[\\%_]/g,'\\$&')+'%';
  const result=await query(`SELECT email,data->>'name' AS name FROM users WHERE active=true AND (email ILIKE $1 OR data->>'name' ILIKE $1) ORDER BY lower(email) LIMIT 10`,[pattern]);
  return {accounts:result.rows};
 });
 // All writes require the application's same origin, including staff-only secret settings.
 app.addHook('preHandler',async request=>{
  if(request.method==='POST'&&request.url.startsWith('/api/speaking-lab/')){
   const origin=new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin;
   if(request.headers.origin!==origin)throw appError(403,'Nguồn yêu cầu không hợp lệ.');
  }
 });
 app.get('/api/speaking-lab/config',async request=>{
  await requireRole(request,'teacher','master');const c=await readHmsConfig();
  return {configured:!!c,templateId:c?.templateId||'',role:c?.role||''};
 });
 app.post('/api/speaking-lab/config',async request=>{
  const user=await requireRole(request,'master');
  const active=await query(`SELECT id FROM speaking_lab_sessions WHERE data->>'roomId' IS NOT NULL AND data->>'state' NOT IN ('completed','cancelled','interrupted') LIMIT 1`);
  if(active.rows.length)throw appError(409,'Hãy kết thúc các phòng đang mở trước khi thay cấu hình.');
  return saveHmsConfig(request.body||{},user);
 });
 app.get('/api/speaking-lab/sessions',async request=>{
  const user=await requireRole(request,'teacher','master');
  const r=await query(`SELECT id,data->>'title' AS title,data->>'scheduledAt' AS scheduled_at,data->>'mode' AS mode,data->>'state' AS state,data->'members' AS members,updated_at FROM speaking_lab_sessions WHERE ($1::boolean OR owner_id=$2) ORDER BY created_at DESC LIMIT 100`,[user.role==='master',user.id]);
  return {sessions:r.rows};
 });
 app.post('/api/speaking-lab/sessions',async request=>{
  const user=await requireRole(request,'teacher','master'),input=validateTrial(request.body||{});
  return withTx(async c=>{
   // Serialize scheduling to reject collisions even for concurrent teachers.
   await c.query("SELECT pg_advisory_xact_lock(hashtext('g2g-speaking-lab-schedule'))");
   const accounts=await c.query('SELECT id,email,role,data FROM users WHERE lower(email)=ANY($1::text[]) AND active=true',[input.emails]);
   if(accounts.rows.length!==2)throw appError(400,'Hai tài khoản phải đăng nhập web ít nhất một lần và đang hoạt động.');
   const members=input.emails.map((email,i)=>{const u=accounts.rows.find(x=>x.email.toLowerCase()===email);return {id:u.id,name:u.data?.name||u.email,seat:i===0?'A':'B'};});
   const existing=await c.query(`SELECT data FROM speaking_lab_sessions WHERE data->>'state' NOT IN ('completed','cancelled','interrupted')`);
   if(existing.rows.length>=24)throw appError(409,'Khu thử giới hạn 24 ca chưa kết thúc.');
   const end=Date.parse(input.scheduledAt)+90*60000,start=Date.parse(input.scheduledAt)-15*60000;
   if(existing.rows.some(r=>r.data.members.some(m=>members.some(n=>n.id===m.id))&&Date.parse(r.data.scheduledAt)-15*60000<end&&Date.parse(r.data.scheduledAt)+90*60000>start))throw appError(409,'Một thí sinh đã có ca trùng khung giờ. Hãy đổi lịch hoặc huỷ ca cũ.');
   const id=crypto.randomUUID(),data={title:input.title,mode:input.mode,scheduledAt:input.scheduledAt,members,stages:input.stages,state:'scheduled',ready:{},votes:{},reviews:{},markers:[]};
   await c.query('INSERT INTO speaking_lab_sessions(id,owner_id,data) VALUES($1,$2,$3::jsonb)',[id,user.id,JSON.stringify(data)]);
   return {id};
  });
 });
 app.get('/api/speaking-lab/sessions/:id',async request=>{
  const user=await requireUser(request),r=await query('SELECT * FROM speaking_lab_sessions WHERE id=$1',[request.params.id]);
  if(!r.rows[0])throw appError(404,'Không tìm thấy ca thử.');return trialView(r.rows[0],user);
 });
 app.post('/api/speaking-lab/sessions/:id/join',async request=>{
  const user=await requireUser(request);phone(request);
  return locked(request.params.id,user,async(row,c)=>{
   const d=row.data;member(row,user);joinWindow(d);const config=await readHmsConfig();
   if(!config)throw appError(503,'Quản trị viên chưa kết nối 100ms.');
   if(!d.roomId){
    await c.query("SELECT pg_advisory_xact_lock(hashtext('g2g-speaking-lab-open'))");
    const count=await c.query(`SELECT id FROM speaking_lab_sessions WHERE data->>'roomId' IS NOT NULL AND data->>'state' NOT IN ('completed','cancelled','interrupted')`);
    if(count.rows.length>=4)throw appError(409,'Khu thử chỉ mở tối đa 4 phòng cùng lúc.');
    const room=await hmsRequest(config,'rooms',{method:'POST',body:{name:'g2g-speaking-'+row.id,description:'Isolated G2G speaking trial',template_id:config.templateId,max_duration_seconds:3600}});
    if(!/^[a-zA-Z0-9_-]+$/.test(room.id||''))throw appError(502,'100ms chưa trả mã phòng hợp lệ.');
    d.roomId=room.id;d.state='waiting';d.roomOpenedAt=Date.now();
   }
   const presence=await hmsPresence(config,d.roomId,d.members);
   if(presence.find(p=>p.id===user.id)?.devices>0)throw appError(409,'Tài khoản đang vào phòng trên thiết bị khác. Thoát phòng cũ hoặc đợi kết nối cũ đóng rồi thử lại.');
   d.ready[user.id]=false;
   const token=hmsToken(config,{type:'app',room_id:d.roomId,role:config.role,user_id:user.id,exp:Math.floor((Date.parse(d.scheduledAt)+90*60000)/1000)});
   return {token,name:d.members.find(m=>m.id===user.id).name};
  });
 });
 app.post('/api/speaking-lab/sessions/:id/ready',async request=>{
  const user=await requireUser(request);phone(request);
  return locked(request.params.id,user,async row=>{
   member(row,user);joinWindow(row.data);
   if(!['waiting','starting'].includes(row.data.state))throw appError(409,'Ca thi không ở bước sẵn sàng.');
   if(request.body?.consent!==true)throw appError(400,'Cần đồng ý ghi hình trước khi thi.');
   const presence=await hmsPresence(await readHmsConfig(),row.data.roomId,row.data.members),p=presence.find(x=>x.id===user.id);
   if(!p?.connected||!p.audio||!p.video)throw appError(409,'Chưa nhận đủ camera và micro của bạn. Kiểm tra thiết bị rồi thử lại.');
   row.data.ready[user.id]=true;
  });
 });
 app.post('/api/speaking-lab/sessions/:id/next',async request=>{
  const user=await requireUser(request);phone(request);
  return locked(request.params.id,user,async row=>{
   member(row,user);const d=row.data;
   if(d.state!=='running'||request.body?.stageIndex!==d.stageIndex)throw appError(409,'Phần thi đã thay đổi. Hãy kiểm tra màn hình hiện tại.');
   d.votes[user.id]=true;
  });
 });
 app.post('/api/speaking-lab/sessions/:id/end',async request=>{
  const user=await requireRole(request,'teacher','master');
  return locked(request.params.id,user,async row=>{
   if(!canManage(user,row))throw appError(403,'Không có quyền điều phối ca này.');
   if(terminal.includes(row.data.state))return;
   row.data.outcome='cancelled';row.data.state=row.data.roomId?'finishing':'cancelled';
  });
 });
 app.post('/api/speaking-lab/sessions/:id/review',async request=>{
  const user=await requireRole(request,'teacher','master');
  return locked(request.params.id,user,async row=>{
   if(!canManage(user,row))throw appError(403,'Không có quyền nhận xét ca này.');
   if(!['completed','interrupted'].includes(row.data.state))throw appError(409,'Chờ kết thúc và xử lý bản ghi trước khi nhận xét.');
   const reviews={};for(const m of row.data.members){const note=String(request.body?.reviews?.[m.id]||'').trim();if(note.length>10000)throw appError(400,'Nhận xét quá dài.');reviews[m.id]=note;}
   row.data.reviews=reviews;row.data.reviewedBy=user.id;
  });
 });
 app.get('/api/speaking-lab/sessions/:id/recording',async(request,reply)=>{
  const user=await requireRole(request,'teacher','master'),r=await query('SELECT * FROM speaking_lab_sessions WHERE id=$1',[request.params.id]),row=r.rows[0];
  if(!row||!canManage(user,row))throw appError(404,'Không tìm thấy bản ghi.');
  if(!row.data.assetId)throw appError(409,'Bản ghi chưa sẵn sàng.');
  const result=await hmsRequest(await readHmsConfig(),'recording-assets/'+encodeURIComponent(row.data.assetId)+'/presigned-url?presign_duration=900');
  if(!result.url||new URL(result.url).protocol!=='https:')throw appError(502,'100ms chưa trả liên kết video hợp lệ.');
  return reply.redirect(result.url);
 });
}

export function beginStage(d,index,time){
 if(d.markers.length)d.markers.at(-1).end=time;
 if(index>=d.stages.length){d.outcome='completed';d.state='finishing';return;}
 d.state='running';d.stageIndex=index;d.deadline=time+d.stages[index].seconds*1000;d.votes={};
 d.markers.push({title:d.stages[index].title,start:time,end:null});
}
export async function tickTrial(d,config,time=Date.now()){
 if(terminal.includes(d.state))return;
 if(!['finishing','processing'].includes(d.state)&&(time>Date.parse(d.scheduledAt)+90*60000||d.roomOpenedAt&&time>d.roomOpenedAt+55*60000)){d.outcome='interrupted';d.error='Đã hết thời gian mở phòng thử.';d.state=d.roomId?'finishing':'interrupted';}
 if(!d.roomId)return;
 if(['waiting','starting','running','paused'].includes(d.state)){
  try{d.presence=await hmsPresence(config,d.roomId,d.members);}
  catch(error){
   if(!error.providerRetryable)throw error;
   d.presenceFailureAt??=time;
   if(d.state==='running'){d.remaining=Math.max(0,d.deadline-time);d.pausedAt=time;d.state='paused';d.votes={};}
   d.error='Đang kiểm tra lại kết nối 100ms. Vui lòng giữ phòng mở.';
   if(time-d.presenceFailureAt<5*60000)return;
   throw error;
  }
  if(d.presenceFailureAt){delete d.presenceFailureAt;delete d.error;}
  const present=d.presence.every(p=>p.connected&&p.audio&&p.video);
  if(d.state==='waiting'&&time>=Date.parse(d.scheduledAt)&&present&&d.members.every(m=>d.ready[m.id])){
   // Persist the job id and wait for running; never reveal a prompt on a mere start acknowledgement.
   d.recordingRequestedAt=time;
   const recording=await hmsRequest(config,`recordings/room/${d.roomId}/start`,{method:'POST',body:{destination:config.recordingDestination,resolution:{width:1280,height:720},transcription:{enabled:false}}});
   d.recordingId=recording.id;d.recordingStatus=recording.status;d.state='starting';d.recordingRequestedAt=time;
   if(!d.recordingId)throw appError(502,'100ms chưa trả mã bản ghi.');
  }
  if(['starting','running','paused'].includes(d.state)){
   const recording=await hmsRequest(config,'recordings/'+encodeURIComponent(d.recordingId));d.recordingStatus=recording.status;
   if(d.state==='starting'){
    if(recording.status==='running'&&present){d.recordingStartedAt=Date.parse(recording.started_at)||time;beginStage(d,0,time);}
    else if(recording.status==='failed'||time-d.recordingRequestedAt>90000){d.outcome='interrupted';d.error='Không thể bắt đầu ghi hình. Hãy hẹn ca thử mới.';d.state='finishing';}
   }else if(recording.status!=='running'){
    d.outcome='interrupted';d.error='Ghi hình bị gián đoạn. Ca thử đã dừng để tránh thiếu bài.';d.state='finishing';
   }else if(!present){
    if(d.state==='running'){d.remaining=Math.max(0,d.deadline-time);d.pausedAt=time;d.state='paused';d.votes={};}
    if(time-d.pausedAt>=5*60000){d.outcome='interrupted';d.error='Không khôi phục đủ camera/micro trong 5 phút.';d.state='finishing';}
   }else if(d.state==='paused'){d.deadline=time+d.remaining;delete d.remaining;d.state='running';}
   else if(time>=d.deadline||d.members.every(m=>d.votes[m.id]))beginStage(d,d.stageIndex+1,time);
  }
 }
 if(d.state==='finishing'){
  // Stop first, then disable the room. Retry this state after provider failures.
  const results=await Promise.allSettled([
   !d.recordingStopped&&(d.recordingId||d.recordingRequestedAt)?hmsRequest(config,`recordings/room/${d.roomId}/stop`,{method:'POST',missing:true}):Promise.resolve(),
   hmsRequest(config,`active-rooms/${d.roomId}/end-room`,{method:'POST',body:{reason:'G2G trial finished',lock:true},missing:true}),
   hmsRequest(config,`rooms/${d.roomId}`,{method:'POST',body:{enabled:false}})
  ]);
  if(results[0].status==='fulfilled')d.recordingStopped=true;
  if(results.some(r=>r.status==='rejected'))throw appError(502,'Chưa xác nhận đóng phòng.');
  d.state=d.recordingId?'processing':d.outcome||'interrupted';d.finishedAt=time;
  if(d.markers.length&&!d.markers.at(-1).end)d.markers.at(-1).end=time;
 }
 if(d.state==='processing'){
  const recording=await hmsRequest(config,'recordings/'+encodeURIComponent(d.recordingId));d.recordingStatus=recording.status;
  if(recording.status==='completed'){
   const asset=(recording.recording_assets||[]).find(a=>a.type==='room-composite'&&a.status==='completed');
   if(asset){d.assetId=asset.id;d.state=d.outcome||'completed';}
   else if(time-d.finishedAt>30*60000){d.state='interrupted';d.error='Bản ghi chưa có video hoàn chỉnh. Kiểm tra trên 100ms.';}
  }else if(recording.status==='failed'||time-d.finishedAt>30*60000){d.state='interrupted';d.error='Xử lý bản ghi thất bại hoặc quá thời gian. Kiểm tra trên 100ms.';}
 }
}
export function startSpeakingLabWorker(app){
 let busy=false;
 const tick=async()=>{
  if(busy)return;busy=true;
  try{
   const candidates=await query(`SELECT id FROM speaking_lab_sessions WHERE data->>'state' NOT IN ('completed','cancelled','interrupted') AND (data->>'roomId' IS NOT NULL OR (data->>'scheduledAt')::timestamptz < now()-interval '90 minutes') ORDER BY created_at LIMIT 24`);
   if(!candidates.rows.length)return;const config=await readHmsConfig();
   for(const item of candidates.rows)await withTx(async c=>{
    const result=await c.query('SELECT * FROM speaking_lab_sessions WHERE id=$1 FOR UPDATE SKIP LOCKED',[item.id]),row=result.rows[0];if(!row)return;
    if(row.data.retryAt>Date.now())return;
    try{
     const active=await c.query('SELECT id FROM users WHERE id=ANY($1::text[]) AND active=true',[row.data.members.map(m=>m.id)]);
     if(active.rows.length!==2&&!['finishing','processing'].includes(row.data.state)){row.data.outcome='interrupted';row.data.error='Một tài khoản đã bị vô hiệu hoá.';row.data.state=row.data.roomId?'finishing':'interrupted';}
     await tickTrial(row.data,config);delete row.data.retryAt;
    }
    catch(error){row.data.error='Không xác nhận được trạng thái 100ms. Hệ thống đang dừng/đóng phòng an toàn; quản trị viên kiểm tra kết nối.';row.data.outcome='interrupted';row.data.state=row.data.roomId?'finishing':'interrupted';row.data.retryAt=Date.now()+15000;app.log.warn({operation:error.providerOperation,status:error.providerStatus},'Speaking lab provider request failed; cleanup will retry.');}
    await persist(c,row);
   });
  }catch{app.log.warn('Speaking lab worker unavailable; will retry.');}finally{busy=false;}
 };
 const timer=setInterval(tick,5000);timer.unref();tick();app.addHook('onClose',async()=>clearInterval(timer));
}
