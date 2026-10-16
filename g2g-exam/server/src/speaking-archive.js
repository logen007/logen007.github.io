import crypto from 'node:crypto';
import {query,withTx,appError} from './db.js';
import {requireRole} from './auth.js';
import {canManage,canReview} from '../../src/speaking/model.js';
import {getBackupDriveAccess} from './backup-google.js';
import {archiveRecording,generateRecordingFileId,driveJson,cleanupAbandonedRecordingTemps} from './speaking-drive.js';

async function claim(){
 return withTx(async c=>{
  const result=await c.query(`SELECT id,data FROM speaking_lab_sessions WHERE data->>'assetId' IS NOT NULL
   AND data->>'state' IN ('completed','interrupted','cancelled')
   AND COALESCE(data->'driveArchive'->>'state','') <> 'saved'
   AND COALESCE((data->'driveArchive'->>'retryAt')::bigint,0) <= $1
   ORDER BY COALESCE((data->'driveArchive'->>'attemptedAt')::bigint,0),created_at
   FOR UPDATE SKIP LOCKED LIMIT 1`,[Date.now()]);
  const row=result.rows[0];if(!row)return null;
  const archive={...row.data.driveArchive,state:'uploading',lease:crypto.randomUUID(),attempts:(row.data.driveArchive?.attempts||0)+1,attemptedAt:Date.now(),retryAt:Date.now()+40*60000,error:''};
  await c.query(`UPDATE speaking_lab_sessions SET data=jsonb_set(data,'{driveArchive}',$2::jsonb),updated_at=now() WHERE id=$1`,[row.id,JSON.stringify(archive)]);
  return {id:row.id,assetId:row.data.assetId,archive};
 });
}
async function save(job,archive){
 const result=await query(`UPDATE speaking_lab_sessions SET data=jsonb_set(data,'{driveArchive}',$2::jsonb),updated_at=now() WHERE id=$1 AND data->'driveArchive'->>'lease'=$3 RETURNING id`,[job.id,JSON.stringify(archive),job.archive.lease]);
 if(!result.rows.length)throw appError(409,'Tác vụ lưu video đã thay đổi.');
}
export async function runSpeakingArchiveOnce(){
 const job=await claim();if(!job)return false;
 try{
  if(!job.archive.fileId){job.archive.fileId=await generateRecordingFileId();await save(job,job.archive);}
  await archiveRecording(job,archive=>save(job,archive));
  await save(job,{...job.archive,state:'saved',savedAt:Date.now(),retryAt:0,error:''});
 }catch{
  // Never overwrite exam state or destroy the 100ms source on transfer failures.
  await save(job,{...job.archive,state:'retrying',error:'Chưa lưu được video lên Drive. Kiểm tra kết nối Drive, dung lượng trống và bản gốc trên 100ms.',retryAt:Date.now()+Math.min(6*3600000,30000*2**Math.min(job.archive.attempts,10))});
 }
 return true;
}
export function startSpeakingArchiveWorker(app){
 let busy=false;
 const tick=async()=>{if(busy)return;busy=true;try{await runSpeakingArchiveOnce();}catch{app.log.warn('Speaking video archive unavailable; will retry.');}finally{busy=false;}};
 const timer=setInterval(tick,10000);timer.unref();cleanupAbandonedRecordingTemps().catch(()=>{}).finally(tick);app.addHook('onClose',async()=>clearInterval(timer));
}
export function registerSpeakingArchiveRoutes(app){
 app.get('/api/speaking-lab/archive-status',async request=>{
  await requireRole(request,'teacher','master');
  try{const access=await getBackupDriveAccess(),folder=await driveJson(access,'/files/'+encodeURIComponent(access.folderId)+'?fields=id,trashed');return {connected:!!folder&&!folder.trashed};}catch{return {connected:false};}
 });
 app.post('/api/speaking-lab/sessions/:id/archive-retry',async request=>{
  if(request.headers.origin!==new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin)throw appError(403,'Nguồn yêu cầu không hợp lệ.');
  const user=await requireRole(request,'teacher','master');
  return withTx(async c=>{
   const result=await c.query('SELECT * FROM speaking_lab_sessions WHERE id=$1 FOR UPDATE',[request.params.id]),row=result.rows[0];
   if(!row||!canManage(user,row)&&!canReview(user,row))throw appError(404,'Không tìm thấy bản ghi.');
   const archive=row.data.driveArchive||{};
   if(!row.data.assetId)throw appError(409,'Bản ghi đang được 100ms xử lý.');
   if(archive.state==='saved')return {ok:true};
   if(archive.state==='uploading'&&archive.retryAt>Date.now())throw appError(409,'Video đang được chuyển lên Drive.');
   await c.query(`UPDATE speaking_lab_sessions SET data=jsonb_set(data,'{driveArchive}',$2::jsonb),updated_at=now() WHERE id=$1`,[row.id,JSON.stringify({...archive,state:'queued',retryAt:0,error:''})]);
   return {ok:true};
  });
 });
}
