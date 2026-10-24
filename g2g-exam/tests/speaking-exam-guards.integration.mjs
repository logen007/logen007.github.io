// Production SQL/state/action functions in an isolated in-memory database.
// No authentication server, video provider, Drive, email or production data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';

const {PGlite}=await import(process.env.G2G_PGLITE_PATH),db=new PGlite(),context=new AsyncLocalStorage();
const statements=[];
const query=(sql,args)=>{statements.push({sql,inTx:Boolean(context.getStore())});return sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[],rowCount:1}):(context.getStore()||db).query(sql,args).then(result=>({...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)}));};
globalThis.__speakingGuardDb={query,withTx:fn=>db.transaction(client=>context.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),audit:async()=>{},now:()=>new Date().toISOString(),uid:prefix=>prefix+'-'+crypto.randomUUID(),appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
const hook=registerHooks({resolve(specifier,ctx,next){
 if(specifier.endsWith('/db.js'))return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,audit,now,uid,appError}=globalThis.__speakingGuardDb; export const pool={query}; export const getDataRevision=()=>0;'};
 if(specifier==='nodemailer')return {shortCircuit:true,url:'data:text/javascript,export default {createTransport(){throw new Error("External email forbidden in speaking guard test")}};'};
 if(ctx.parentURL?.endsWith('/speaking-lab.js')&&specifier==='./auth.js')return {shortCircuit:true,url:'data:text/javascript,export const {requireUser,requireRole}=globalThis.__speakingGuardAuth;'};
 return next(specifier,ctx);
}});
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('External network forbidden in speaking guard test');};
const owner={id:'owner',role:'teacher',name:'Owner'},other={id:'other',role:'teacher',name:'Other'},master={id:'master',role:'master',name:'Master'},student={id:'student',role:'student',name:'Student',profileCompletedAt:'2026-01-01',classId:'class-1'};
const config={stages:[{id:'talk-part',title:'Trao đổi',instruction:'COMMON_INSTRUCTIONS',promptA:'SECRET_PROMPT_A',promptB:'SECRET_PROMPT_B',imageAUrl:'/uploads/role-a.jpg',imageBUrl:'/uploads/role-b.jpg',seconds:120,speakerSeat:'both',criteria:[{id:'teacher-criterion',label:'PRIVATE_RUBRIC_LABEL',maxScore:15}]}]};
const makeExam=(id='speaking-published')=>({id,ownerId:owner.id,title:'Custom G2G speaking',kind:'speaking',provider:null,learningLevel:null,level:'B2',sections:[],status:'draft',version:1,speaking:structuredClone(config)});
const statusCode=code=>error=>error.statusCode===code;
const secrets=['SECRET_PROMPT_A','SECRET_PROMPT_B','COMMON_INSTRUCTIONS','PRIVATE_RUBRIC_LABEL','role-a.jpg','role-b.jpg','SHOULD_NOT_SHOW_NEW_DRAFT'];
const assertMetadataOnly=value=>{const serialized=JSON.stringify(value);for(const secret of secrets)assert.ok(!serialized.includes(secret),'Private speaking content leaked: '+secret);};
const failures=[];
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
async function proof(name,fn){try{await fn();console.log('PASS '+name);}catch(error){failures.push({name,error});console.error('FAIL '+name+': '+error.message);}}
try{
 await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
 for(const user of [owner,other,master,student])await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4::jsonb)',[user.id,user.id+'@test.invalid',user.role,JSON.stringify(user)]);
 const {commitOperations,loadState}=await import('../server/src/state.js');
 const {loadExamCatalog}=await import('../server/src/exam-catalog.js');
 const {startAttempt,previewAttemptStart}=await import('../server/src/actions/attempts.js');
 const {createExamRelease,publishExamRelease,unpublishExamRelease}=await import('../server/src/exam-releases.js');
 const {deleteTrashedExam}=await import('../server/src/trash-delete.js');
 const {runTrashGarbageCollection}=await import('../server/src/trash-gc.js');
 const {referencedUploadNames}=await import('../server/src/media-gc.js');
 const {createSpeakingExamService,runSpeakingExamWorkerOnce}=await import('../server/src/speaking-exams.js');
 const insertExam=async exam=>query('INSERT INTO exams(id,owner_id,status,data) VALUES($1,$2,$3,$4::jsonb)',[exam.id,owner.id,exam.status,JSON.stringify(exam)]);
 const readExam=async id=>(await query('SELECT * FROM exams WHERE id=$1',[id])).rows[0];
 const releaseSpeaking=async id=>globalThis.__speakingGuardDb.withTx(async client=>createExamRelease(client,(await client.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[id])).rows[0]));
 const upsert=(id,item)=>[{collection:'exams',kind:'upsert',id,item}];
 const initial=makeExam();await insertExam(initial);await releaseSpeaking(initial.id);
 const draft=makeExam('speaking-draft');await insertExam(draft);
 const ordinary={id:'ordinary',ownerId:owner.id,title:'Ordinary compatible exam',level:'B2',provider:null,learningLevel:null,status:'draft',sections:[{id:'reading',name:'Reading',skillKey:'reading',timeMinutes:5,questionIds:['q']}],settings:{}};
 await query('INSERT INTO questions(id,owner_id,data) VALUES($1,$2,$3::jsonb)',['q',owner.id,JSON.stringify({title:'Ordinary question',type:'single',choices:['A','B'],correctAnswer:0,maxScore:1})]);await insertExam(ordinary);

 await proof('student full/catalog and other teacher state contain speaking metadata only',async()=>{
  for(const view of [await loadState(student),await loadExamCatalog(student),await loadState(other),await loadState(other,{summaryOnly:true}),await loadExamCatalog(other)]){
   assertMetadataOnly(view);
   const entry=view.exams.find(exam=>exam.id===initial.id);assert.ok(entry);assert.equal(entry.kind,'speaking');assert.equal(entry.partCount,1);assert.equal(Number(entry.durationSeconds),120);
   assert.equal(entry.speaking,undefined);assert.deepEqual(entry.sections,[]);
  }
  const staff=await loadState(owner);assert.deepEqual(staff.exams.find(exam=>exam.id===initial.id).speaking,config,'Only owner full authoring state retains the config');
  assert.deepEqual((await loadState(master)).exams.find(exam=>exam.id===initial.id).speaking,config);
 });

 await proof('generic commits cannot create or convert speaking exams',async()=>{
  for(const user of [owner,master]){
   await assert.rejects(commitOperations(user,upsert('forged-'+user.id,{...makeExam('forged-'+user.id),ownerId:user.id})),statusCode(409));
   await assert.rejects(commitOperations(user,upsert('ordinary',{...ordinary,kind:'speaking',speaking:config})),statusCode(409));
   await assert.rejects(commitOperations(user,upsert('ordinary',{...ordinary,speaking:config})),statusCode(409));
  }
  assert.equal((await query("SELECT count(*)::int AS n FROM exams WHERE id LIKE 'forged-%'")).rows[0].n,0);
  assert.equal((await readExam('ordinary')).data.kind,undefined);
 });

 await proof('generic saves cannot mutate config, remove speaking kind or publish',async()=>{
  const original=(await readExam(draft.id)).data;
  for(const item of [{...original,speaking:{stages:[]}},{...original,kind:'ordinary',speaking:undefined},{...original,status:'published'},{...original,title:'Generic edit bypass'}])await assert.rejects(commitOperations(owner,upsert(draft.id,item)),statusCode(409));
  await assert.rejects(commitOperations(other,upsert(draft.id,{...original,status:'trash'})),statusCode(403));
  await assert.rejects(publishExamRelease(owner,{examId:draft.id}),statusCode(409));
  await assert.rejects(unpublishExamRelease(owner,{examId:initial.id}),statusCode(409));
  assert.deepEqual((await readExam(draft.id)).data,original);
  assert.equal((await query('SELECT count(*)::int AS n FROM exam_releases WHERE exam_id=$1',[draft.id])).rows[0].n,0);
 });

 await proof('soft trash/restore ignores forged payload and preserves complete config/releases',async()=>{
  const original=await readExam(initial.id),release=(await query('SELECT snapshot FROM exam_releases WHERE exam_id=$1',[initial.id])).rows[0].snapshot;
  await commitOperations(owner,upsert(initial.id,{id:initial.id,ownerId:owner.id,status:'trash',speaking:{stages:[]},publicationVersion:999,title:'FORGED'}));
  let trashed=await readExam(initial.id);assert.equal(trashed.status,'trash');assert.ok(trashed.trashed_at);assert.equal(trashed.data.title,original.data.title);assert.deepEqual(trashed.data.speaking,config);assert.equal(trashed.data.publicationVersion,1);
  await assert.rejects(commitOperations(owner,upsert(initial.id,{id:initial.id,status:'draft'})),statusCode(403));
  await commitOperations(master,upsert(initial.id,{id:initial.id,status:'draft',kind:'ordinary',speaking:{stages:[]},title:'FORGED RESTORE'}));
  const restored=await readExam(initial.id);assert.equal(restored.status,'draft');assert.equal(restored.trashed_at,null);assert.equal(restored.data.kind,'speaking');assert.deepEqual(restored.data.speaking,config);assert.equal(restored.data.title,original.data.title);assert.equal(restored.data.publicationVersion,1);
  assert.deepEqual((await query('SELECT snapshot FROM exam_releases WHERE exam_id=$1',[initial.id])).rows[0].snapshot,release);
  await releaseSpeaking(initial.id);
 });

 await proof('ordinary attempt start and start-preview reject speaking without attempt writes',async()=>{
  for(const fn of [startAttempt,previewAttemptStart])await assert.rejects(fn(student,{examId:initial.id}),error=>error.statusCode===409&&/ghép cặp/.test(error.message));
  assert.equal((await query('SELECT count(*)::int AS n FROM attempts WHERE exam_id=$1',[initial.id])).rows[0].n,0);
  await commitOperations(owner,upsert(ordinary.id,{...ordinary,title:'Ordinary editing still works'}));
  await publishExamRelease(owner,{examId:ordinary.id});
  const started=await startAttempt(student,{examId:ordinary.id});assert.ok(started.attemptId);
 });

 await proof('speaking sessions and queues block permanent purge and keep old media reachable',async()=>{
  const history=makeExam('history'),queued=makeExam('queued'),unused=makeExam('unused');
  for(const exam of [history,queued,unused]){await insertExam(exam);await releaseSpeaking(exam.id);}
  const snapshot={...history,publicationVersion:1};snapshot.speaking.stages[0].imageAUrl='/uploads/session-only-old-image.jpg';
  const session={examId:history.id,publicationVersion:1,examSnapshot:snapshot,state:'completed',members:[{id:student.id,name:student.name,seat:'A'}],assetId:'private-recording-asset',driveArchive:{state:'saved',fileId:'private-drive-file'},reviews:{}};
  await query("INSERT INTO speaking_exam_sessions(id,owner_id,exam_id,publication_version,state,data) VALUES('history-session',$1,$2,1,'completed',$3::jsonb)",[owner.id,history.id,JSON.stringify(session)]);
  const time=Date.now();await query('INSERT INTO speaking_exam_queue(student_id,exam_id,publication_version,level,joined_at,heartbeat_at,expires_at) VALUES($1,$2,1,$3,$4,$4,$5)',[student.id,queued.id,'B2',time,time+60000]);
  for(const exam of [history,queued,unused])await commitOperations(owner,upsert(exam.id,{id:exam.id,status:'trash'}));
  for(const exam of [history,queued])await assert.rejects(deleteTrashedExam({query},exam.id),error=>error.statusCode===409&&/lịch sử thi/.test(error.message));
  const refs=await referencedUploadNames({query});assert.ok(refs.has('session-only-old-image.jpg'),'Pinned session-only prompt images survive media garbage collection');
  const result=await runTrashGarbageCollection({manualUser:master});assert.equal(result.exams,1,'Bulk purge skips referenced exams but can still remove unused trash');
  assert.equal(await readExam(unused.id),undefined);assert.ok(await readExam(history.id));assert.ok(await readExam(queued.id));
  assert.equal((await query("SELECT count(*)::int AS n FROM speaking_exam_sessions WHERE id='history-session'")).rows[0].n,1);
  assert.equal((await query("SELECT data->'driveArchive'->>'fileId' AS file_id FROM speaking_exam_sessions WHERE id='history-session'")).rows[0].file_id,'private-drive-file');
 });

 const insertSession=async(id,data,createdAt=new Date().toISOString())=>query('INSERT INTO speaking_exam_sessions(id,owner_id,exam_id,publication_version,state,data,created_at,updated_at) VALUES($1,$2,$3,1,$4,$5::jsonb,$6,$6)',[id,owner.id,initial.id,data.state,JSON.stringify(data),createdAt]);
 const commonSession=()=>({examId:initial.id,publicationVersion:1,examSnapshot:{...makeExam(initial.id),publicationVersion:1},members:[{id:student.id,name:student.name,seat:'A'},{id:other.id,name:other.name,seat:'B'}],revision:1,ready:{},votes:{},connectedConsent:{},stageIndex:0,markers:[],reviews:{}});
 const readSession=async id=>(await query('SELECT * FROM speaking_exam_sessions WHERE id=$1',[id])).rows[0];
 await proof('teacher grading and own published results paginate beyond 100 without private prompts',async()=>{
  const metadataDb={...globalThis.__speakingGuardDb,query:async(sql,args)=>{const result=await query(sql,args);assertMetadataOnly(result.rows);return result;}};
  const service=createSpeakingExamService({db:metadataDb,provider:{readConfig:async()=>({})}}),time=Date.now();
  const published={version:2,scores:{'teacher-criterion':12},feedback:'OWN_PUBLISHED_FEEDBACK',total:12,maxScore:15,complete:true,publishedAt:time};
  for(let i=0;i<101;i++){
   const id='page-'+String(i).padStart(3,'0'),data={...commonSession(),state:'completed',finishedAt:time,assetId:'private-asset',driveArchive:{state:'saved'},reviews:{[student.id]:published}};
   await insertSession(id,data,new Date(time+i*1000).toISOString());
   await query('INSERT INTO speaking_exam_members(session_id,student_id,seat,active) VALUES($1,$2,$3,false)',[id,student.id,'A']);
  }
  const reviews=await service.reviews(owner);assert.equal(reviews.sessions.length,100);assert.equal(reviews.nextOffset,100);assertMetadataOnly(reviews);
  const olderReviews=await service.reviews(owner,{offset:reviews.nextOffset});assert.ok(olderReviews.sessions.some(session=>session.id==='page-000'));assertMetadataOnly(olderReviews);
  const results=await service.results(student);assert.equal(results.results.length,100);assert.equal(results.nextOffset,100);assertMetadataOnly(results);
  const olderResults=await service.results(student,{offset:results.nextOffset});assert.equal(olderResults.results.length,1);assert.equal(olderResults.results[0].sessionId,'page-000');assert.equal(olderResults.results[0].total,12);assert.equal(olderResults.nextOffset,null);assertMetadataOnly(olderResults);
  await assert.rejects(service.reviews(owner,{offset:-1}),statusCode(400));
 });

 await proof('worker prioritizes live clocks and fairly rotates pending processing jobs',async()=>{
  const time=Date.now(),calls=[];
  try{
   for(let i=0;i<25;i++){
    const id='worker-'+String(i).padStart(2,'0'),live=i===24,data={...commonSession(),state:live?'running':'processing',recordingId:live?'live-recording':'pending-'+i,recordingStatus:live?'running':'post_processing',finishedAt:time-1000,roomId:live?'live-room':undefined,roomOpenedAt:live?time-1000:undefined,deadline:live?time+100000:null,roomClosed:!live};
    await insertSession(id,data,new Date(time-(25-i)*1000).toISOString());
   }
   const options={db:globalThis.__speakingGuardDb,now:()=>time,provider:{readConfig:async()=>({}),presence:async(config,room,members)=>members.map(m=>({id:m.id,connected:true,devices:1,audio:true,video:true})),request:async(config,path)=>{calls.push(path);return {status:path==='recordings/live-recording'?'running':'post_processing'};}}};
   await runSpeakingExamWorkerOnce(options);assert.ok(calls.includes('recordings/live-recording'),'Pending recording jobs must never starve a newer live room clock');
   await runSpeakingExamWorkerOnce(options);
   for(let i=0;i<24;i++)assert.ok(calls.includes('recordings/pending-'+i),'Pending job '+i+' must eventually receive a fair poll');
  }finally{await query("DELETE FROM speaking_exam_sessions WHERE id LIKE 'worker-%'");}
 });

 await proof('a late provider asset is still queued for archive after processing timed out',async()=>{
  const time=Date.now(),id='late-asset',data={...commonSession(),state:'processing',finishedAt:time-30*60000-1,recordingId:'late-provider-recording',recordingStatus:'post_processing',outcome:'completed',roomClosed:true};
  await insertSession(id,data);
  try{
   const options={db:globalThis.__speakingGuardDb,now:()=>time,provider:{readConfig:async()=>({}),request:async(config,path)=>{assert.equal(path,'recordings/late-provider-recording');return {status:'completed',recording_assets:[{id:'late-provider-asset',type:'room-composite',status:'completed'}]};}}};
   await runSpeakingExamWorkerOnce(options);assert.equal((await readSession(id)).state,'interrupted');
   await runSpeakingExamWorkerOnce(options);
   const recovered=await readSession(id);assert.equal(recovered.state,'interrupted','Archival recovery must not revive the failed attempt or fabricate a grade');assert.equal(recovered.data.assetId,'late-provider-asset');assert.equal(recovered.data.driveArchive.state,'queued');assert.deepEqual(recovered.data.reviews,{});
  }finally{await query('DELETE FROM speaking_exam_sessions WHERE id=$1',[id]);}
 });

 await proof('reservation refreshes config under the same lock used by validated config writes',async()=>{
  const previousKey=process.env.SETTINGS_ENCRYPTION_KEY,previousUrl=process.env.PUBLIC_URL;
  process.env.SETTINGS_ENCRYPTION_KEY='speaking-guard-synthetic-encryption-key';process.env.PUBLIC_URL='https://g2g.test';
  const {default:Fastify}=await import('../server/node_modules/fastify/fastify.js'),app=Fastify();
  globalThis.__speakingGuardAuth={requireUser:async()=>master,requireRole:async()=>master};
  const oldRead=deferred(),continueOldRead=deferred(),id='config-race';let firstRead=true,createdWith;
  const oldConfig={accessKey:'old-access-key',appSecret:'old-app-secret-long-enough',templateId:'old-template',role:'student'},newConfig={accessKey:'new-access-key',appSecret:'new-app-secret-long-enough',templateId:'new-template',role:'student'};
  try{
   globalThis.fetch=async(url)=>{
    assert.ok(String(url).startsWith('https://api.100ms.live/v2/templates/'),'Unexpected provider in synthetic config validation');
    return {ok:true,status:200,json:async()=>String(url).endsWith('/recordings')?[{name:'default',maxDuration:3600,compositeRecording:{browserComposite:{enabled:true,autoStart:false}}}]:{roles:{student:{permissions:{},publishParams:{allowed:['audio','video']},subscribeParams:{subscribeToRoles:['student']}}}}};
   };
   const {saveHmsConfig,readHmsConfig}=await import('../server/src/speaking-hms.js');await saveHmsConfig(oldConfig,master);
   const {registerSpeakingLabRoutes}=await import('../server/src/speaking-lab.js');registerSpeakingLabRoutes(app);
   const time=Date.now(),data={...commonSession(),id,state:'joining',joinDeadline:time+120000};await insertSession(id,data);
   const worker=runSpeakingExamWorkerOnce({db:globalThis.__speakingGuardDb,now:()=>time,provider:{
    readConfig:async client=>{const config=await readHmsConfig(client);if(!client&&firstRead){firstRead=false;oldRead.resolve();await continueOldRead.promise;}return config;},
    request:async(config,path)=>{assert.equal(path,'rooms');createdWith=config;return {id:'configuration-race-room'};},
    presence:async(config,room,members)=>members.map(m=>({id:m.id,connected:false,devices:0,audio:false,video:false})),
   }});
   await oldRead.promise;
   const marker=statements.length,response=await app.inject({method:'POST',url:'/api/speaking-lab/config',headers:{origin:'https://g2g.test'},payload:newConfig});
   assert.equal(response.statusCode,200,response.body);
   const writes=statements.slice(marker),secretWrite=writes.findIndex(item=>item.sql.startsWith('INSERT INTO secrets'));
   assert.ok(secretWrite>0&&writes[secretWrite].inTx,'Validated config must be persisted inside its protection transaction');
   assert.ok(writes.slice(0,secretWrite).some(item=>item.inTx&&item.sql.includes('g2g-speaking-room-capacity')),'Config writes and room reservation must share the capacity lock');
   continueOldRead.resolve();await worker;
   assert.equal(createdWith.templateId,newConfig.templateId,'A stale config read before reservation cannot create a room under the old connection');
   const post=()=>app.inject({method:'POST',url:'/api/speaking-lab/config',headers:{origin:'https://g2g.test'},payload:oldConfig});
   assert.equal((await post()).statusCode,409,'Reserved/open paired rooms block credential changes');
   const row=await readSession(id);Object.assign(row.data,{state:'processing',roomReserved:false,roomDisabled:true,roomClosed:true,recordingId:'pending-recording',recordingStatus:'post_processing'});
   await query("UPDATE speaking_exam_sessions SET state='processing',data=$2::jsonb WHERE id=$1",[id,JSON.stringify(row.data)]);
   assert.equal((await post()).statusCode,409,'Pending provider processing still needs the current credentials');
   Object.assign(row.data,{state:'completed',assetId:'pending-archive-asset',driveArchive:{state:'queued'}});
   await query("UPDATE speaking_exam_sessions SET state='completed',data=$2::jsonb WHERE id=$1",[id,JSON.stringify(row.data)]);
   assert.equal((await post()).statusCode,409,'Unarchived assets still need the provider credentials');
  }finally{
   continueOldRead.resolve();await query('DELETE FROM speaking_exam_sessions WHERE id=$1',[id]);await app.close();
   globalThis.fetch=async()=>{throw new Error('External network forbidden in speaking guard test');};
   delete globalThis.__speakingGuardAuth;
   if(previousKey===undefined)delete process.env.SETTINGS_ENCRYPTION_KEY;else process.env.SETTINGS_ENCRYPTION_KEY=previousKey;
   if(previousUrl===undefined)delete process.env.PUBLIC_URL;else process.env.PUBLIC_URL=previousUrl;
  }
 });

 assert.equal(failures.length,0,failures.map(({name,error})=>name+': '+error.stack).join('\n'));
 console.log('Speaking guards SQL: prompt privacy, generic write barriers, compatible ordinary flow, safe Trash and retained session media passed.');
}finally{await db.close();hook.deregister();globalThis.fetch=originalFetch;delete globalThis.__speakingGuardDb;}
