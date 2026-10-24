import crypto from 'node:crypto';
import {query,withTx,appError} from './db.js';
import {archiveRecording,generateRecordingFileId,cleanupAbandonedRecordingTemps} from './speaking-drive.js';

// Same verified private Drive transfer as the isolated trial, separate jobs and
// prefixed IDs. Completion and archive state stay independent on every retry.
export async function runSpeakingExamArchiveOnce(options={}){
 const db=options.db||{query,withTx},clock=options.now||Date.now;
 const generate=options.generateFileId||generateRecordingFileId,transfer=options.archiveRecording||archiveRecording;
 const job=await db.withTx(async c=>{
  const row=(await c.query(`SELECT id,data FROM speaking_exam_sessions WHERE data->>'assetId' IS NOT NULL
   AND state IN ('completed','interrupted','cancelled') AND COALESCE(data->'driveArchive'->>'state','')<>'saved'
   AND COALESCE((data->'driveArchive'->>'retryAt')::bigint,0)<=$1
   ORDER BY COALESCE((data->'driveArchive'->>'attemptedAt')::bigint,0),created_at
   FOR UPDATE SKIP LOCKED LIMIT 1`,[clock()])).rows[0];
  if(!row)return null;
  const archive={...row.data.driveArchive,state:'uploading',lease:crypto.randomUUID(),attempts:(row.data.driveArchive?.attempts||0)+1,attemptedAt:clock(),retryAt:clock()+40*60000,error:''};
  await c.query("UPDATE speaking_exam_sessions SET data=jsonb_set(data,'{driveArchive}',$2::jsonb)||jsonb_build_object('revision',COALESCE((data->>'revision')::integer,0)+1),updated_at=now() WHERE id=$1",[row.id,JSON.stringify(archive)]);
  return {id:row.id,assetId:row.data.assetId,archive};
 });
 if(!job)return false;
 const save=async archive=>{
  const result=await db.query("UPDATE speaking_exam_sessions SET data=jsonb_set(data,'{driveArchive}',$2::jsonb)||jsonb_build_object('revision',COALESCE((data->>'revision')::integer,0)+1),updated_at=now() WHERE id=$1 AND data->'driveArchive'->>'lease'=$3 RETURNING id",[job.id,JSON.stringify(archive),job.archive.lease]);
  if(!result.rows.length)throw appError(409,'Tác vụ lưu video đã thay đổi.');
 };
 try{
  if(!job.archive.fileId){job.archive.fileId=await generate();await save(job.archive);}
  await transfer(job,async archive=>{Object.assign(job.archive,archive);await save(job.archive);});
  await save({...job.archive,state:'saved',savedAt:clock(),retryAt:0,error:''});
 }catch{
  await save({...job.archive,state:'retrying',retryAt:clock()+Math.min(6*3600000,30000*2**Math.min(job.archive.attempts,10)),error:'Chưa lưu được video lên Drive. Hệ thống sẽ thử lại; bản gốc vẫn được giữ trên dịch vụ video.'});
 }
 return true;
}
export function startSpeakingExamArchiveWorker(app,options={}){
 let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await runSpeakingExamArchiveOnce(options);}catch{app.log.warn('Speaking exam archive unavailable; will retry.');}finally{busy=false;}};
 const timer=setInterval(tick,10000);timer.unref();
 // This only cleans old private scratch directories, never provider assets.
 (options.cleanupTemps||cleanupAbandonedRecordingTemps)().catch(()=>{}).finally(tick);
 app.addHook('onClose',async()=>clearInterval(timer));
}
