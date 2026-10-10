// Run with G2G_PGLITE_PATH pointing to a temporary @electric-sql/pglite module.
// Executes production action/state code and real SQL in an isolated database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import crypto from 'node:crypto';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite(),context=new AsyncLocalStorage();
const query=(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[],rowCount:1}):(context.getStore()||db).query(sql,args).then(result=>({...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)}));
globalThis.__testDb={query,withTx:fn=>db.transaction(client=>context.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),audit:async()=>{},now:()=>new Date().toISOString(),uid:prefix=>`${prefix}-${crypto.randomUUID()}`,appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
const hook=registerHooks({resolve(specifier,ctx,next){
  if(specifier.endsWith('/db.js')||specifier==='../db.js'||specifier==='./db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,audit,now,uid,appError}=globalThis.__testDb; export const pool={query};'};
  if(specifier==='nodemailer')return {shortCircuit:true,url:'data:text/javascript,export default {createTransport(){throw new Error("External email forbidden in test")}};'};
  return next(specifier,ctx);
}});
try{
  await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const {createExamCode,saveExamAccess,expireCodes}=await import('../server/src/actions/exam-access.js');
  const {startAttempt,abandonAttempt,submitAttempt}=await import('../server/src/actions/attempts.js');
  const {publishAttemptResult}=await import('../server/src/actions/grading.js');
  const {saveOralScore}=await import('../server/src/actions/oral.js');
  const {loadState}=await import('../server/src/state.js');
  const teacher={id:'t',role:'teacher',name:'Teacher'},student={id:'s',role:'student',name:'Student',level:'A1.1',profileCompletedAt:'2026-01-01'};
  for(const user of [teacher,student])await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4)',[user.id,`${user.id}@example.test`,user.role,JSON.stringify(user)]);
  const sections=[];
  for(const [skill,max] of Object.entries({reading:75,grammar:30,listening:75,writing:45})){
    sections.push({id:skill,name:skill,skillKey:skill,questionIds:[skill],timeMinutes:10});
    await query('INSERT INTO questions(id,owner_id,data) VALUES($1,$2,$3)',[skill,'t',JSON.stringify({id:skill,title:skill,skill,type:'single',correctAnswer:0,choices:['a','b'],maxScore:max,autoGrade:true})]);
  }
  const exam={id:'e',ownerId:'t',title:'Protected',provider:'TELC',level:'B1',learningLevel:'B1.1',hidden:true,sections};
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('e','t','published',$1)",[JSON.stringify(exam)]);
  await assert.rejects(()=>saveExamAccess(student,{examId:'e',hidden:false,learningLevel:'B1.1'}));
  await assert.rejects(()=>startAttempt(student,{examId:'e'}),/nhập mã/);
  const before=await loadState(student);assert.equal(before.questions.length,0);assert.equal(before.exams[0].hasActiveCodes,false);
  const code=await createExamCode(teacher,{examId:'e',expiresAt:new Date(Date.now()+60000).toISOString()});
  assert.match(code.code,/^[A-Z0-9]{5}$/);
  const started=await startAttempt(student,{code:code.code});
  assert.equal((await loadState(student)).questions.length,4);
  assert.ok(!JSON.stringify((await loadState(student)).attempts).includes('correctAnswer'));
  assert.ok(!(await loadState(student)).questions.some(q=>'correctAnswer' in q));
  await assert.rejects(()=>startAttempt(student,{code:code.code}),/đã sử dụng/);
  await abandonAttempt(student,{attemptId:started.attemptId});
  await assert.rejects(()=>startAttempt(student,{code:code.code}),/đã sử dụng/);
  const second=await createExamCode(teacher,{examId:'e',expiresAt:new Date(Date.now()+60000).toISOString()});
  const attempt=await startAttempt(student,{code:second.code});
  await query("UPDATE exam_codes SET expires_at=now()-interval '1 second' WHERE id=$1",[second.id]);
  await expireCodes();
  assert.equal((await query('SELECT code FROM exam_codes WHERE id=$1',[second.id])).rows[0].code,null);
  // Active attempt remains accessible after expiry, and snapshot beats later edits.
  await query("UPDATE questions SET data=jsonb_set(data,'{maxScore}','1'::jsonb)");
  assert.equal((await loadState(student)).questions.find(q=>q.id==='reading').maxScore,75);
  await submitAttempt(student,{attemptId:attempt.attemptId});
  const marks={autoScore:135,sectionScores:{reading:75,grammar:30,listening:30,writing:0},manualScores:{},scoringVersion:2,totalScore:135};
  await query("UPDATE attempts SET status='ready',private_data=private_data||$2::jsonb WHERE id=$1",[attempt.attemptId,JSON.stringify(marks)]);
  await saveOralScore(teacher,{attemptId:attempt.attemptId,score:45});
  // Marks must remain private until published.
  assert.equal((await loadState(student)).attempts[0].oralScore,undefined);
  await publishAttemptResult(teacher,{attemptId:attempt.attemptId});
  assert.equal((await query("SELECT data FROM users WHERE id='s'")).rows[0].data.level,'B1.2');
  assert.equal((await query('SELECT count(*)::int AS n FROM level_promotions')).rows[0].n,1);
  await publishAttemptResult(teacher,{attemptId:attempt.attemptId});
  assert.equal((await query('SELECT count(*)::int AS n FROM level_promotions')).rows[0].n,1);
  const notification=(await query('SELECT data FROM notifications')).rows[0].data;
  assert.ok(notification.text.includes('B1.2'));assert.ok(notification.text.includes('135/225'));
  assert.equal((await loadState(student)).promotions[0].toLevel,'B1.2');
  const other={...student,id:'s2'};
  await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4)',['s2','s2@example.test','student',JSON.stringify(other)]);
  for(const [skill,max] of Object.entries({reading:75,grammar:30,listening:75,writing:45}))await query("UPDATE questions SET data=jsonb_set(data,'{maxScore}',$2::jsonb) WHERE id=$1",[skill,JSON.stringify(max)]);
  const race=await Promise.allSettled([startAttempt(other,{code:code.code}),startAttempt(other,{code:code.code})]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  const late=race.find(r=>r.status==='fulfilled').value;
  await submitAttempt(other,{attemptId:late.attemptId});
  await query("UPDATE attempts SET status='ready',private_data=private_data||$2::jsonb WHERE id=$1",[late.attemptId,JSON.stringify(marks)]);
  await publishAttemptResult(teacher,{attemptId:late.attemptId});
  assert.equal((await query("SELECT data FROM users WHERE id='s2'")).rows[0].data.level,'A1.1');
  await saveOralScore(teacher,{attemptId:late.attemptId,score:45});
  assert.equal((await query("SELECT data FROM users WHERE id='s2'")).rows[0].data.level,'B1.2');
  await saveOralScore(teacher,{attemptId:late.attemptId,score:45});
  assert.equal((await query("SELECT count(*)::int AS n FROM level_promotions WHERE student_id='s2'")).rows[0].n,1);
  for(let i=0;i<11;i++)try{await startAttempt(student,{code:'ZZZZZ'});}catch{}
  await assert.rejects(()=>startAttempt(student,{code:'ZZZZZ'}),/quá nhiều/);
  console.log('SQL integration passed: hidden content, code once-per-student, abandonment, expiry, snapshots, private marks, published promotion, replay and rate limit.');
}finally{hook.deregister();await db.close();delete globalThis.__testDb;}
