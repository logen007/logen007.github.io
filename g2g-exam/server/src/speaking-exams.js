import crypto from 'node:crypto';
import {query,withTx,appError,audit,getSettings} from './db.js';
import {requireUser,requireRole} from './auth.js';
import {createExamRelease} from './exam-releases.js';
import {readHmsConfig,hmsRequest,hmsPresence,hmsToken} from './speaking-hms.js';
import {streamDriveRecording} from './speaking-drive.js';
import {isSpeakingExam,normalizeSpeakingConfig,speakingExamErrors,validateSpeakingReview,speakingPublishedResult,speakingSessionView,SPEAKING_CLASS_PRIORITY_SECONDS,speakingPreparationSeconds} from '../../src/speaking/exam-model.js';
import {SPEAKING_EXAM_TERMINAL,SPEAKING_ROOM_CAPACITY_LOCK,finishSpeakingSession,tickSpeakingExam} from './speaking-exam-runtime.js';

const LEVELS=new Set(['A1','A2','B1','B2','C1','C2']),QUEUE_TTL=120000,LEASE_MS=120000;
const MATCH_LOCK='g2g-speaking-exam-match';
const examView=row=>({...row.data,id:row.id,ownerId:row.owner_id,status:row.status,locked:row.status==='published'});
const staff=(user,row)=>user.role==='master'||user.role==='teacher'&&row.owner_id===user.id;
const member=(user,row)=>row.data.members.some(m=>m.id===user.id);
const origin=request=>{if(request.headers.origin!==new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin)throw appError(403,'Nguồn yêu cầu không hợp lệ.');};
const queueOrigin=request=>{
 if(request.headers.origin)return origin(request);
 if(request.headers['sec-fetch-site']==='same-origin')return;
 try{if(new URL(request.headers.referer).origin===new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin)return;}catch{}
 throw appError(403,'Nguồn yêu cầu không hợp lệ.');
};
const phone=request=>{if(!/iPhone|Android.+Mobile/i.test(request.headers['user-agent']||''))throw appError(400,'Vui lòng dùng điện thoại để tham gia bài thi nói.');};
const conflict=()=>appError(409,'Nội dung đã thay đổi. Hãy tải lại trước khi tiếp tục.');
const safeName=row=>String(row.data?.name||row.email||'Học viên').slice(0,120);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const pageOffset=input=>{const offset=Number(input?.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw appError(400,'Trang kết quả không hợp lệ.');return offset;};

export function createSpeakingExamService(options={}){
 const db=options.db||{query,withTx},clock=options.now||Date.now;
 const provider={readConfig:readHmsConfig,request:hmsRequest,presence:hmsPresence,token:hmsToken,stream:streamDriveRecording,...options.provider};
 const release=options.createRelease||createExamRelease,writeAudit=options.audit||audit;
 async function owned(c,user,id,lock=false){
  const row=(await c.query('SELECT * FROM exams WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!row||row.status==='trash'||!isSpeakingExam(row.data))throw appError(404,'Không tìm thấy đề nói.');
  if(!staff(user,row))throw appError(403,'Chỉ người soạn đề hoặc quản trị viên được quản lý đề này.');
  return row;
 }
 async function session(c,user,id,lock=false){
  const row=(await c.query('SELECT * FROM speaking_exam_sessions WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!row)throw appError(404,'Không tìm thấy bài thi nói.');
  if(!staff(user,row)&&!member(user,row))throw appError(403,'Bạn không có quyền xem bài thi này.');
  return row;
 }
 async function save(c,row,{lease=false}={}){
  row.data.revision=(row.data.revision||0)+1;
  const result=await c.query('UPDATE speaking_exam_sessions SET state=$2,data=$3::jsonb,updated_at=now() WHERE id=$1'+(lease?" AND data->'runtimeLease'->>'id'=$4":'')+' RETURNING id',[row.id,row.data.state,JSON.stringify(row.data),...(lease?[row.data.runtimeLease.id]:[])]);
  if(!result.rows.length)throw conflict();
  if(SPEAKING_EXAM_TERMINAL.has(row.data.state)||row.data.state==='processing'&&row.data.roomClosed)await c.query('UPDATE speaking_exam_members SET active=false WHERE session_id=$1',[row.id]);
 }
 function editable(row){if(row.status!=='draft')throw appError(409,'Bỏ xuất bản trước khi chỉnh sửa đề nói.');}
 function titleLevel(input){
  const title=String(input?.title||'').trim(),level=String(input?.level||'');
  if(!title||title.length>200||!LEVELS.has(level))throw appError(400,'Tên đề tối đa 200 ký tự và cần chọn trình độ hợp lệ.');
  const provider=input?.provider==null?null:String(input.provider).toUpperCase();
  if(provider!==null&&!['GOETHE','TELC','FID'].includes(provider))throw appError(400,'Loại đề không hợp lệ.');
  return {title,level,provider};
 }
 async function insert(c,user,input,extra={}){
  const values=titleLevel(input),id='exam-'+crypto.randomUUID(),time=new Date(clock()).toISOString();
  const exam={...values,kind:'speaking',learningLevel:null,sections:[],speaking:{stages:[]},status:'draft',version:1,ownerId:user.id,ownerName:user.name||'',hidden:false,locked:false,createdAt:time,updatedAt:time,...extra,id};
  await c.query("INSERT INTO exams(id,owner_id,status,data) VALUES($1,$2,'draft',$3::jsonb)",[id,user.id,JSON.stringify(exam)]);
  await writeAudit(user,'create_speaking','exam',id,{},c);return {exam};
 }
 async function create(user,input){return db.withTx(c=>insert(c,user,input));}
 async function get(user,id){return {exam:examView(await owned(db,user,id))};}
 async function copy(user,id){return db.withTx(async c=>{const source=await owned(c,user,id,true);return insert(c,user,{title:(source.data.title+' - Copy').slice(0,200),level:source.data.level,provider:source.data.provider},{speaking:structuredClone(source.data.speaking),copiedFrom:id});});}
 async function update(user,id,input){return db.withTx(async c=>{
  const row=await owned(c,user,id,true);editable(row);
  const values=titleLevel({...input.exam,provider:input.exam?.provider??row.data.provider});let speaking;
  try{speaking=normalizeSpeakingConfig(input.exam?.speaking);}catch(error){throw appError(400,error.message);}
  if(!Number.isInteger(input?.version)||input.version!==Number(row.data.version||1)){
   if(input?.version===Number(row.data.version||1)-1&&equal({...values,speaking},{title:row.data.title,level:row.data.level,provider:row.data.provider??null,speaking:row.data.speaking}))return {exam:examView(row)};
   throw conflict();
  }
  row.data={...row.data,...values,speaking,kind:'speaking',learningLevel:null,sections:[],hidden:false,status:'draft',locked:false,version:input.version+1,updatedAt:new Date(clock()).toISOString()};
  await c.query('UPDATE exams SET data=$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(row.data)]);
  return {exam:examView(row)};
 });}
 async function publish(user,id,input={}){return db.withTx(async c=>{
  const row=await owned(c,user,id,true);
  if(row.status==='published')return {exam:examView(row)};
  if(input.version!==undefined&&input.version!==Number(row.data.version||1))throw conflict();
  const errors=speakingExamErrors(examView(row));if(errors.length)throw appError(400,errors.join('\n'));
  const receipt=await release(c,row);
  row.status='published';row.data={...row.data,status:'published',publicationVersion:receipt.publicationVersion,publicationLabel:receipt.version,version:Number(row.data.version||1)+1,updatedAt:new Date(clock()).toISOString()};
  await c.query('UPDATE exams SET data=$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(row.data)]);
  await writeAudit(user,'publish_speaking','exam',id,{publicationVersion:receipt.publicationVersion},c);
  return {...receipt,snapshot:undefined,exam:examView(row)};
 });}
 async function unpublish(user,id,input={}){return db.withTx(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[MATCH_LOCK]);
  const row=await owned(c,user,id,true);if(row.status==='draft')return {exam:examView(row)};
  if(input.version!==undefined&&input.version!==Number(row.data.version||1))throw conflict();
  row.status='draft';row.data={...row.data,status:'draft',locked:false,version:Number(row.data.version||1)+1,updatedAt:new Date(clock()).toISOString()};
  await c.query("UPDATE exams SET status='draft',data=$2::jsonb,updated_at=now() WHERE id=$1",[id,JSON.stringify(row.data)]);
  await c.query('DELETE FROM speaking_exam_queue WHERE exam_id=$1',[id]);
  await writeAudit(user,'unpublish_speaking','exam',id,{},c);return {exam:examView(row)};
 });}
 async function activeSession(c,user){return (await c.query('SELECT s.* FROM speaking_exam_members m JOIN speaking_exam_sessions s ON s.id=m.session_id WHERE m.student_id=$1 AND m.active=true FOR UPDATE OF s',[user.id])).rows[0]||null;}
 async function queueAction(user,examId,{cancel=false}={}){
  if(user.role!=='student')throw appError(403,'Chỉ học viên được tìm bạn thi.');
  return db.withTx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[MATCH_LOCK]);const time=clock();
   await c.query('DELETE FROM speaking_exam_queue WHERE expires_at<=$1',[time]);
   const active=await activeSession(c,user);
   if(active)return {queue:null,session:speakingSessionView(active,user,time)};
   if(cancel){await c.query('DELETE FROM speaking_exam_queue WHERE student_id=$1',[user.id]);return {queue:null,session:null};}
   const settings=await (options.getSettings||getSettings)(c);
   if(settings.operations?.maintenanceMode)throw appError(409,settings.operations.maintenanceMessage||'Hệ thống đang bảo trì.');
   if(!await provider.readConfig(c))throw appError(503,'Phòng thi nói chưa được kết nối dịch vụ video. Vui lòng thử lại sau.');
   if(examId){
    const e=(await c.query('SELECT * FROM exams WHERE id=$1 FOR SHARE',[examId])).rows[0];
    if(!e||e.status!=='published'||!isSpeakingExam(e.data)||e.data.hidden===true)throw appError(404,'Đề nói chưa mở đăng ký.');
    const existing=(await c.query('SELECT * FROM speaking_exam_queue WHERE student_id=$1 FOR UPDATE',[user.id])).rows[0];
    if(existing&&(existing.exam_id!==examId||existing.publication_version!==e.data.publicationVersion))throw appError(409,'Bạn đang tìm bạn thi cho đề khác. Hãy hủy tìm trước.');
    const profile=(await c.query("SELECT * FROM users WHERE id=$1 AND role='student' AND active=true FOR SHARE",[user.id])).rows[0];
    if(!profile)throw appError(403,'Tài khoản học viên không hoạt động.');
    if(!user.canTestRoles&&!profile.data?.profileCompletedAt)throw appError(409,'Vui lòng hoàn tất họ tên và mã lớp trước khi thi.');
    await c.query(`INSERT INTO speaking_exam_queue(student_id,exam_id,publication_version,level,class_id,joined_at,heartbeat_at,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$6,$7) ON CONFLICT(student_id) DO UPDATE SET heartbeat_at=EXCLUDED.heartbeat_at,expires_at=EXCLUDED.expires_at`,[user.id,examId,e.data.publicationVersion,e.data.level,profile.data?.classId||null,time,time+QUEUE_TTL]);
   }
   let entry=(await c.query('SELECT q.* FROM speaking_exam_queue q JOIN exams e ON e.id=q.exam_id WHERE q.student_id=$1 AND e.status=\'published\' AND coalesce(e.data->>\'hidden\',\'false\')<>\'true\' AND (e.data->>\'publicationVersion\')::integer=q.publication_version FOR UPDATE OF q',[user.id])).rows[0];
   if(!entry){await c.query('DELETE FROM speaking_exam_queue WHERE student_id=$1',[user.id]);return {queue:null,session:null};}
   await c.query('UPDATE speaking_exam_queue SET heartbeat_at=$2,expires_at=$3 WHERE student_id=$1',[user.id,time,time+QUEUE_TTL]);
   const candidates=(await c.query(`SELECT q.*,u.data,u.email FROM speaking_exam_queue q JOIN users u ON u.id=q.student_id
    WHERE q.student_id<>$1 AND q.exam_id=$2 AND q.publication_version=$3 AND q.level=$4 AND q.expires_at>$5 AND u.active=true AND u.role='student'
    AND NOT EXISTS(SELECT 1 FROM speaking_exam_members m WHERE m.student_id=q.student_id AND m.active=true)
    ORDER BY CASE WHEN q.class_id=$6 AND q.class_id IS NOT NULL THEN 0 ELSE 1 END,q.joined_at,q.student_id FOR UPDATE OF q`,[user.id,entry.exam_id,entry.publication_version,entry.level,time,entry.class_id])).rows;
   const partner=candidates.find(q=>entry.class_id&&q.class_id===entry.class_id||time-entry.joined_at>=SPEAKING_CLASS_PRIORITY_SECONDS*1000&&time-q.joined_at>=SPEAKING_CLASS_PRIORITY_SECONDS*1000);
   if(!partner)return {queue:{state:'waiting',examId:entry.exam_id,joinedAt:entry.joined_at,serverNow:time,classPriorityUntil:entry.joined_at+SPEAKING_CLASS_PRIORITY_SECONDS*1000},session:null};
   const published=(await c.query('SELECT r.snapshot,e.owner_id FROM exam_releases r JOIN exams e ON e.id=r.exam_id WHERE r.exam_id=$1 AND r.version=$2 FOR SHARE OF e',[entry.exam_id,entry.publication_version])).rows[0];
   if(!published)throw appError(409,'Phiên bản đề nói không còn sẵn sàng.');
   const own=(await c.query('SELECT data,email FROM users WHERE id=$1',[user.id])).rows[0];
   const id='speaking-exam-'+crypto.randomUUID(),members=[{id:user.id,name:safeName(own),seat:'A',classId:entry.class_id},{id:partner.student_id,name:safeName(partner),seat:'B',classId:partner.class_id}];
   const data={id,examId:entry.exam_id,publicationVersion:entry.publication_version,examSnapshot:published.snapshot,members,state:'preparing',revision:1,matchedAt:time,prepDeadline:time+speakingPreparationSeconds(published.snapshot.speaking)*1000,ready:{},connectedConsent:{},stageIndex:-1,deadline:null,remaining:null,votes:{},presence:[],markers:[],reviews:{},recordingStatus:null};
   const row={id,owner_id:published.owner_id,exam_id:entry.exam_id,publication_version:entry.publication_version,state:'preparing',data};
   await c.query("INSERT INTO speaking_exam_sessions(id,owner_id,exam_id,publication_version,state,data) VALUES($1,$2,$3,$4,'preparing',$5::jsonb)",[id,row.owner_id,row.exam_id,row.publication_version,JSON.stringify(data)]);
   for(const m of members)await c.query('INSERT INTO speaking_exam_members(session_id,student_id,seat) VALUES($1,$2,$3)',[id,m.id,m.seat]);
   await c.query('DELETE FROM speaking_exam_queue WHERE student_id=ANY($1::text[])',[members.map(m=>m.id)]);
   return {queue:null,session:speakingSessionView(row,user,time)};
  });
 }
 async function mutate(user,id,action,input){return db.withTx(async c=>{
  const row=await session(c,user,id,true),d=row.data,time=clock();
  if(!member(user,row))throw appError(403,'Chỉ thí sinh được điều khiển bài thi.');
  if(action==='ready'){
   // Readiness only moves forward within this immutable pair. Both candidates
   // may act on the same displayed revision without making the other retry.
   if(!Number.isSafeInteger(input?.revision)||input.revision<1||input.revision>d.revision)throw conflict();
   if(d.ready?.[user.id]&&['preparing','joining'].includes(d.state))return speakingSessionView(row,user,time);
   if(d.state!=='preparing')throw conflict();
  }
  if(d.runtimeLease?.until>time)throw appError(409,'Đang cập nhật phòng thi. Vui lòng thử lại.');
  // Revoke an expired worker fence before a candidate write. A late provider
  // response must not overwrite a cancellation after its lease expired.
  delete d.runtimeLease;
  if(action==='leave'){
   if(!SPEAKING_EXAM_TERMINAL.has(d.state))finishSpeakingSession(d,d.state==='preparing'?'cancelled':'interrupted','Một thí sinh đã rời bài thi. Bạn có thể tìm bạn thi lại.',time);
  }else if(action==='ready'){
   d.ready[user.id]=true;
   if(time>=d.prepDeadline||d.members.every(m=>d.ready[m.id])){d.state='joining';d.joinDeadline=time+120000;}
  }else if(action==='connected'){
   if(!['joining','starting','running','paused'].includes(d.state)||!d.roomId)throw appError(409,'Phòng thi chưa sẵn sàng.');
   if(input?.consent!==true)throw appError(400,'Cần đồng ý ghi hình bài thi.');
   const found=await provider.presence(await provider.readConfig(),d.roomId,d.members),p=found.find(p=>p.id===user.id);
   if(!p?.connected||p.devices!==1||!p.audio||!p.video)throw appError(409,'Chưa nhận đủ camera và micro của bạn.');
   d.presence=found;d.connectedConsent[user.id]=true;
  }else if(action==='next'){
   if(d.state!=='running'||input?.stageIndex!==d.stageIndex)throw conflict();d.votes[user.id]=true;
  }
  await save(c,row);return speakingSessionView(row,user,time);
 });}
 async function join(user,id){
  const row=await session(db,user,id),d=row.data;
  if(!member(user,row))throw appError(403,'Chỉ thí sinh được vào phòng thi.');
  if(!['joining','starting','running','paused'].includes(d.state)||!d.roomId||d.roomDisabled||clock()>=d.roomOpenedAt+55*60000)throw appError(409,'Phòng video chưa sẵn sàng.');
  const config=await provider.readConfig();if(!config)throw appError(503,'Chưa kết nối dịch vụ video.');
  const peers=await provider.presence(config,d.roomId,d.members);
  if(peers.find(p=>p.id===user.id)?.devices>0)throw appError(409,'Tài khoản đang vào phòng trên thiết bị khác. Hãy thoát phòng cũ rồi thử lại.');
  return {token:provider.token(config,{type:'app',room_id:d.roomId,role:config.role,user_id:user.id,exp:Math.floor((d.roomOpenedAt+55*60000)/1000)}),name:d.members.find(m=>m.id===user.id).name};
 }
 async function view(user,id,{grading=false}={}){const row=await session(db,user,id);if(grading&&!staff(user,row))throw appError(403,'Không có quyền chấm bài thi này.');return speakingSessionView(row,user,clock());}
 async function reviews(user,input={}){
  const offset=pageOffset(input),found=(await db.query(`SELECT id,exam_id,publication_version,state,
   data->'examSnapshot'->>'title' AS title,data->'examSnapshot'->>'level' AS level,data->'members' AS members,data->'finishedAt' AS finished_at,
   data->'driveArchive'->>'state' AS archive_state,data->>'assetId' IS NOT NULL AND data->'driveArchive'->>'state'='saved' AS has_recording,
   COALESCE((SELECT jsonb_object_agg(m->>'id',jsonb_build_object('version',COALESCE(data->'reviews'->(m->>'id')->'version','0'::jsonb),'publishedAt',data->'reviews'->(m->>'id')->'publishedAt','complete',COALESCE(data->'reviews'->(m->>'id')->'complete','false'::jsonb))) FROM jsonb_array_elements(data->'members') m),'{}'::jsonb) AS review_meta
   FROM speaking_exam_sessions WHERE ($1::boolean OR owner_id=$2) ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $3`,[user.role==='master',user.id,offset])).rows,rows=found.slice(0,100);
  // List only metadata; private prompts and the full rubric load on grading GET.
  return {sessions:rows.map(row=>({id:row.id,examId:row.exam_id,title:row.title,level:row.level,publicationVersion:row.publication_version,state:row.state,members:row.members.map(({id,name,seat})=>({id,name,seat})),finishedAt:row.finished_at||null,hasRecording:Boolean(row.has_recording),archiveState:row.archive_state||null,reviews:row.review_meta})),nextOffset:found.length>100?offset+100:null};
 }
 async function review(user,id,studentId,input,{publish=false}={}){return db.withTx(async c=>{
  const row=await session(c,user,id,true),d=row.data;if(!staff(user,row))throw appError(403,'Không có quyền chấm bài thi này.');
  if(d.state!=='completed'||!d.assetId||d.driveArchive?.state!=='saved')throw appError(409,'Chỉ chấm khi bài thi hoàn tất và video đã được lưu an toàn.');
  if(!d.members.some(m=>m.id===studentId))throw appError(404,'Không tìm thấy thí sinh.');
  const previous=d.reviews?.[studentId]||{version:0};
  if(!Number.isInteger(input?.version)||input.version!==previous.version){
   if(input?.version===previous.version-1){
    if(publish&&previous.publishedAt)return {review:previous};
    if(!publish&&!previous.publishedAt){let requested;try{requested=validateSpeakingReview(d.examSnapshot.speaking,input?.review);}catch(error){throw appError(400,error.message);}if(equal(requested,{scores:previous.scores,feedback:previous.feedback,total:previous.total,maxScore:previous.maxScore,complete:previous.complete}))return {review:previous};}
   }
   throw conflict();
  }
  if(previous.publishedAt){if(publish)return {review:previous};throw appError(409,'Điểm đã công bố không thể chỉnh sửa.');}
  let validated;try{validated=validateSpeakingReview(d.examSnapshot.speaking,publish?previous:input?.review,{complete:publish});}catch(error){throw appError(400,error.message);}
  const next={...validated,version:previous.version+1,reviewerId:user.id,reviewerName:user.name||'',updatedAt:clock(),publishedAt:publish?clock():null};
  d.reviews={...d.reviews,[studentId]:next};await save(c,row);
  await writeAudit(user,publish?'publish_speaking_grade':'save_speaking_grade','speaking_exam_session',id,{studentId,version:next.version},c);return {review:next};
 });}
 async function results(user,input={}){
  if(user.role!=='student')throw appError(403,'Chỉ học viên được xem kết quả của mình.');
  const offset=pageOffset(input),found=(await db.query(`SELECT s.id,s.exam_id,s.publication_version,s.data->'examSnapshot'->>'title' AS title,s.data->'examSnapshot'->>'level' AS level,s.data->'finishedAt' AS finished_at,
   s.data->'reviews'->$1 AS own_review,jsonb_build_object('stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('criteria',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',criterion->'id','maxScore',criterion->'maxScore')) FROM jsonb_array_elements(part->'criteria') criterion),'[]'::jsonb))) FROM jsonb_array_elements(s.data->'examSnapshot'->'speaking'->'stages') part),'[]'::jsonb)) AS rubric
   FROM speaking_exam_sessions s JOIN speaking_exam_members m ON m.session_id=s.id WHERE m.student_id=$1 AND s.data->'reviews'->$1->>'publishedAt' IS NOT NULL ORDER BY s.created_at DESC,s.id DESC LIMIT 101 OFFSET $2`,[user.id,offset])).rows,rows=found.slice(0,100);
  return {results:rows.flatMap(row=>{const result=speakingPublishedResult(row.rubric,row.own_review);return result?[{sessionId:row.id,examId:row.exam_id,title:row.title,level:row.level,publicationVersion:row.publication_version,finishedAt:row.finished_at,...result}]:[];}),nextOffset:found.length>100?offset+100:null};
 }
 async function recording(user,id,request,reply){const row=await session(db,user,id);if(!staff(user,row))throw appError(403,'Không có quyền xem bản ghi.');if(!row.data.assetId||row.data.driveArchive?.state!=='saved')throw appError(409,'Video đang được lưu. Vui lòng thử lại sau.');return provider.stream(row.data.driveArchive.fileId,request,reply);}
 return {db,clock,provider,owned,session,save,create,get,copy,update,publish,unpublish,queueAction,mutate,join,view,reviews,review,results,recording};
}

export function registerSpeakingExamRoutes(app,options={}){
 const service=createSpeakingExamService(options),auth={requireUser,requireRole,...options.auth};
 const teacher=request=>auth.requireRole(request,'teacher','master');
 app.addHook('onRequest',async(request,reply)=>{if(request.url.split('?')[0].startsWith('/api/speaking-exams')){reply.header('Cache-Control','private, no-store');if(!['GET','HEAD','OPTIONS'].includes(request.method))origin(request);}});
 app.post('/api/speaking-exams',async r=>service.create(await teacher(r),r.body));
 app.get('/api/speaking-exams/queue',async r=>{const user=await auth.requireUser(r);queueOrigin(r);phone(r);return service.queueAction(user);});
 app.post('/api/speaking-exams/queue/cancel',async r=>service.queueAction(await auth.requireUser(r),null,{cancel:true}));
 app.get('/api/speaking-exams/reviews',async r=>service.reviews(await teacher(r),r.query));
 app.get('/api/speaking-exams/results',async r=>service.results(await auth.requireUser(r),r.query));
 app.get('/api/speaking-exams/sessions/:id',async r=>{const user=await auth.requireUser(r);if(user.role==='student')phone(r);return service.view(user,r.params.id);});
 app.get('/api/speaking-exams/sessions/:id/grading',async r=>service.view(await teacher(r),r.params.id,{grading:true}));
 app.post('/api/speaking-exams/sessions/:id/join',async r=>{phone(r);return service.join(await auth.requireUser(r),r.params.id);});
 for(const action of ['ready','connected','next','leave'])app.post('/api/speaking-exams/sessions/:id/'+action,async r=>{if(action!=='leave')phone(r);return service.mutate(await auth.requireUser(r),r.params.id,action,r.body);});
 app.put('/api/speaking-exams/sessions/:id/review/:studentId',async r=>service.review(await teacher(r),r.params.id,r.params.studentId,r.body));
 app.post('/api/speaking-exams/sessions/:id/review/:studentId/publish',async r=>service.review(await teacher(r),r.params.id,r.params.studentId,r.body,{publish:true}));
 app.get('/api/speaking-exams/sessions/:id/recording',async(r,reply)=>service.recording(await teacher(r),r.params.id,r,reply));
 app.post('/api/speaking-exams/:examId/queue',async r=>{phone(r);return service.queueAction(await auth.requireUser(r),r.params.examId);});
 app.get('/api/speaking-exams/:examId',async r=>service.get(await teacher(r),r.params.examId));
 app.put('/api/speaking-exams/:examId',async r=>service.update(await teacher(r),r.params.examId,r.body));
 app.post('/api/speaking-exams/:examId/copy',async r=>service.copy(await teacher(r),r.params.examId));
 app.post('/api/speaking-exams/:examId/publish',async r=>service.publish(await teacher(r),r.params.examId,r.body));
 app.post('/api/speaking-exams/:examId/unpublish',async r=>service.unpublish(await teacher(r),r.params.examId,r.body));
 return service;
}

export async function runSpeakingExamWorkerOnce(options={}){
 const service=createSpeakingExamService(options),{db,clock,provider}=service,time=clock();
 // Queue leases are real expiries even when nobody polls.
 await db.query('DELETE FROM speaking_exam_queue WHERE expires_at<=$1',[time]);
 const ids=(await db.query("SELECT id FROM speaking_exam_sessions WHERE (state NOT IN ('completed','cancelled','interrupted') OR (data->>'recordingId' IS NOT NULL AND data->>'assetId' IS NULL AND COALESCE(data->>'recordingStatus','')<>'failed')) AND (state<>'preparing' OR (data->>'prepDeadline')::bigint<=$1) AND COALESCE((data->'runtimeLease'->>'until')::bigint,0)<=$1 AND COALESCE((data->>'retryAt')::bigint,0)<=$1 ORDER BY CASE WHEN data->>'roomId' IS NOT NULL AND state IN ('joining','starting','running','paused','finishing') THEN 0 ELSE 1 END,updated_at,id LIMIT 24",[time])).rows;
 let count=0;
 for(const {id} of ids){
  const row=await db.withTx(async c=>{
   const found=(await c.query('SELECT * FROM speaking_exam_sessions WHERE id=$1 FOR UPDATE SKIP LOCKED',[id])).rows[0];
   if(!found||SPEAKING_EXAM_TERMINAL.has(found.state)&&(!found.data.recordingId||found.data.assetId||found.data.recordingStatus==='failed')||found.data.runtimeLease?.until>clock())return null;
   found.data.runtimeLease={id:crypto.randomUUID(),until:clock()+LEASE_MS};await service.save(c,found);return found;
  });
  if(!row)continue;count++;
  const checkpoint=async()=>{row.data.runtimeLease.until=clock()+LEASE_MS;await service.save(db,row,{lease:true});};
  const reserveRoom=async()=>db.withTx(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[SPEAKING_ROOM_CAPACITY_LOCK]);
   const capacity=(await c.query(`SELECT (SELECT count(*) FROM speaking_lab_sessions WHERE data->>'roomId' IS NOT NULL AND data->>'state' NOT IN ('completed','cancelled','interrupted'))+
    (SELECT count(*) FROM speaking_exam_sessions WHERE id<>$1 AND (data->>'roomReserved'='true' OR (data->>'roomId' IS NOT NULL AND COALESCE(data->>'roomClosed','false')<>'true'))) AS n`,[row.id])).rows[0];
   if(Number(capacity.n)>=4)return false;
   // Config changes hold the same lock and reject reserved rooms. Read only
   // after acquiring it so allocation and every later tick use one connection.
   const config=await provider.readConfig(c);if(!config)throw appError(503,'Chưa kết nối dịch vụ video.');
   row.data.roomReserved=true;await service.save(c,row,{lease:true});return {config};
  });
  try{
   const active=(await db.query('SELECT id FROM users WHERE id=ANY($1::text[]) AND active=true',[row.data.members.map(m=>m.id)])).rows;
   if(active.length!==2&&!['finishing','processing'].includes(row.data.state))finishSpeakingSession(row.data,'interrupted','Một tài khoản không còn hoạt động.',clock());
   await tickSpeakingExam(row.data,await provider.readConfig(),{time:clock(),request:provider.request,presence:provider.presence,checkpoint,reserveRoom});if(!SPEAKING_EXAM_TERMINAL.has(row.data.state)||row.data.assetId)delete row.data.retryAt;
  }catch(error){
   if(error.statusCode===409)continue; // Lease replaced/revoked: discard stale work.
   // Preserve uncertain POST intent for GET recovery. Never mark recording saved.
   row.data.error='Đang kiểm tra lại dịch vụ video. Hệ thống sẽ tự thử lại.';row.data.retryAt=clock()+5000;
   if(['running','paused'].includes(row.data.state)){
    if(row.data.state==='running'){row.data.remaining=Math.max(0,row.data.deadline-clock());row.data.pausedAt=clock();row.data.recoveryDeadline=clock()+120000;row.data.state='paused';row.data.votes={};}
    if(clock()>=row.data.recoveryDeadline)finishSpeakingSession(row.data,'interrupted','Không thể khôi phục bản ghi và kết nối. Bạn có thể thi lại.',clock());
   }
   options.log?.warn({operation:error.providerOperation,status:error.providerStatus},'Speaking exam provider unavailable; durable recovery pending.');
  }
  row.data.runtimeLease.until=0;try{await service.save(db,row,{lease:true});}catch(error){if(error.statusCode!==409)throw error;}
 }
 return count;
}
export function startSpeakingExamWorker(app,options={}){
 let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await runSpeakingExamWorkerOnce({...options,log:app.log});}catch{app.log.warn('Speaking exam worker unavailable; will retry.');}finally{busy=false;}};
 const timer=setInterval(tick,3000);timer.unref();tick();app.addHook('onClose',async()=>clearInterval(timer));
}
