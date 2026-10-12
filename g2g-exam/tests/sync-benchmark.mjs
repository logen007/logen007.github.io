// Isolated SQL microbenchmark, NOT an HTTP/VPS capacity test. No network or production DB.
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
import os from 'node:os';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite();let queries=0;
globalThis.__syncBench={
  query:async(sql,args)=>{queries++;const r=await db.query(sql,args);return {...r,rowCount:r.rows.length};},
  appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode}),
};
const hook=registerHooks({resolve(specifier,ctx,next){
  if(specifier.endsWith('/db.js')||specifier==='./db.js'||specifier==='../db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,appError}=globalThis.__syncBench;export const withTx=()=>{throw Error("Not allowed")};export const audit=()=>{};export const getSettings=()=>({});export const now=()=>new Date().toISOString();export const uid=()=>"fixture";export const pool={query};'};
  return next(specifier,ctx);
}});
try{
  await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const {loadState}=await import('../server/src/state.js');
  const {loadAttemptSync}=await import('../server/src/attempt-sync.js');
  const {stateResponse}=await import('../server/src/state-response.js');
  const student={id:'s',role:'student',name:'Synthetic Student'};
  await db.query("INSERT INTO users(id,email,role,data) SELECT 's'||i,'synthetic'||i||'@example.test','student','{}' FROM generate_series(0,199) i");
  student.id='s0';
  const questionIds=Array.from({length:1000},(_,i)=>'q'+i);
  await db.query("INSERT INTO questions(id,owner_id,data) SELECT 'q'||i,'s0',jsonb_build_object('title',repeat('Synthetic question ',30),'type','single','choices',jsonb_build_array('A','B','C'),'correctAnswer',0) FROM generate_series(0,999) i");
  await db.query("INSERT INTO exams(id,owner_id,status,data) VALUES('e','s0','published',$1)",[JSON.stringify({title:'Synthetic',sections:[{id:'r',questionIds}]})]);
  for(let i=0;i<200;i++)await db.query("INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data) VALUES($1,$2,'e','in_progress',1,$3)",['a'+i,'s'+i,JSON.stringify({id:'a'+i,status:'in_progress',answers:Object.fromEntries(questionIds.slice(0,40).map(id=>[id,1]))})]);
  const reply={header(){return this;}};
  const measure=async(label,fn,n)=>{
    queries=0;const durations=[];let bytes=0;const start=performance.now();
    await Promise.all(Array.from({length:n},async(_,i)=>{
      const t=performance.now();const body=stateResponse(await fn(i),{headers:{}},reply);
      bytes+=Buffer.byteLength(JSON.stringify(body));durations.push(performance.now()-t);
    }));
    durations.sort((a,b)=>a-b);
    return {label,requests:n,queries,totalMs:Math.round(performance.now()-start),p95Ms:Math.round(durations[Math.ceil(n*.95)-1]),meanResponseBytes:Math.round(bytes/n)};
  };
  await loadState(student);await loadAttemptSync(student,'a0');
  const results=[];
  results.push(await measure('previous-full-state-burst',i=>loadState({...student,id:'s'+i}),50));
  for(const n of [50,100,200])results.push(await measure('attempt-only-burst',i=>loadAttemptSync({...student,id:'s'+i},'a'+i),n));
  console.log(JSON.stringify({warning:'SQL-only, in-process PGlite, synthetic data; excludes HTTP/auth/media/writes. NOT production capacity.',machine:{platform:os.platform(),cpu:os.cpus()[0].model,logicalCpu:os.cpus().length,ramGiB:Math.round(os.totalmem()/2**30)},fixture:{questions:1000,attempts:200,answersPerAttempt:40},results},null,2));
}finally{hook.deregister();await db.close();}
