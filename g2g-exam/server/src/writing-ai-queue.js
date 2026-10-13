import {query,withTx,now,getSettings} from './db.js';
import {attemptExam,questionMap} from './actions/shared.js';
import {suggestWritingGrade} from './writing-ai.js';
import {createProviderJobPump} from './provider-job-pump.js';
import {aiApiKeyStatus} from './ai-settings.js';
import {AI_PROVIDER_IDS,normalizeAiProvider} from '../../src/domain/ai-providers.js';

let worker=null,providersExpireAt=0;
export const writingAiWorkerStatus=()=>worker?.status()||[];
export function wakeWritingAiWorker(){providersExpireAt=0;void worker?.tick();}

const isFreeWriting=question=>question?.type==='writing'&&question.writingFormVersion!==1&&String(question.aiGradingRules||'').trim();

export async function queueWritingAiJobs(client,attempt,exam,questions){
  for(const section of exam.sections||[])for(const questionId of section.questionIds||[]){
    const question=questions.get(questionId),answer=String(attempt.public_data?.answers?.[questionId]||'').trim();
    if(!isFreeWriting(question)||!answer)continue;
    await client.query(`INSERT INTO writing_ai_jobs(attempt_id,question_id,status)
      VALUES($1,$2,'queued') ON CONFLICT(attempt_id,question_id) DO UPDATE
      SET status='queued',tries=0,last_error=NULL,available_at=now(),updated_at=now()
      WHERE writing_ai_jobs.status='failed' AND writing_ai_jobs.available_at<=now()`,[attempt.id,questionId]);
  }
}

export async function backfillQueue(logger){
  try{
    // Normal submissions enqueue inside their transaction. Only discover
    // missing jobs at startup, and exclude existing jobs before reading papers.
    const attempts=(await query(`SELECT a.* FROM attempts a WHERE a.status IN ('grading','ready') AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(a.private_data->'examSnapshot'->'questionSnapshot','[]'::jsonb)) q
        WHERE q->>'type'='writing' AND q->>'writingFormVersion' IS DISTINCT FROM '1'
          AND length(trim(coalesce(q->>'aiGradingRules','')))>0
          AND length(trim(coalesce(a.public_data->'answers'->>(q->>'id'),'')))>0
          AND NOT EXISTS(SELECT 1 FROM writing_ai_jobs j WHERE j.attempt_id=a.id AND j.question_id=q->>'id'))
      OR (NOT (a.private_data ? 'examSnapshot') AND NOT EXISTS(SELECT 1 FROM writing_ai_jobs j WHERE j.attempt_id=a.id))
    ) ORDER BY a.created_at DESC`)).rows;
    for(const attempt of attempts){
      const exam=await attemptExam(attempt),questions=await questionMap(exam);
      await queueWritingAiJobs({query},attempt,exam,questions);
    }
  }catch(error){logger?.warn?.({err:error},'writing AI queue backfill failed');}
}

export async function claimJob(provider){
  return withTx(async client=>{
    // Serialize claims for this provider across processes/restarts as well.
    const lock=(await client.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,['writing-ai:'+provider])).rows[0];
    if(!lock?.locked)return null;
    if((await client.query(`SELECT 1 FROM writing_ai_jobs WHERE status='processing' AND model=$1 LIMIT 1`,[provider])).rowCount)return null;
    const row=(await client.query(`SELECT * FROM writing_ai_jobs
      WHERE status='queued' AND available_at<=now()
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
    if(!row)return null;
    return (await client.query(`UPDATE writing_ai_jobs SET status='processing',model=$2,started_at=now(),finished_at=NULL,updated_at=now() WHERE id=$1 RETURNING *,started_at::text AS lease`,[row.id,provider])).rows[0];
  });
}

export async function processJob(job,provider,logger){
  try{
    const row=(await query('SELECT * FROM attempts WHERE id=$1',[job.attempt_id])).rows[0];
    if(!row||!['grading','ready','published'].includes(row.status))throw new Error('Bài làm không còn ở trạng thái chấm.');
    const exam=await attemptExam(row),questions=await questionMap(exam),question=questions.get(job.question_id);
    if(!isFreeWriting(question))throw new Error('Câu hỏi không còn quy tắc chấm AI.');
    const section=(exam.sections||[]).find(item=>(item.questionIds||[]).includes(question.id))||{};
    const task=[section.instruction,section.additionalInstructions?.map(item=>item.text).join('\n'),question.instruction,question.prompt,question.instructionBlocks?.map(item=>item.text).join('\n')].filter(Boolean).join('\n\n');
    const suggestion=await suggestWritingGrade({task,level:exam.level,rule:question.aiGradingRules,answer:row.public_data?.answers?.[question.id],maxScore:question.maxScore,providerOnly:provider});
    await withTx(async client=>{
      const owned=await client.query(`SELECT id FROM writing_ai_jobs WHERE id=$1 AND status='processing' AND started_at=$2::timestamptz FOR UPDATE`,[job.id,job.lease]);
      if(!owned.rowCount)return;
      const current=(await client.query('SELECT private_data FROM attempts WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
      const aiWritingSuggestions={...(current?.private_data?.aiWritingSuggestions||{}),[question.id]:{...suggestion,status:'completed',createdAt:now()}};
      await client.query(`UPDATE attempts SET private_data=private_data||$2::jsonb,updated_at=now() WHERE id=$1`,[row.id,JSON.stringify({aiWritingSuggestions})]);
      await client.query(`UPDATE writing_ai_jobs SET status='completed',model=$2,finished_at=now(),updated_at=now(),last_error=NULL WHERE id=$1`,[job.id,suggestion.model||null]);
    });
  }catch(error){
    const message=String(error?.message||'AI chưa thể chấm bài.').slice(0,500),providerWaiting=error.statusCode===429||error.providerBlocked;
    const tries=Number(job.tries||0)+(providerWaiting?0:1),retry=providerWaiting||tries<3;
    await withTx(async client=>{
      const owned=await client.query(`SELECT id FROM writing_ai_jobs WHERE id=$1 AND status='processing' AND started_at=$2::timestamptz FOR UPDATE`,[job.id,job.lease]);
      if(!owned.rowCount)return;
      const attempt=(await client.query('SELECT private_data FROM attempts WHERE id=$1 FOR UPDATE',[job.attempt_id])).rows[0];
      if(attempt){
        const aiWritingSuggestions={...(attempt.private_data?.aiWritingSuggestions||{}),[job.question_id]:{status:retry?'queued':'failed',error:retry?'AI đang thử lại…':message,createdAt:now()}};
        await client.query(`UPDATE attempts SET private_data=private_data||$2::jsonb,updated_at=now() WHERE id=$1`,[job.attempt_id,JSON.stringify({aiWritingSuggestions})]);
      }
      await client.query(`UPDATE writing_ai_jobs SET status=$2,tries=$3,last_error=$4,available_at=now()+($5::text||' seconds')::interval,finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1`,[job.id,retry?'queued':'failed',tries,message,String(retry?Math.min(60,2**tries):900)]);
    });
    logger?.warn?.({err:error,jobId:job.id},'writing AI job failed');
    return {cooldownMs:error.retryAfterMs||15000,error:message};
  }
}

export function startWritingAiWorker({logger}={}){
  let configured=[];
  const getProviders=async()=>{
    if(Date.now()<providersExpireAt)return configured;
    const [status,settings]=await Promise.all([aiApiKeyStatus(),getSettings()]);
    const preferred=normalizeAiProvider(settings.ai?.providerPreference);
    configured=[preferred,...AI_PROVIDER_IDS.filter(id=>id!==preferred)].filter(id=>status[id]?.configured).map(id=>({id,version:status[id].updatedAt?new Date(status[id].updatedAt).toISOString():status[id].source}));
    providersExpireAt=Date.now()+10000;
    return configured;
  };
  providersExpireAt=0;
  const pump=createProviderJobPump({getProviders,
    hasWork:async()=>(await query(`SELECT 1 FROM writing_ai_jobs WHERE status='queued' AND available_at<=now() LIMIT 1`)).rowCount>0,
    claim:claimJob,processJob:(job,provider)=>processJob(job,provider,logger),onError:error=>logger?.error?.({err:error},'writing AI worker failed')});
  worker=pump;
  let maintenanceBusy=false;
  const recover=async()=>{
    if(maintenanceBusy)return;
    maintenanceBusy=true;
    try{
      await query(`UPDATE writing_ai_jobs SET status='queued',tries=0,available_at=now(),updated_at=now()
        WHERE (status='failed' AND available_at<=now()) OR (status='processing' AND started_at<now()-interval '5 minutes')`);
      await pump.tick();
    }catch(error){logger?.warn?.({err:error},'writing AI recovery failed');}finally{maintenanceBusy=false;}
  };
  const timer=setInterval(()=>void pump.tick(),2000),recoveryTimer=setInterval(()=>void recover(),60000);
  timer.unref();recoveryTimer.unref();void backfillQueue(logger).then(recover);
  return ()=>{pump.stop();if(worker===pump)worker=null;clearInterval(timer);clearInterval(recoveryTimer);};
}
