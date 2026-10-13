import {query,withTx,now} from './db.js';
import {attemptExam,questionMap} from './actions/shared.js';
import {suggestWritingGrade} from './writing-ai.js';

const isFreeWriting=question=>question?.type==='writing'&&question.writingFormVersion!==1&&String(question.aiGradingRules||'').trim();

export async function queueWritingAiJobs(client,attempt,exam,questions){
  for(const section of exam.sections||[])for(const questionId of section.questionIds||[]){
    const question=questions.get(questionId),answer=String(attempt.public_data?.answers?.[questionId]||'').trim();
    if(!isFreeWriting(question)||!answer)continue;
    await client.query(`INSERT INTO writing_ai_jobs(attempt_id,question_id,status)
      VALUES($1,$2,'queued') ON CONFLICT(attempt_id,question_id) DO NOTHING`,[attempt.id,questionId]);
  }
}

async function backfillQueue(logger){
  try{
    const attempts=(await query(`SELECT * FROM attempts WHERE status IN ('grading','ready') ORDER BY updated_at DESC LIMIT 200`)).rows;
    for(const attempt of attempts){
      const exam=await attemptExam(attempt),questions=await questionMap(exam);
      await queueWritingAiJobs({query},attempt,exam,questions);
    }
  }catch(error){logger?.warn?.({err:error},'writing AI queue backfill failed');}
}

async function claimJob(){
  return withTx(async client=>{
    const row=(await client.query(`SELECT * FROM writing_ai_jobs
      WHERE status='queued' AND available_at<=now()
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
    if(!row)return null;
    await client.query(`UPDATE writing_ai_jobs SET status='processing',started_at=now(),updated_at=now() WHERE id=$1`,[row.id]);
    return row;
  });
}

async function processJob(job,logger){
  try{
    const row=(await query('SELECT * FROM attempts WHERE id=$1',[job.attempt_id])).rows[0];
    if(!row||!['grading','ready'].includes(row.status))throw new Error('Bài làm không còn ở trạng thái chấm.');
    const exam=await attemptExam(row),questions=await questionMap(exam),question=questions.get(job.question_id);
    if(!isFreeWriting(question))throw new Error('Câu hỏi không còn quy tắc chấm AI.');
    const section=(exam.sections||[]).find(item=>(item.questionIds||[]).includes(question.id))||{};
    const task=[section.instruction,section.additionalInstructions?.map(item=>item.text).join('\n'),question.instruction,question.prompt,question.instructionBlocks?.map(item=>item.text).join('\n')].filter(Boolean).join('\n\n');
    const suggestion=await suggestWritingGrade({task,level:exam.level,rule:question.aiGradingRules,answer:row.public_data?.answers?.[question.id],maxScore:question.maxScore});
    const aiWritingSuggestions={...(row.private_data?.aiWritingSuggestions||{}),[question.id]:{...suggestion,status:'completed',createdAt:now()}};
    await withTx(async client=>{
      await client.query(`UPDATE attempts SET private_data=private_data||$2::jsonb,updated_at=now() WHERE id=$1`,[row.id,JSON.stringify({aiWritingSuggestions})]);
      await client.query(`UPDATE writing_ai_jobs SET status='completed',finished_at=now(),updated_at=now(),last_error=NULL WHERE id=$1`,[job.id]);
    });
  }catch(error){
    const message=String(error?.message||'AI chưa thể chấm bài.').slice(0,500),tries=Number(job.tries||0)+1,retry=tries<3;
    await withTx(async client=>{
      const attempt=(await client.query('SELECT private_data FROM attempts WHERE id=$1 FOR UPDATE',[job.attempt_id])).rows[0];
      if(attempt){
        const aiWritingSuggestions={...(attempt.private_data?.aiWritingSuggestions||{}),[job.question_id]:{status:retry?'queued':'failed',error:retry?'AI đang thử lại…':message,createdAt:now()}};
        await client.query(`UPDATE attempts SET private_data=private_data||$2::jsonb,updated_at=now() WHERE id=$1`,[job.attempt_id,JSON.stringify({aiWritingSuggestions})]);
      }
      await client.query(`UPDATE writing_ai_jobs SET status=$2,tries=$3,last_error=$4,available_at=now()+($5::text||' seconds')::interval,finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1`,[job.id,retry?'queued':'failed',tries,message,String(Math.min(60,2**tries))]);
    });
    logger?.warn?.({err:error,jobId:job.id},'writing AI job failed');
  }
}

export function startWritingAiWorker({logger,concurrency=Math.max(1,Math.min(6,Number(process.env.AI_WRITING_CONCURRENCY||3)))}={}){
  let active=0,stopped=false;
  const tick=async()=>{
    if(stopped)return;
    while(active<concurrency){
      const job=await claimJob();if(!job)break;
      active++;void processJob(job,logger).finally(()=>{active--;void tick();});
    }
  };
  const timer=setInterval(()=>void tick(),750),backfillTimer=setInterval(()=>void backfillQueue(logger),30000);
  timer.unref();backfillTimer.unref();void backfillQueue(logger).then(tick);
  return ()=>{stopped=true;clearInterval(timer);clearInterval(backfillTimer);};
}
