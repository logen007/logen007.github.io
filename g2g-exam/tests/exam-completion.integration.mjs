// G2G_PGLITE_PATH points to an installed PGlite module. No production DB access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite(),context=new AsyncLocalStorage();
const query=(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[],rowCount:1}):(context.getStore()||db).query(sql,args).then(result=>({...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)}));
globalThis.__completionDb={query,withTx:fn=>db.transaction(client=>context.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),audit:async()=>{},now:()=>new Date().toISOString(),uid:prefix=>prefix+'-'+randomUUID(),appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
const hook=registerHooks({resolve(specifier,ctx,next){
  if(specifier.endsWith('/db.js')||specifier==='../db.js'||specifier==='./db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,audit,now,uid,appError}=globalThis.__completionDb; export const pool={query};'};
  if(specifier==='nodemailer')return {shortCircuit:true,url:'data:text/javascript,export default {createTransport(){throw new Error("Email forbidden")}};'};
  return next(specifier,ctx);
}});
try{
  await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const {startAttempt,saveAnswers,submitAttempt,submitExpiredAttempts}=await import('../server/src/actions/attempts.js');
  const {saveManualGrade}=await import('../server/src/actions/grading.js');
  const student={id:'s',role:'student',name:'Student',profileCompletedAt:'2026-01-01'},teacher={id:'t',role:'teacher'};
  for(const user of [student,teacher])await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4)',[user.id,user.id+'@example.test',user.role,JSON.stringify(user)]);
  const ids=Array.from({length:10},(_,i)=>'q'+i);
  for(const id of ids)await query('INSERT INTO questions(id,owner_id,data) VALUES($1,$2,$3)',[id,'t',JSON.stringify({id,type:'single',choices:['A','B'],correctAnswer:0,maxScore:1,autoGrade:true})]);
  const exam={id:'e',ownerId:'t',title:'Completion test',provider:'GOETHE',level:'A1',sections:[{id:'read',name:'Reading',timeMinutes:10,questionIds:ids}]};
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('e','t','published',$1)",[JSON.stringify(exam)]);
  const start=async count=>{const {attemptId}=await startAttempt(student,{examId:'e'});await saveAnswers(student,{attemptId,answers:Object.fromEntries(ids.slice(0,count).map(id=>[id,1]))});return attemptId;};
  const first=await start(7);
  await assert.rejects(()=>submitAttempt(student,{attemptId:first,timedOut:true,percent:100}),error=>error.statusCode===409&&/80 %/.test(error.message));
  assert.equal((await query('SELECT status FROM attempts WHERE id=$1',[first])).rows[0].status,'in_progress');
  await saveAnswers(student,{attemptId:first,answers:{q7:1}});
  assert.equal((await submitAttempt(student,{attemptId:first})).status,'ready');
  assert.equal((await query('SELECT private_data FROM attempts WHERE id=$1',[first])).rows[0].private_data.autoScore,0);
  const second=await start(7);
  await query('UPDATE attempts SET public_data=public_data||$2::jsonb WHERE id=$1',[second,JSON.stringify({examDeadlineMs:Date.now()-1000})]);
  await submitExpiredAttempts();
  const row=(await query('SELECT * FROM attempts WHERE id=$1',[second])).rows[0];
  assert.equal(row.status,'incomplete');assert.equal(row.public_data.timedOut,true);
  assert.equal(row.public_data.completion.minimum,8);assert.equal(Object.keys(row.public_data.answers).length,7);
  assert.equal(row.private_data.autoScore,undefined);
  assert.equal((await submitAttempt(student,{attemptId:second})).status,'incomplete');
  await assert.rejects(()=>saveManualGrade(teacher,{attemptId:second,scores:{}}),/trạng thái chấm/);
  console.log('SQL completion: manual 80% gate, deadline worker, retained answers, no grading, idempotency passed.');
}finally{hook.deregister();await db.close();delete globalThis.__completionDb;}
