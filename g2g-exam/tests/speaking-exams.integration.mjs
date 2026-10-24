// Real Fastify handlers + additive SQL + immutable publications. Every external
// dependency is injected; an accidental real network request fails immediately.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AsyncLocalStorage} from 'node:async_hooks';
import Fastify from '../server/node_modules/fastify/fastify.js';
import {registerSpeakingExamRoutes,runSpeakingExamWorkerOnce} from '../server/src/speaking-exams.js';
import {runSpeakingExamArchiveOnce} from '../server/src/speaking-exam-archive.js';
import {tickSpeakingExam} from '../server/src/speaking-exam-runtime.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH),sql=new PGlite(),context=new AsyncLocalStorage();
const query=async(text,args=[])=>{
 if(text.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};
 const result=await (context.getStore()||sql).query(text,args);return {...result,rowCount:result.affectedRows??result.rows.length};
};
const db={query,withTx:fn=>sql.transaction(c=>context.run(c,()=>fn({query})))};
const error=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const users={a:{id:'a',role:'student'},b:{id:'b',role:'student'},c:{id:'c',role:'student'},d:{id:'d',role:'student'},e:{id:'e',role:'student'},f:{id:'f',role:'student'},t:{id:'t',name:'Owner',role:'teacher'},x:{id:'x',role:'teacher'},m:{id:'m',role:'master'}};
const auth={requireUser:async r=>{const user=users[r.headers['test-user']];if(!user)throw error(401,'Đăng nhập');return user;},requireRole:async(r,...roles)=>{const user=await auth.requireUser(r);if(!roles.includes(user.role))throw error(403,'Không có quyền');return user;}};
let time=Date.parse('2026-10-24T09:00:00Z'),configured=true,maintenance=false,failCreateOnce=false,failStartOnce=false,failStopOnce=false,loseStopOnce=false,staleConfigOnce=false;
let deferredCreate=null;
const rooms=new Map(),recordings=new Map(),peers=new Map(),calls=[],config={accessKey:'synthetic-access-key',appSecret:'synthetic-secret-long-enough',templateId:'synthetic-template',role:'student',recordingDestination:'default'};
const media=id=>({id,connected:true,devices:1,audio:true,video:true});
const provider={
 readConfig:async c=>{if(staleConfigOnce&&!c){staleConfigOnce=false;return {...config,templateId:'stale-template'};}return configured?config:null;},
 presence:async(_config,roomId,members)=>members.map(m=>peers.get(roomId)?.[m.id]||{id:m.id,connected:false,devices:0,audio:false,video:false}),
 request:async(_config,path,{method='GET',body}={})=>{
  calls.push({path,method,body});
  if(path==='rooms'&&method==='POST'){
   assert.equal(_config.templateId,config.templateId,'Allocation uses config read inside capacity lock');
   const room={id:'room-'+(rooms.size+1),name:body.name,template_id:body.template_id};rooms.set(room.id,room);
   if(deferredCreate){const deferred=deferredCreate;deferred.enter();await deferred.wait;}
   if(failCreateOnce){failCreateOnce=false;throw error(502,'Synthetic lost room response');}return room;
  }
  if(path.startsWith('rooms?name=')){const name=new URLSearchParams(path.split('?')[1]).get('name');return {data:[...rooms.values()].filter(r=>r.name===name)};}
  if(path.startsWith('recordings?room_id=')){const id=new URLSearchParams(path.split('?')[1]).get('room_id');return {data:[...recordings.values()].filter(r=>r.room_id===id)};}
  const start=path.match(/^recordings\/room\/(.+)\/start$/);
  if(start){const rec={id:'recording-'+(recordings.size+1),room_id:start[1],status:'starting',recording_assets:[]};recordings.set(rec.id,rec);if(failStartOnce){failStartOnce=false;throw error(502,'Synthetic lost recording response');}return rec;}
  const stop=path.match(/^recordings\/room\/(.+)\/stop$/);
  if(stop){if(failStopOnce){failStopOnce=false;throw error(502,'Synthetic stop failure');}for(const r of recordings.values())if(r.room_id===stop[1]){if(r.status==='post_processing')throw error(409,'Already stopped');r.status='post_processing';}if(loseStopOnce){loseStopOnce=false;throw error(502,'Accepted stop response lost');}return {};}
  if(path.startsWith('recordings/')){const r=recordings.get(path.slice('recordings/'.length));assert.ok(r,'Expected synthetic recording');return structuredClone(r);}
  const end=path.match(/^active-rooms\/(.+)\/end-room$/);if(end){assert.equal(body.lock,true);peers.delete(end[1]);return {};}
  const disable=path.match(/^rooms\/(.+)$/);if(disable&&method==='POST'){rooms.get(disable[1]).enabled=false;return {};}
  assert.fail('Unexpected provider operation: '+method+' '+path);
 },
 stream:async(_fileId,request,reply)=>{assert.equal(request.headers.range,'bytes=0-3');reply.code(206).header('content-range','bytes 0-3/4').header('content-type','video/mp4');return reply.send(Buffer.from('test'));}
};
const options={db,auth,provider,now:()=>time,getSettings:async()=>({operations:{maintenanceMode:maintenance,maintenanceMessage:'Bảo trì'}}),audit:async()=>{}};
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>assert.fail('Real external network is prohibited');process.env.PUBLIC_URL='https://g2g.test';
const app=Fastify();registerSpeakingExamRoutes(app,options);
const send=(method,path,user,body,headers={})=>app.inject({method,url:'/api/speaking-exams'+path,headers:{origin:'https://g2g.test','test-user':user,'user-agent':'iPhone Safari',...headers},...(body===undefined?{}:{payload:body})});
const must=async promise=>{const response=await promise;assert.equal(response.statusCode,200,response.body);return response.json();};
const worker=()=>runSpeakingExamWorkerOnce(options);
const sessionRow=async id=>(await query('SELECT * FROM speaking_exam_sessions WHERE id=$1',[id])).rows[0];
const view=(id,user='a')=>must(send('GET','/sessions/'+id,user));
const stage={id:'part-1',title:'G2G first part',instruction:'Discuss the shared topic',promptA:'PRIVATE_A_ONE',promptB:'PRIVATE_B_ONE',imageAUrl:'',imageBUrl:'',seconds:30,speakerSeat:'both',criteria:[{id:'interaction',label:'Interaction',maxScore:10}]};
try{
 await sql.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
 for(const [id,user] of Object.entries(users))await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4::jsonb)',[id,id+'@example.test',user.role,JSON.stringify({name:id.toUpperCase(),level:'A1',classId:['d','f'].includes(id)?'class-2':'class-1',profileCompletedAt:new Date(time).toISOString()})]);
 assert.equal((await send('POST','','a',{title:'No',level:'B1'})).statusCode,403);
 assert.equal((await send('POST','','t',{title:'No',level:'B1'},{origin:'https://evil.test'})).statusCode,403);
 let {exam}=await must(send('POST','','t',{title:'G2G speaking',level:'B1'})),examId=exam.id;
 assert.equal(exam.kind,'speaking');assert.equal(exam.provider,null);
 assert.equal((await send('GET','/'+examId,'x')).statusCode,403);
 assert.equal((await send('GET','/'+examId,'a')).statusCode,403);
 assert.equal((await send('POST','/'+examId+'/publish','t',{})).statusCode,400,'Incomplete publication rejected');
 const edit={...exam,speaking:{stages:[stage,{...stage,id:'part-2',title:'Second part',promptA:'PRIVATE_A_TWO',promptB:'PRIVATE_B_TWO',speakerSeat:'B',criteria:[{id:'fluency',label:'Fluency',maxScore:5}]}]}};
 const saveBody={version:exam.version,exam:edit};exam=(await must(send('PUT','/'+examId,'t',saveBody))).exam;
 assert.equal((await must(send('PUT','/'+examId,'t',saveBody))).exam.version,exam.version,'Lost save response exact retry is idempotent');
 assert.equal((await send('PUT','/'+examId,'t',{...saveBody,exam:{...edit,title:'Stale change'}})).statusCode,409);
 assert.equal((await send('POST','/'+examId+'/publish','t',{version:1})).statusCode,409);
 const publishBody={version:exam.version};exam=(await must(send('POST','/'+examId+'/publish','t',publishBody))).exam;
 assert.equal((await must(send('POST','/'+examId+'/publish','t',publishBody))).exam.version,exam.version,'Lost publication acknowledgement retry does not create another version');
 assert.equal(exam.publicationVersion,1);assert.equal((await query('SELECT count(*)::int AS n FROM exam_releases')).rows[0].n,1);
 assert.equal((await send('PUT','/'+examId,'t',{version:exam.version,exam:edit})).statusCode,409);
 const copy=(await must(send('POST','/'+examId+'/copy','t',{}))).exam;assert.equal(copy.status,'draft');assert.deepEqual(copy.speaking,edit.speaking);assert.equal(copy.publicationVersion,undefined);
 configured=false;assert.equal((await send('POST','/'+examId+'/queue','a',{})).statusCode,503);configured=true;
 maintenance=true;assert.equal((await send('POST','/'+examId+'/queue','a',{})).statusCode,409);maintenance=false;
 await query("UPDATE users SET data=data-'profileCompletedAt' WHERE id='f'");assert.equal((await send('POST','/'+examId+'/queue','f',{})).statusCode,409);
 assert.equal((await send('POST','/'+examId+'/queue','a',{}, {'user-agent':'Macintosh Chrome'})).statusCode,400);
 const queue=await must(send('POST','/'+examId+'/queue','a',{}));assert.equal(queue.queue.state,'waiting');assert.equal(queue.queue.examId,examId);
 const parallel=await Promise.all([send('POST','/'+examId+'/queue','b',{}),send('POST','/'+examId+'/queue','c',{})]);for(const r of parallel)assert.equal(r.statusCode,200,r.body);
 const paired=parallel.map(r=>r.json()).find(v=>v.session),id=paired.session.id,p='/sessions/'+id;
 assert.equal((await query('SELECT count(*)::int AS n FROM speaking_exam_sessions')).rows[0].n,1,'Concurrent requests create exactly one pair');
 assert.equal((await query('SELECT count(*)::int AS n FROM speaking_exam_members WHERE active=true')).rows[0].n,2);
 assert.equal((await must(send('GET','/queue','a'))).session.id,id,'Existing account resumes same pair');
 let a=await view(id);const partner=a.members.find(m=>m.id!=='a').id,other=['b','c'].find(x=>x!==partner);
 const ownSeat=a.seat,otherSeat=ownSeat==='A'?'B':'A';
 assert.equal(a.state,'preparing');assert.equal(a.preparation[0].prompt,'PRIVATE_'+ownSeat+'_ONE');assert.ok(!JSON.stringify(a).includes('PRIVATE_'+otherSeat+'_ONE'));
 assert.equal(a.preparation[1].prompt,'PRIVATE_'+ownSeat+'_TWO','Preparation includes own prompt even in passive speaking part');
 assert.equal((await send('GET',p,other)).statusCode,403);assert.equal((await send('GET',p+'/grading','x')).statusCode,403);
 assert.equal((await send('POST',p+'/join','a',{})).statusCode,409,'No call token in preparation');
 const readyRevision=a.revision;
 for(const revision of [0,-1,readyRevision+1,'1',null])assert.equal((await send('POST',p+'/ready','a',{revision})).statusCode,409,'Invalid or future readiness revisions are rejected');
 const readyResponses=await Promise.all([send('POST',p+'/ready','a',{revision:readyRevision}),send('POST',p+'/ready',partner,{revision:readyRevision})]);
 for(const response of readyResponses)assert.equal(response.statusCode,200,response.body);
 a=await view(id);assert.equal(a.state,'joining','Both candidates enter joining on their first concurrent ready click');assert.ok(a.members.every(m=>m.ready));
 const joinedRevision=a.revision;
 await query("UPDATE speaking_exam_sessions SET data=jsonb_set(data,'{runtimeLease}',$2::jsonb) WHERE id=$1",[id,JSON.stringify({id:'synthetic-ready-lease',until:time+60000})]);
 for(const student of ['a',partner]){const repeated=await must(send('POST',p+'/ready',student,{revision:readyRevision}));assert.equal(repeated.state,'joining');assert.equal(repeated.revision,joinedRevision,'Repeated ready does not change revision or reverse state, including during a worker lease');}
 assert.equal((await sessionRow(id)).data.runtimeLease.id,'synthetic-ready-lease','Idempotent ready does not revoke an active worker fence');
 assert.equal((await send('POST',p+'/ready','a',{revision:joinedRevision+1})).statusCode,409,'Future revision is rejected even after becoming ready');
 await query("UPDATE speaking_exam_sessions SET data=data-'runtimeLease' WHERE id=$1",[id]);
 await worker();a=await view(id);assert.equal(a.canJoin,true);
 const join=await must(send('POST',p+'/join','a',{})),claims=JSON.parse(Buffer.from(join.token.split('.')[1],'base64url'));assert.equal(claims.type,'app');assert.equal(claims.user_id,'a');assert.equal(claims.role,'student');
 let row=await sessionRow(id);const roomId=row.data.roomId;peers.set(roomId,{a:media('a'),[partner]:media(partner)});
 assert.equal((await send('POST',p+'/join','a',{})).statusCode,409,'One connected device per candidate');
 assert.equal((await send('POST',p+'/connected','a',{consent:false})).statusCode,400);
 for(const student of ['a',partner])await must(send('POST',p+'/connected',student,{consent:true}));
 await worker();a=await view(id);assert.equal(a.state,'starting');assert.equal(a.stage,null,'Start acknowledgement does not start clock');
 row=await sessionRow(id);const recording=recordings.get(row.data.recordingId);recording.status='running';recording.started_at=new Date(time).toISOString();await worker();a=await view(id);assert.equal(a.state,'running');assert.equal(a.stage.prompt,'PRIVATE_'+ownSeat+'_ONE');
 assert.equal((await send('POST',p+'/next','a',{stageIndex:99})).statusCode,409);
 time+=2000;peers.get(roomId)[partner].audio=false;await worker();a=await view(id);assert.equal(a.state,'paused');const remaining=a.remaining,recoveryDeadline=a.recoveryDeadline;
 time+=5000;peers.get(roomId)[partner].audio=true;await worker();a=await view(id);assert.equal(a.state,'running');assert.equal(a.deadline,time+remaining,'Pause survives persisted worker reload and resumes remaining time');assert.ok(recoveryDeadline>time);
 await must(send('POST',p+'/next','a',{stageIndex:0}));await worker();assert.equal((await view(id)).stageIndex,0,'One candidate cannot skip partner');
 await must(send('POST',p+'/next',partner,{stageIndex:0}));await worker();a=await view(id);assert.equal(a.stageIndex,1);assert.equal((await view(id,ownSeat==='A'?'a':partner)).stage.prompt,'','Passive prompt remains private during call');
 time+=31000;failStopOnce=true;await worker();assert.equal((await view(id)).state,'finishing','Cleanup failure cannot fake completion');
 assert.ok(calls.some(c=>c.path===`active-rooms/${roomId}/end-room`));assert.ok(calls.some(c=>c.path===`rooms/${roomId}`&&c.body.enabled===false),'Other cleanup steps proceed when stop fails');
 time+=5000;await worker();row=await sessionRow(id);assert.equal(row.state,'processing');assert.equal(row.data.roomClosed,true);
 assert.equal((await query('SELECT active FROM speaking_exam_members WHERE session_id=$1 AND student_id=$2',[id,'a'])).rows[0].active,false,'Closed processing room releases candidate for next pair');
 recording.status='completed';recording.recording_assets=[{id:'asset-'+id,type:'room-composite',status:'completed'}];await worker();row=await sessionRow(id);assert.equal(row.state,'completed');assert.equal(row.data.driveArchive.state,'queued');
 assert.equal((await send('GET',p+'/recording','a')).statusCode,403);assert.equal((await send('GET',p+'/recording','t')).statusCode,409);
 assert.equal((await send('PUT',p+'/review/a','t',{version:0,review:{scores:{interaction:5}}})).statusCode,409,'Unarchived call cannot be graded');
 let generated=0,transfers=0;const archiveOptions={db,now:()=>time,generateFileId:async()=>{generated++;return 'private-stable-id';},archiveRecording:async(job,save)=>{transfers++;await save({...job.archive,size:4,md5:'synthetic-checksum'});if(transfers===1)throw Error('Synthetic Drive transfer failure');assert.equal(job.archive.fileId,'private-stable-id');}};
 await runSpeakingExamArchiveOnce(archiveOptions);row=await sessionRow(id);assert.equal(row.state,'completed');assert.equal(row.data.driveArchive.state,'retrying');assert.equal(row.data.driveArchive.fileId,'private-stable-id');assert.equal(row.data.driveArchive.md5,'synthetic-checksum');
 time=row.data.driveArchive.retryAt;await Promise.all([runSpeakingExamArchiveOnce(archiveOptions),runSpeakingExamArchiveOnce(archiveOptions)]);row=await sessionRow(id);assert.equal(row.data.driveArchive.state,'saved');assert.equal(generated,1);assert.equal(transfers,2,'Archive lease prevents duplicate concurrent transfers');
 assert.equal((await send('GET',p+'/recording','x')).statusCode,403);const video=await send('GET',p+'/recording','t',undefined,{range:'bytes=0-3'});assert.equal(video.statusCode,206);assert.equal(video.headers['content-range'],'bytes 0-3/4');
 assert.equal((await send('PUT',p+'/review/a','x',{version:0,review:{scores:{interaction:5}}})).statusCode,403);
 assert.equal((await send('PUT',p+'/review/a','t',{version:0,review:{scores:{interaction:11}}})).statusCode,400);
 const reviewBody={version:0,review:{scores:{interaction:7},feedback:'PRIVATE DRAFT FEEDBACK'}};let review=(await must(send('PUT',p+'/review/a','t',reviewBody))).review;
 assert.equal(review.complete,false);assert.equal((await must(send('PUT',p+'/review/a','t',reviewBody))).review.version,1,'Lost grade save response exact retry is idempotent');
 assert.ok(!JSON.stringify(await view(id)).includes('PRIVATE DRAFT FEEDBACK'));assert.deepEqual((await must(send('GET','/results','a'))).results,[]);
 assert.equal((await send('POST',p+'/review/a/publish','t',{version:review.version})).statusCode,400,'Cannot invent missing criterion points');
 review=(await must(send('PUT',p+'/review/a','t',{version:review.version,review:{scores:{interaction:7,fluency:4},feedback:'Published own feedback'}}))).review;
 assert.equal((await send('PUT',p+'/review/a','t',reviewBody)).statusCode,409,'Non-identical stale grade rejected');
 const gradePublishBody={version:review.version};review=(await must(send('POST',p+'/review/a/publish','t',gradePublishBody))).review;assert.equal(review.total,11);assert.ok(review.publishedAt);
 assert.deepEqual((await must(send('POST',p+'/review/a/publish','t',gradePublishBody))).review,review,'Lost grade publication acknowledgement replay returns the same receipt');
 const ownResults=(await must(send('GET','/results','a'))).results;assert.equal(ownResults.length,1);assert.equal(ownResults[0].total,11);assert.ok(!JSON.stringify(ownResults).includes('private-stable-id'));assert.ok(!JSON.stringify(ownResults).includes('PRIVATE_B'));
 assert.equal((await view(id,partner)).result,null,'Partner result is independently unpublished');assert.deepEqual((await must(send('GET','/results',partner))).results,[]);
 assert.equal((await send('PUT',p+'/review/a','t',{version:review.version,review:{scores:{interaction:0,fluency:0}}})).statusCode,409,'Published grade immutable');
 const reviewList=await must(send('GET','/reviews','t'));assert.equal(reviewList.sessions.length,1);assert.ok(!JSON.stringify(reviewList).includes('PRIVATE_A'),'List contains no pinned prompts');assert.deepEqual((await must(send('GET','/reviews','x'))).sessions,[]);
 // Unpublish clears waiting requests, but preserves pinned historical content.
 const unpublishBody={version:exam.version};exam=(await must(send('POST','/'+examId+'/unpublish','t',unpublishBody))).exam;
 assert.equal((await must(send('POST','/'+examId+'/unpublish','t',unpublishBody))).exam.version,exam.version,'Lost unpublish acknowledgement replay does not modify the draft');
 assert.equal((await query('SELECT count(*)::int AS n FROM speaking_exam_queue WHERE exam_id=$1',[examId])).rows[0].n,0);
 assert.equal((await send('POST','/'+examId+'/queue','a',{})).statusCode,404);
 exam=(await must(send('PUT','/'+examId,'t',{version:exam.version,exam:{...exam,title:'Next publication',speaking:{stages:[{...stage,promptA:'VERSION_TWO_A'}]}}}))).exam;
 exam=(await must(send('POST','/'+examId+'/publish','t',{version:exam.version}))).exam;assert.equal(exam.publicationVersion,2);assert.equal((await sessionRow(id)).data.examSnapshot.title,'G2G speaking');
 await query("UPDATE exams SET data=data||'{\"hidden\":true}'::jsonb WHERE id=$1",[examId]);assert.equal((await send('POST','/'+examId+'/queue','a',{})).statusCode,404);await query("UPDATE exams SET data=data||'{\"hidden\":false}'::jsonb WHERE id=$1",[examId]);
 // Cross-class pairing opens only when each candidate has waited 60 seconds.
 await must(send('POST','/'+examId+'/queue','c',{}));await must(send('POST','/'+examId+'/queue','d',{}));assert.equal((await query('SELECT count(*)::int AS n FROM speaking_exam_sessions')).rows[0].n,1);
 time+=59000;assert.equal((await must(send('GET','/queue','c'))).session,null);time+=1000;
 const cross=(await must(send('GET','/queue','d'))).session;assert.ok(cross);assert.equal(cross.publicationVersion,2);
 const crossId=cross.id;await must(send('POST','/sessions/'+crossId+'/leave','c',{}));assert.equal((await view(crossId,'d')).state,'cancelled');assert.equal((await query('SELECT active FROM speaking_exam_members WHERE session_id=$1 LIMIT 1',[crossId])).rows[0].active,false);
 // Heartbeat expiry does not fabricate a queue position or retain ghost users.
 await must(send('POST','/'+examId+'/queue','e',{}));time+=120001;assert.equal((await must(send('GET','/queue','e'))).queue,null);
 // Lost room/start responses recover by durable intent + provider GET, one POST.
 await must(send('POST','/'+examId+'/queue','a',{}));const recover=(await must(send('POST','/'+examId+'/queue',partner,{}))).session,recoverId=recover.id,rp='/sessions/'+recoverId;
 let rv=await view(recoverId);rv=await must(send('POST',rp+'/ready','a',{revision:rv.revision}));await must(send('POST',rp+'/ready',partner,{revision:rv.revision}));
 failCreateOnce=true;staleConfigOnce=true;const roomCalls=calls.filter(c=>c.path==='rooms'&&c.method==='POST').length;await worker();let rr=await sessionRow(recoverId);assert.ok(rr.data.roomRequestedAt);assert.equal(rr.data.roomId,undefined);
 time+=5000;await worker();rr=await sessionRow(recoverId);assert.ok(rr.data.roomId);assert.equal(calls.filter(c=>c.path==='rooms'&&c.method==='POST').length,roomCalls+1);
 peers.set(rr.data.roomId,{a:media('a'),[partner]:media(partner)});for(const student of ['a',partner])await must(send('POST',rp+'/connected',student,{consent:true}));
 failStartOnce=true;await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'starting');assert.equal(rr.data.recordingId,undefined);
 const startedCalls=calls.filter(c=>c.path.endsWith('/start')).length;time+=5000;await worker();rr=await sessionRow(recoverId);assert.ok(rr.data.recordingId);assert.equal(calls.filter(c=>c.path.endsWith('/start')).length,startedCalls);
 recordings.get(rr.data.recordingId).status='running';await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'running');
 // More than a batch of old processing jobs must not starve a live room.
 for(let i=0;i<24;i++){
  const pendingId='synthetic-processing-'+i,recId='synthetic-recording-'+i;recordings.set(recId,{id:recId,room_id:'synthetic-room-'+i,status:'post_processing',recording_assets:[]});
  const data={...structuredClone(rr.data),id:pendingId,state:'processing',recordingId:recId,recordingStatus:'post_processing',finishedAt:time,roomClosed:true,roomReserved:false,runtimeLease:{id:'done',until:0}};
  delete data.assetId;delete data.retryAt;
  await query("INSERT INTO speaking_exam_sessions(id,owner_id,exam_id,publication_version,state,data,created_at,updated_at) VALUES($1,'t',$2,2,'processing',$3::jsonb,'2026-01-01','2026-01-01')",[pendingId,examId,JSON.stringify(data)]);
 }
 peers.get(rr.data.roomId)[partner].video=false;time+=1000;await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'paused');const end=rr.data.recoveryDeadline;
 peers.get(rr.data.roomId)[partner].video=true;time=end;loseStopOnce=true;await worker();rr=await sessionRow(recoverId);assert.equal(rr.data.outcome,'interrupted','Late reconnect cannot resume beyond 120 seconds');assert.equal(rr.state,'finishing');
 const stopCount=calls.filter(c=>c.path===`recordings/room/${rr.data.roomId}/stop`).length;await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'processing','Lost stop response recovered with GET despite non-idempotent stop API');assert.equal(calls.filter(c=>c.path===`recordings/room/${rr.data.roomId}/stop`).length,stopCount);
 assert.equal((await query('SELECT active FROM speaking_exam_members WHERE session_id=$1 LIMIT 1',[recoverId])).rows[0].active,false,'Interrupted closed call can immediately requeue while recording processes');
 await query("DELETE FROM speaking_exam_sessions WHERE id LIKE 'synthetic-processing-%'");
 time+=30*60000;await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'interrupted');
 const lateRecording=recordings.get(rr.data.recordingId);lateRecording.status='completed';lateRecording.recording_assets=[{id:'late-asset',type:'room-composite',status:'completed'}];time+=60000;await worker();rr=await sessionRow(recoverId);assert.equal(rr.state,'interrupted');assert.equal(rr.data.assetId,'late-asset','Late asset remains recoverable after processing timeout');assert.equal(rr.data.driveArchive.state,'queued');
 // Reservation committed immediately before a crash can be cancelled without
 // holding one of the four slots forever, and trial rooms share that capacity.
 await must(send('POST','/'+examId+'/queue','a',{}));const reserved=(await must(send('POST','/'+examId+'/queue',partner,{}))).session,reservedId=reserved.id;
 let reservedView=await view(reservedId);reservedView=await must(send('POST','/sessions/'+reservedId+'/ready','a',{revision:reservedView.revision}));await must(send('POST','/sessions/'+reservedId+'/ready',partner,{revision:reservedView.revision}));
 for(let i=0;i<4;i++)await query("INSERT INTO speaking_lab_sessions(id,owner_id,data) VALUES($1,'m',$2::jsonb)",['synthetic-trial-'+i,JSON.stringify({roomId:'trial-room-'+i,state:'processing'})]);
 const beforeCapacity=calls.filter(c=>c.path==='rooms'&&c.method==='POST').length;await worker();assert.equal(calls.filter(c=>c.path==='rooms'&&c.method==='POST').length,beforeCapacity,'Trial processing rooms count toward shared capacity');assert.equal((await view(reservedId)).state,'joining');
 await query("DELETE FROM speaking_lab_sessions WHERE id LIKE 'synthetic-trial-%'");
 await query("UPDATE speaking_exam_sessions SET data=data||'{\"roomReserved\":true}'::jsonb WHERE id=$1",[reservedId]);await must(send('POST','/sessions/'+reservedId+'/leave','a',{}));const cancelled=await sessionRow(reservedId);assert.equal(cancelled.data.roomReserved,false);assert.equal(cancelled.data.roomClosed,true);
 // An expired worker cannot overwrite a later cancellation with a slow room
 // response. The next owner recovers that room by name and closes it safely.
 await must(send('POST','/'+examId+'/queue','a',{}));const fenced=(await must(send('POST','/'+examId+'/queue',partner,{}))).session,fencedId=fenced.id;
 let fencedView=await view(fencedId);fencedView=await must(send('POST','/sessions/'+fencedId+'/ready','a',{revision:fencedView.revision}));await must(send('POST','/sessions/'+fencedId+'/ready',partner,{revision:fencedView.revision}));
 let entered,release;const enteredPromise=new Promise(resolve=>entered=resolve),wait=new Promise(resolve=>release=resolve);deferredCreate={enter:entered,wait};
 const slowWorker=worker();await enteredPromise;time+=120001;await must(send('POST','/sessions/'+fencedId+'/leave','a',{}));release();await slowWorker;deferredCreate=null;
 assert.equal((await view(fencedId)).state,'finishing','Late old worker does not resurrect cancelled attempt');await worker();assert.equal((await view(fencedId)).state,'interrupted');
 // Pure deadline transition also survives a process restart with no requests.
 const preparing={...(await sessionRow(id)).data,id:'synthetic-prep',state:'preparing',roomId:null,roomRequestedAt:null,roomReserved:false,prepDeadline:time,ready:{},markers:[],connectedConsent:{}};
 await tickSpeakingExam(preparing,config,{time,request:provider.request,presence:provider.presence});assert.equal(preparing.state,'joining');
 assert.equal((await query('SELECT count(*)::int AS n FROM attempts')).rows[0].n,0,'Speaking never creates ordinary attempts or promotions');
 assert.equal((await query('SELECT count(*)::int AS n FROM speaking_lab_sessions')).rows[0].n,0,'Trial data stays separate');
 console.log('Paired speaking SQL/API passed: immutable publication, parallel matching, class priority, queue expiry, phone/auth/origin/privacy, persisted preparation/reconnect, recording gate and lost-response recovery, archive lease/retry, separate grades/results.');
}finally{await app.close();await sql.close();globalThis.fetch=originalFetch;}
