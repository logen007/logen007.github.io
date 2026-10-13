// Exercise the production Fastify routes with signed cookies and an isolated
// PostgreSQL engine. No listening socket, production DB, email or AI provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {AsyncLocalStorage} from 'node:async_hooks';
import {registerHooks} from 'node:module';
import {gunzipSync} from 'node:zlib';
import Fastify from '../server/node_modules/fastify/fastify.js';
import {sign} from '../server/node_modules/@fastify/cookie/signer.js';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite(),tx=new AsyncLocalStorage(),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-http-'));
let revision=0,queries=0,summaryLoads=0;
const query=async(sql,args)=>{
  queries++;if(sql.includes('FROM questions ORDER BY'))summaryLoads++;
  const result=await (tx.getStore()||db).query(sql,args);
  if(/^\s*(INSERT|UPDATE|DELETE)/.test(sql)&&result.affectedRows)revision++;
  return {...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)};
};
const secret='synthetic-test-cookie-secret';
process.env.COOKIE_SECRET=secret;process.env.NODE_ENV='test';
process.env.WEB_PUBLIC_DIR=path.resolve('.web-build');process.env.WEB_ASSETS_DIR=path.join(scratch,'assets');process.env.UPLOAD_DIR=path.join(scratch,'uploads');
if(process.env.G2G_PREVIEW_PORT)process.env.PORT=process.env.G2G_PREVIEW_PORT;
globalThis.__httpDb={query,withTx:fn=>db.transaction(client=>tx.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),getDataRevision:()=>revision,audit:async()=>{},initDb:async()=>{},now:()=>new Date().toISOString(),uid:()=> 'new-test-attempt',appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
globalThis.__testFastify=options=>{
  const app=Fastify({...options,logger:false});
  if(!process.env.G2G_PREVIEW_PORT)app.listen=async()=>app.ready();
  else app.get('/__fixture/admin',(_request,reply)=>reply.header('Set-Cookie','g2g_session='+encodeURIComponent(sign('admin',secret))+'; Path=/; HttpOnly; SameSite=Lax').redirect('/adm'));
  return app;
};
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier.endsWith('/db.js')||specifier==='./db.js'||specifier==='../db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,getDataRevision,audit,initDb,now,uid,appError}=globalThis.__httpDb; export const pool={query,end:async()=>{}};'};
  if(specifier==='fastify')return {shortCircuit:true,url:'data:text/javascript,export default globalThis.__testFastify;'};
  if(specifier==='nodemailer')return {shortCircuit:true,url:'data:text/javascript,export default {createTransport(){throw Error("External mail forbidden")}};'};
  return next(specifier,context);
}});
let app;
try{
  await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  await query("INSERT INTO users(id,email,role,data) VALUES('admin','admin@example.test','master','{\"name\":\"Admin\"}')");
  await query("INSERT INTO users(id,email,role,data) SELECT 's'||i,'s'||i||'@example.test','student',jsonb_build_object('name','Synthetic '||i) FROM generate_series(0,199) i");
  const question={id:'q',type:'single',skill:'Đọc',maxScore:1,autoGrade:true,correctAnswer:0,choices:['A','B'],prompt:'private passage '.repeat(1000)};
  const exam={id:'e',title:'Fixture',provider:'GOETHE',level:'A1',sections:[{id:'part',name:'Đọc 1',skill:'Đọc',timeMinutes:10,questionIds:['q']}]};
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('e','admin','published',$1)",[JSON.stringify(exam)]);
  await query("INSERT INTO questions(id,owner_id,data) VALUES('q','admin',$1)",[JSON.stringify(question)]);
  const deadline=Date.now()+600000;
  await query("INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data,private_data) SELECT 'a'||i,'s'||i,'e','in_progress',1,jsonb_build_object('studentId','s'||i,'examId','e','status','in_progress','answers',jsonb_build_object('q',0),'startedAt',$1::text,'examDeadlineMs',$2::numeric),$3 FROM generate_series(0,199) i",[new Date().toISOString(),deadline,JSON.stringify({examSnapshot:{...exam,questionSnapshot:[question]}})]);
  ({app}=await import('../server/src/index.js'));
  const cookie=id=>'g2g_session='+encodeURIComponent(sign(id,secret));
  const html=await app.inject('/adm');assert.equal(html.statusCode,200);assert.ok(html.body.includes('/assets/app-'));assert.ok(html.headers['cache-control'].includes('no-store'));
  const assets=[...html.body.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match=>match[1]);
  assert.equal(assets.length,4);
  for(const url of assets){const response=await app.inject({url,headers:{'accept-encoding':'br,gzip'}});assert.equal(response.statusCode,200);assert.ok(response.headers['cache-control'].includes('immutable'));assert.equal(response.headers['content-encoding'],'br');}
  assert.equal((await app.inject('/assets/missing-old-chunk.js')).statusCode,404);
  const first=await app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'accept-encoding':'gzip'}});
  assert.equal(first.statusCode,200);assert.equal(first.headers['content-encoding'],'gzip');assert.ok(first.headers.vary.includes('Cookie'));
  const summary=JSON.parse(gunzipSync(first.rawPayload));assert.equal(summary.scope,'summary');assert.ok(!JSON.stringify(summary).includes('private passage'));
  const before=summaryLoads;
  const conditional=await Promise.all(Array.from({length:20},()=>app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'if-none-match':first.headers.etag}})));
  assert.ok(conditional.every(response=>response.statusCode===304));assert.equal(summaryLoads,before,'Conditional hits do not load the question bank');
  assert.equal((await app.inject({url:'/api/state-summary',headers:{cookie:cookie('s0')}})).statusCode,403);
  assert.equal((await app.inject({url:'/api/attempts/a0/session',headers:{cookie:cookie('s1')}})).statusCode,404);
  const start=performance.now();
  const receipts=await Promise.all(Array.from({length:200},(_,i)=>app.inject({method:'POST',url:'/api/actions/submitAttempt',headers:{cookie:cookie('s'+i)},payload:{attemptId:'a'+i}})));
  assert.ok(receipts.every(response=>response.statusCode===200&&response.json().attempt.status==='ready'));
  const changed=await app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'if-none-match':first.headers.etag}});assert.equal(changed.statusCode,200);assert.notEqual(changed.headers.etag,first.headers.etag);
  const session=await app.inject({url:'/api/attempts/a0/session',headers:{cookie:cookie('s0')}});assert.equal(session.statusCode,200);assert.equal(session.json().attempts.length,1);
  console.log(JSON.stringify({test:'Production Fastify injection with isolated SQL, not VPS network capacity',concurrentSubmissions:receipts.length,submissionBurstMs:Math.round(performance.now()-start),entryAssets:assets.length,compression:'Brotli static + gzip JSON',conditionalRequests:20,extraSummaryLoadsOnConditionalHits:summaryLoads-before-1,queries}));
  if(process.env.G2G_PREVIEW_PORT){console.log('Synthetic browser preview: http://127.0.0.1:'+process.env.G2G_PREVIEW_PORT);await new Promise(()=>{});}
}finally{
  if(app)await app.close();hook.deregister();await db.close();delete globalThis.__httpDb;delete globalThis.__testFastify;
}
