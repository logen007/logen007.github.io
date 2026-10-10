import {withTx,audit} from './db.js';
import {runMediaGarbageCollection} from './media-gc.js';

export const TRASH_RETENTION_DAYS=5;
export async function runTrashGarbageCollection(){
  return withTx(async client=>{
    // Match authoring's exam-before-question order; prevent a concurrent new reference.
    await client.query('LOCK TABLE exams, questions IN EXCLUSIVE MODE');
    const cutoff=new Date(Date.now()-TRASH_RETENTION_DAYS*86400000).toISOString();
    const exams=await client.query(`DELETE FROM exams e WHERE status='trash' AND trashed_at<=$1
      AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.exam_id=e.id) RETURNING id`,[cutoff]);
    const questions=await client.query(`DELETE FROM questions q WHERE status='trash' AND trashed_at<=$1
      AND NOT EXISTS(SELECT 1 FROM exams e, jsonb_array_elements(COALESCE(e.data->'sections','[]')) s WHERE s->'questionIds' ? q.id)
      AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.public_data->'answers' ? q.id
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(a.private_data#>'{examSnapshot,sections}','[]')) s WHERE s->'questionIds' ? q.id)
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(a.private_data#>'{examSnapshot,questionSnapshot}','[]')) x WHERE x->>'id'=q.id))
      RETURNING id`,[cutoff]);
    const result={exams:exams.rowCount,questions:questions.rowCount};
    if(result.exams||result.questions)await audit(null,'auto_empty_trash','system','trash',{...result,examIds:exams.rows.map(x=>x.id),questionIds:questions.rows.map(x=>x.id)},client);
    return result;
  });
}

export function startTrashGarbageCollector({uploadDir,logger=console}={}){
  let busy=false;
  const run=async()=>{
    if(busy)return;busy=true;
    try{
      const result=await runTrashGarbageCollection();
      if(result.exams||result.questions){
        logger.info?.(result,'expired trash removed');
        await runMediaGarbageCollection({uploadDir,logger});
      }
    }catch(error){logger.error?.(error,'trash garbage collection failed');}
    finally{busy=false;}
  };
  const first=setTimeout(run,10000),timer=setInterval(run,15*60*1000);
  first.unref?.();timer.unref?.();
  return()=>{clearTimeout(first);clearInterval(timer);};
}
