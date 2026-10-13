// Isolated SQL scenarios, never production data or paid AI calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite(),transaction=new AsyncLocalStorage();let queries=0,inserts=0;
const query=async(sql,args)=>{
  queries++;if(sql.startsWith('INSERT INTO writing_ai_jobs'))inserts++;
  const result=await (transaction.getStore()||db).query(sql,args);
  return {...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)};
};
globalThis.__perfDb={query,withTx:fn=>db.transaction(client=>transaction.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),audit:async()=>{},now:()=>new Date().toISOString(),uid:()=> 'fixture',appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier.endsWith('/db.js')||specifier==='../db.js'||specifier==='./db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,audit,now,uid,appError}=globalThis.__perfDb; export const getDataRevision=()=>0; export const pool={query};'};
  if(specifier==='nodemailer')return {shortCircuit:true,url:'data:text/javascript,export default {createTransport(){throw Error("External email forbidden")}};'};
  return next(specifier,context);
}});
try{
  await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const {loadState}=await import('../server/src/state.js');
  const {submitAttempt,submitExpiredAttempts}=await import('../server/src/actions/attempts.js');
  const {backfillQueue,claimJob,processJob}=await import('../server/src/writing-ai-queue.js');
  const {getWritingAiQueueStatus}=await import('../server/src/actions/settings.js');
  const {filteredGradebook}=await import('../src/domain/gradebook.js');
  const {dashboardHtml}=await import('../src/views/dashboard.js');
  await query("INSERT INTO users(id,email,role,data) VALUES('teacher','teacher@example.test','teacher','{\"name\":\"Teacher\"}')");
  await query("INSERT INTO users(id,email,role,data) SELECT 's'||i,'s'||i||'@example.test','student',jsonb_build_object('name','Synthetic '||i,'level','A1') FROM generate_series(0,199) i");
  const question={id:'write',type:'writing',skill:'Viết',autoGrade:false,maxScore:10,aiGradingRules:'Lời chào 10đ',title:'Bài viết',prompt:'private passage '.repeat(1000)};
  const exam={id:'exam',title:'Performance fixture',provider:'GOETHE',level:'A1',sections:[{id:'section',name:'Viết 2',skill:'Viết',timeMinutes:10,questionProfile:{manualPerPart:true},questionIds:['write']}]};
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('exam','teacher','published',$1)",[JSON.stringify(exam)]);
  await query("INSERT INTO questions(id,owner_id,data) VALUES('write','teacher',$1)",[JSON.stringify(question)]);
  const privateData={examSnapshot:{...exam,questionSnapshot:[question]},sectionScores:{'Viết 2':0},manualScores:{'Viết 2':10},scoringVersion:2,aiWritingSuggestions:{write:{status:'completed',suggestedScore:10,model:'groq',findings:[{met:true,text:'private commentary '.repeat(100)}]}}};
  await query("INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data,private_data) SELECT 'a'||i,'s'||i,'exam','grading',1,jsonb_build_object('studentId','s'||i,'examId','exam','status','grading','examTitle','Performance fixture','answers',jsonb_build_object('write',repeat('answer ',200)),'startedAt','2026-10-13T10:00:00Z','submittedAt','2026-10-13T10:05:00Z'),$1 FROM generate_series(0,199) i",[JSON.stringify(privateData)]);
  const full=await loadState({id:'teacher',role:'teacher'});
  const summary=await loadState({id:'teacher',role:'teacher'},{summaryOnly:true});
  assert.equal(summary.scope,'summary');assert.equal(summary.attempts.length,200);
  assert.deepEqual(filteredGradebook(summary).map(r=>r.skills),filteredGradebook(full).map(r=>r.skills));
  assert.ok(dashboardHtml({data:summary,infrastructure:{writingAi:{}}}).includes('200/200'));
  const fullBytes=Buffer.byteLength(JSON.stringify(full)),summaryBytes=Buffer.byteLength(JSON.stringify(summary));
  assert.ok(summaryBytes<fullBytes/5);
  assert.ok(!JSON.stringify(summary).includes('private passage'));
  assert.ok(!JSON.stringify(summary).includes('private commentary'));
  assert.ok(!Object.hasOwn(summary.attempts[0],'answers'));
  await assert.rejects(loadState({id:'s0',role:'student'},{summaryOnly:true}),error=>error.statusCode===403);

  await query("UPDATE attempts SET status='in_progress',public_data=public_data||jsonb_build_object('status','in_progress','examDeadlineMs',($1::numeric),'startedAt',$2::text,'currentQuestionIds',jsonb_build_array('write')) WHERE id='a0'",[Date.now()+600000,new Date().toISOString()]);
  const session=await loadState({id:'s0',role:'student'},{attemptId:'a0'});
  assert.equal(session.attempts.length,1);assert.equal(session.exams.length,1);assert.equal(session.questions.length,1);
  assert.equal(session.questions[0].aiGradingRules,undefined);
  await assert.rejects(loadState({id:'s1',role:'student'},{attemptId:'a0'}),error=>error.statusCode===404);
  const receipt=await submitAttempt({id:'s0',role:'student'},{attemptId:'a0'});
  assert.equal(receipt.status,'grading');assert.equal(receipt.attempt.status,'grading');assert.equal(receipt.attempt.answers.write.length,1400);
  assert.equal(receipt.attempt.examSnapshot,undefined);assert.equal(receipt.attempt.aiWritingSuggestions,undefined);
  assert.ok(receipt.attempt.submittedAt);assert.ok(Number.isFinite(receipt.attempt.durationSeconds));
  assert.equal((await submitAttempt({id:'s0',role:'student'},{attemptId:'a0'})).status,'grading');

  // Seed jobs once; backfill should touch only genuinely missing papers.
  await query("INSERT INTO writing_ai_jobs(attempt_id,question_id) SELECT id,'write' FROM attempts WHERE id<>'a0' AND id<>'a199' ON CONFLICT DO NOTHING");
  inserts=0;await backfillQueue({warn:error=>{throw error;}});assert.equal(inserts,1);
  inserts=0;await backfillQueue({warn:error=>{throw error;}});assert.equal(inserts,0);
  assert.equal((await query('SELECT count(*)::int AS n FROM writing_ai_jobs')).rows[0].n,200);
  const lightweight=await getWritingAiQueueStatus({role:'master'});assert.equal(lightweight.jobs.queued.count,200);
  await assert.rejects(getWritingAiQueueStatus({role:'teacher'}),error=>error.statusCode===403);
  const claimed=await Promise.all(['groq','gemini','grok','mistral'].map(claimJob));
  assert.equal(new Set(claimed.map(job=>job.id)).size,4,'Provider lanes claim different papers');
  for(const provider of ['groq','gemini','grok','mistral'])assert.equal(await claimJob(provider),null,'One database lease per provider');
  const savedFetch=globalThis.fetch,savedKey=process.env.GROQ_API_KEY;
  try{
    process.env.GROQ_API_KEY='isolated-fixture';
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{"suggestedScore":7,"findings":[]}'}}]})});
    await processJob(claimed[0],'groq');
    const completed=(await query('SELECT status,model FROM writing_ai_jobs WHERE id=$1',[claimed[0].id])).rows[0];
    assert.deepEqual(completed,{status:'completed',model:'groq'});
    const suggestion=(await query('SELECT private_data FROM attempts WHERE id=$1',[claimed[0].attempt_id])).rows[0].private_data.aiWritingSuggestions.write;
    assert.equal(suggestion.suggestedScore,7);assert.equal(suggestion.status,'completed');
    const quotaJob=await claimJob('groq');
    globalThis.fetch=async()=>({ok:false,status:429,headers:{get:()=> '120'},json:async()=>({})});
    const paused=await processJob(quotaJob,'groq');assert.equal(paused.cooldownMs,120000);
    const waiting=(await query('SELECT status,tries FROM writing_ai_jobs WHERE id=$1',[quotaJob.id])).rows[0];
    assert.deepEqual(waiting,{status:'queued',tries:0},'Quota does not burn a paper retry or mark it failed');
    await query("UPDATE writing_ai_jobs SET status='processing',started_at=now() WHERE id=$1",[quotaJob.id]);
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{"suggestedScore":3,"findings":[]}'}}]})});
    await processJob(quotaJob,'groq');
    assert.equal((await query('SELECT status FROM writing_ai_jobs WHERE id=$1',[quotaJob.id])).rows[0].status,'processing','An old lease cannot overwrite a recovered job');
  }finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=savedKey;}
  await query("UPDATE attempts SET status='in_progress',public_data=public_data||jsonb_build_object('status','in_progress','examDeadlineMs',$1::numeric,'answers','{}'::jsonb) WHERE id='a1'",[Date.now()-1000]);
  await submitExpiredAttempts();assert.equal((await query("SELECT status FROM attempts WHERE id='a1'")).rows[0].status,'incomplete');
  console.log(JSON.stringify({scenario:'Isolated PostgreSQL, 200 papers; excludes HTTP/VPS/provider latency',fullBytes,summaryBytes,reductionPercent:Math.round((1-summaryBytes/fullBytes)*100),queueJobs:200,repeatedBackfillInserts:inserts,queries,checks:'summary/privacy, submission idempotency, 4 provider leases, successful persistence, quota requeue, stale lease protection and deadline'}));
}finally{hook.deregister();await db.close();delete globalThis.__perfDb;}
