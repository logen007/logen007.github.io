// Exercise the production Fastify routes with signed cookies and an isolated
// PostgreSQL engine. No listening socket, production DB, email or AI provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {AsyncLocalStorage} from 'node:async_hooks';
import {registerHooks} from 'node:module';
import {gunzipSync,inflateSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import Fastify from '../server/node_modules/fastify/fastify.js';
import {sign} from '../server/node_modules/@fastify/cookie/signer.js';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
import {ExamOutbox} from '../src/repositories/exam-outbox.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const db=new PGlite(),tx=new AsyncLocalStorage(),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-http-'));
let revision=0,queries=0,summaryLoads=0,mediaLockWait=null,mediaLockEntered=()=>{};
const query=async(sql,args)=>{
  if(sql.includes('pg_try_advisory_lock_shared')){mediaLockEntered();if(mediaLockWait)await mediaLockWait;return {rows:[{locked:true}],rowCount:1};}
  if(sql.includes('pg_advisory_unlock_shared'))return {rows:[],rowCount:0};
  queries++;if(sql.includes('FROM questions ORDER BY'))summaryLoads++;
  const result=await (tx.getStore()||db).query(sql,args);
  if(/^\s*(INSERT|UPDATE|DELETE)/.test(sql)&&result.affectedRows)revision++;
  return {...result,rowCount:Math.max(result.affectedRows||0,result.rows.length)};
};
const secret='synthetic-test-cookie-secret';
process.env.COOKIE_SECRET=secret;process.env.NODE_ENV='test';
process.env.BACKUP_MEDIA_GUARD_ENABLED='true';
process.env.SETTINGS_ENCRYPTION_KEY='synthetic-sharing-encryption-key';
process.env.WEB_PUBLIC_DIR=path.resolve(process.env.G2G_PREVIEW_PORT&&process.env.G2G_COURSE_PREVIEW_DIR||'.web-build');process.env.WEB_ASSETS_DIR=path.join(scratch,'assets');process.env.UPLOAD_DIR=path.join(scratch,'uploads');
if(process.env.G2G_PREVIEW_PORT)process.env.PORT=process.env.G2G_PREVIEW_PORT;
globalThis.__httpDb={query,withTx:fn=>db.transaction(client=>tx.run(client,()=>fn({query}))),getSettings:async()=>structuredClone(DEFAULT_SETTINGS),getDataRevision:()=>revision,audit:async()=>{},initDb:async()=>{},now:()=>new Date().toISOString(),uid:()=>process.env.G2G_PREVIEW_PORT?randomUUID():'new-test-attempt',appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode})};
globalThis.__testFastify=options=>{
  const app=Fastify({...options,logger:false});
  if(!process.env.G2G_PREVIEW_PORT)app.listen=async()=>app.ready();
  else{
    const listen=app.listen.bind(app);app.listen=options=>listen({...options,host:'127.0.0.1'});
    let dropSaveReceipts=false;
    app.get('/__fixture/drop-save-receipts',(_request,reply)=>{dropSaveReceipts=true;return reply.redirect('/student?view=home');});
    app.get('/__fixture/restore-save-receipts',(_request,reply)=>{dropSaveReceipts=false;return reply.type('text/plain; charset=utf-8').send('Synthetic save acknowledgements restored.');});
    app.get('/__fixture/writing-answer',async(_request,reply)=>{
      const result=await query("SELECT public_data->'answers' AS answers FROM attempts WHERE student_id='admin' AND exam_id='browser-writing-exam' ORDER BY created_at DESC LIMIT 1");
      return reply.type('text/plain; charset=utf-8').send(JSON.stringify(result.rows));
    });
    app.addHook('onSend',(request,reply,payload,done)=>{
      if(dropSaveReceipts&&request.url==='/api/actions/saveAnswers'&&reply.statusCode===200){reply.hijack();reply.raw.destroy();}
      done(null,payload);
    });
    app.get('/__fixture/admin',(_request,reply)=>reply.header('Set-Cookie','g2g_session='+encodeURIComponent(sign('admin',secret))+'; Path=/; HttpOnly; SameSite=Lax').redirect('/adm'));
    for(const [role,id,page] of [['teacher','course-teacher','manage'],['student','s0','catalog'],['master','admin','manage']])app.get('/__fixture/course-'+role,(_request,reply)=>reply.header('Set-Cookie','g2g_session='+encodeURIComponent(sign(id,secret))+'; Path=/; HttpOnly; SameSite=Lax').redirect('/?view=courses&course-page='+page));
    app.get('/__fixture/stalled.wav',(_request,reply)=>{
      reply.hijack();reply.raw.writeHead(200,{'Content-Type':'audio/wav'});reply.raw.flushHeaders();
    });
  }
  return app;
};
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier.endsWith('/db.js')||specifier==='./db.js'||specifier==='../db.js')return {shortCircuit:true,url:'data:text/javascript,export const {query,withTx,getSettings,getDataRevision,audit,initDb,now,uid,appError}=globalThis.__httpDb; export const pool={query,end:async()=>{},connect:async()=>({query:(sql,args)=>sql==="SELECT pg_advisory_xact_lock(182733,2)"?Promise.resolve({rows:[]}):query(sql,args),release(){}})};'};
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
  // Browser-only transport fixture, not an approved full-exam specification.
  // Never enabled by the quality runner or exposed by the production server.
  if(process.env.G2G_PREVIEW_PORT){
    const writing={id:'browser-writing',type:'writing',skill:'Viết',maxScore:10,autoGrade:false,prompt:'Schreiben Sie eine kurze Nachricht an Anna. Ort, Datum und Einladung.',handwriting:false};
    const writingExam={id:'browser-writing-exam',title:'Synthetic writing journey',provider:'GOETHE',level:'A1',sections:[{id:'browser-writing-part',name:'Viết 2',skill:'Viết',timeMinutes:10,questionIds:[writing.id]}]};
    await query("INSERT INTO questions(id,owner_id,data) VALUES($1,'admin',$2)",[writing.id,JSON.stringify(writing)]);
    await query("INSERT INTO exams(id,owner_id,status,data) VALUES($1,'admin','published',$2)",[writingExam.id,JSON.stringify(writingExam)]);
    // A real decodable 1-second PCM tone, and a response intentionally left open.
    const wav=Buffer.alloc(44+16000);
    wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
    wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
    wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
    wav.write('data',36);wav.writeUInt32LE(16000,40);
    for(let i=0;i<8000;i++)wav.writeInt16LE(Math.round(1200*Math.sin(2*Math.PI*440*i/8000)),44+2*i);
    await fs.mkdir(process.env.UPLOAD_DIR,{recursive:true});
    await fs.writeFile(path.join(process.env.UPLOAD_DIR,'synthetic-tone.wav'),wav);
    for(const [key,audioUrl] of [['playback','/uploads/synthetic-tone.wav'],['stalled','/__fixture/stalled.wav']]){
      const audioQuestion={id:'browser-audio-'+key,type:'single',skill:'Nghe',maxScore:1,autoGrade:true,correctAnswer:0,choices:['A','B'],prompt:'Synthetic audio transport check',audioUrl};
      const audioExam={id:'browser-audio-exam-'+key,title:'Synthetic audio '+key,provider:'GOETHE',level:'A1',sections:[{id:'audio-part-'+key,name:'Nghe 1',skill:'Nghe',skillKey:'listening',timeMinutes:10,questionIds:[audioQuestion.id],audioPolicy:{mode:'per_question_segment',segmentRepeat:2,maxSessions:1}}]};
      await query("INSERT INTO questions(id,owner_id,data) VALUES($1,'admin',$2)",[audioQuestion.id,JSON.stringify(audioQuestion)]);
      await query("INSERT INTO exams(id,owner_id,status,data) VALUES($1,'admin','published',$2)",[audioExam.id,JSON.stringify(audioExam)]);
    }
    const {seedBrowserCourses}=await import('./fixtures/course-browser.mjs');
    await seedBrowserCourses(globalThis.__httpDb,process.env.UPLOAD_DIR);
  }
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('e','admin','published',$1)",[JSON.stringify(exam)]);
  await query("INSERT INTO questions(id,owner_id,data) VALUES('q','admin',$1)",[JSON.stringify(question)]);
  const deadline=Date.now()+600000;
  await query("INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data,private_data) SELECT 'a'||i,'s'||i,'e','in_progress',1,jsonb_build_object('studentId','s'||i,'examId','e','status','in_progress','answers',jsonb_build_object('q',0),'startedAt',$1::text,'examDeadlineMs',$2::numeric),$3 FROM generate_series(0,199) i",[new Date().toISOString(),deadline,JSON.stringify({examSnapshot:{...exam,questionSnapshot:[question]}})]);
  ({app}=await import('../server/src/index.js'));
  const cookie=id=>'g2g_session='+encodeURIComponent(sign(id,secret));
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=','base64');
  assert.deepEqual(inflateSync(png.subarray(41,52)),Buffer.from([0,0,255]),'Positive PNG fixture has a decodable scanline');
  const upload=async(route,type,filename,user='admin',bytes=type==='image/png'?png:Buffer.from('synthetic bytes'))=>{
    const boundary='synthetic-boundary';
    return app.inject({method:'POST',url:'/api/media/'+route,headers:{cookie:cookie(user),'content-type':'multipart/form-data; boundary='+boundary},payload:Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)])});
  };
  const image=await upload('image','image/png','payload.html');assert.equal(image.statusCode,200);assert.match(image.json().url,/\.png$/);
  // The real multipart handler must not consume image bytes before the async
  // backup guard grants access. Header fixtures test byte preservation, not decoding.
  const jpeg=Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
  for(const [mime,name,bytes] of [['image/jpeg','course-cover.jpg',jpeg],['image/png','course-cover.png',png]]){
    let release,entered;
    mediaLockWait=new Promise(resolve=>{release=resolve;});const waiting=new Promise(resolve=>{entered=resolve;});mediaLockEntered=entered;
    const pending=upload('image',mime,name,'admin',bytes);
    await waiting;await new Promise(resolve=>setImmediate(resolve));release();
    const response=await pending;mediaLockWait=null;mediaLockEntered=()=>{};
    assert.equal(response.statusCode,200,'Valid '+mime+' headers survive a delayed backup guard: '+response.body);
    assert.deepEqual(await fs.readFile(path.join(process.env.UPLOAD_DIR,path.basename(response.json().url))),bytes,'Upload preserves every byte while the guard waits');
  }
  const courseImage=await upload('course-image','image/png','course.png');assert.equal(courseImage.statusCode,200);
  const oneMB=Buffer.alloc(1024*1024);jpeg.copy(oneMB);
  const exactLimit=await upload('course-image','image/jpeg','limit.jpg','admin',oneMB);assert.equal(exactLimit.statusCode,200,'Course image at 1 MB is accepted');
  assert.deepEqual(await fs.readFile(path.join(process.env.UPLOAD_DIR,path.basename(exactLimit.json().url))),oneMB);
  const filesBeforeLimit=await fs.readdir(process.env.UPLOAD_DIR),overLimit=Buffer.concat([oneMB,Buffer.from([0])]);
  const rejected=await upload('course-image','image/jpeg','over.jpg','admin',overLimit);assert.equal(rejected.statusCode,413);assert.match(rejected.body,/1 MB/);
  assert.deepEqual(await fs.readdir(process.env.UPLOAD_DIR),filesBeforeLimit,'Rejected course images leave no partial file');
  assert.equal((await upload('course-image','image/png','student.png','s0')).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/api/media/course-image'})).statusCode,401);
  assert.equal((await upload('image','image/jpeg','exam.jpg','admin',overLimit)).statusCode,200,'Existing exam uploads retain the 8 MB limit');
  const {imageSharing}=await import('../server/src/image-sharing.js');
  const imageOrigin='http://localhost:8080',imageSource=imageOrigin+image.json().url;
  const grant=(await imageSharing.issue({urls:[imageSource],origin:imageOrigin})).get(imageSource),sharedUrl=new URL(grant.url);
  const secretRecord=await query("SELECT value_enc FROM secrets WHERE key='exam_image_sharing'");
  assert.equal(secretRecord.rows.length,1);assert.doesNotMatch(secretRecord.rows[0].value_enc,/expiresAt|nonce|signature/);
  assert.equal((await app.inject(sharedUrl.pathname+sharedUrl.search)).statusCode,200);
  assert.equal((await app.inject(image.json().url)).statusCode,401,'Original upload remains authenticated');
  assert.equal((await app.inject({method:'POST',url:'/api/exam-images/shares/revoke',headers:{cookie:cookie('admin')},payload:{url:grant.url}})).statusCode,200);
  assert.equal((await app.inject(sharedUrl.pathname+sharedUrl.search)).statusCode,404,'SQL-persisted revocation takes effect immediately');
  assert.equal((await app.inject('/api/exam-images/export')).statusCode,401);
  for(const [method,url] of [['GET','/api/exam-images/status'],['GET','/api/exam-images/sheet'],['POST','/api/exam-images/sync']]){
    assert.equal((await app.inject({method,url})).statusCode,401);
    assert.equal((await app.inject({method,url,headers:{cookie:cookie('s0')}})).statusCode,403);
  }
  const sheetStatus=await app.inject({url:'/api/exam-images/status',headers:{cookie:cookie('admin')}});
  for(const headers of [{},{cookie:cookie('s0')}])assert.equal((await app.inject({method:'POST',url:'/api/exam-images/shares/revoke',headers,payload:{url:'https://example.test/shared-exam-images/a.jpg?signature=synthetic'}})).statusCode,headers.cookie?403:401);
  assert.equal((await app.inject('/shared-exam-images/a.jpg?signature=invalid')).statusCode,404);
  const pickerStatus=await app.inject({url:'/api/exam-images/google-settings',headers:{cookie:cookie('admin')}});
  assert.equal(pickerStatus.statusCode,200);assert.equal(pickerStatus.json().configured,false);
  assert.doesNotMatch(pickerStatus.body,/apiKey|accessToken|refreshToken|clientSecret/);
  for(const [method,url] of [['GET','/api/exam-images/google-settings'],['GET','/api/exam-images/google/connect'],['POST','/api/exam-images/google/disconnect'],['POST','/api/exam-images/google-settings'],['POST','/api/exam-images/picker'],['POST','/api/exam-images/authorize'],['POST','/api/exam-images/disconnect']]){
    assert.equal((await app.inject({method,url})).statusCode,401);
    assert.equal((await app.inject({method,url,headers:{cookie:cookie('s0')}})).statusCode,403);
  }
  assert.equal(sheetStatus.statusCode,200);assert.deepEqual(sheetStatus.json(),{ready:false,url:null,lastSync:null,result:null});
  assert.equal((await app.inject({url:'/api/exam-images/export',headers:{cookie:cookie('s0')}})).statusCode,403);
  await query("INSERT INTO users(id,email,role,data) VALUES('inventory-teacher','teacher@example.test','teacher','{}')");
  assert.equal((await app.inject({url:'/api/exam-images/export',headers:{cookie:cookie('inventory-teacher')}})).statusCode,403);
  await query("UPDATE questions SET data=jsonb_set(data,'{imageUrl}',to_jsonb($1::text)) WHERE id='q'",[image.json().url]);
  const imageExport=await app.inject({url:'/api/exam-images/export',headers:{cookie:cookie('admin')}});
  assert.equal(imageExport.statusCode,200);assert.match(imageExport.headers['content-disposition'],/attachment/);
  assert.equal(imageExport.json().assetCount,1);assert.equal(imageExport.json().assets[0].sourceUrl,'http://localhost:8080'+image.json().url);
  assert.doesNotMatch(imageExport.body,/admin@example|studentId|private passage|correctAnswer/,'Image export excludes identities, attempts and answer content');
  await query("UPDATE questions SET data=data-'imageUrl' WHERE id='q'");
  await query("DELETE FROM users WHERE id='inventory-teacher'");
  const audio=await upload('audio','audio/mpeg','payload.html');assert.equal(audio.statusCode,200);assert.match(audio.json().url,/\.mp3$/);
  assert.equal((await upload('image','image/svg+xml','payload.svg')).statusCode,400);
  assert.equal((await upload('image','text/html','payload.png')).statusCode,400);
  assert.equal((await upload('image','image/png','safe.png','s0')).statusCode,403);
  const beforeInvalid=await fs.readdir(process.env.UPLOAD_DIR);
  for(const bytes of [Buffer.from('<!doctype html><script>synthetic()</script>'),Buffer.alloc(0),png.subarray(0,5)]){
    assert.equal((await upload('image','image/png','spoof.png','admin',bytes)).statusCode,400);
  }
  assert.equal((await upload('image','image/jpeg','mismatch.jpg','admin',png)).statusCode,400);
  assert.deepEqual(await fs.readdir(process.env.UPLOAD_DIR),beforeInvalid,'Rejected new uploads leave no files behind');
  const media=await app.inject({url:image.json().url,headers:{cookie:cookie('admin')}});
  assert.equal(media.headers['x-content-type-options'],'nosniff');assert.match(media.headers['content-type'],/^image\/png/);
  const html=await app.inject('/adm');assert.equal(html.statusCode,200);assert.ok(html.body.includes('/assets/app-'));assert.ok(html.headers['cache-control'].includes('no-store'));
  for(const file of ['privacy.html','terms.html']){
    const policy=await app.inject('/'+file);assert.equal(policy.statusCode,200);
    const stylesheet=policy.body.match(/href="(\/assets\/styles-[^"]+\.css)"/)[1];
    const response=await app.inject(stylesheet);assert.equal(response.statusCode,200);assert.match(response.headers['content-type'],/text\/css/);
    assert.ok(response.body.includes('--surface-inverse:'),'Public policies use the actual shared theme CSS');
    assert.ok(policy.body.includes("localStorage.getItem('g2g.color-mode.v1')"),'Public pages restore the same personal color mode before paint');
    assert.doesNotMatch(policy.body,/\/src\/app.js|\/assets\/app-/,'Policies remain independent of login and application bootstrap');
    assert.match(policy.body,/<article>[\s\S]+<h1>/,'Policy content is static and remains available without JavaScript');
  }
  const assets=[...html.body.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match=>match[1]);
  assert.equal(assets.length,4);
  for(const url of assets){const response=await app.inject({url,headers:{'accept-encoding':'br,gzip'}});assert.equal(response.statusCode,200);assert.ok(response.headers['cache-control'].includes('immutable'));assert.equal(response.headers['content-encoding'],'br');assert.ok(response.headers.vary.includes('Accept-Encoding'));}
  assert.equal((await app.inject('/assets/missing-old-chunk.js')).statusCode,404);
  const first=await app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'accept-encoding':'gzip'}});
  assert.equal(first.statusCode,200);assert.equal(first.headers['content-encoding'],'gzip');assert.ok(first.headers.vary.includes('Cookie'));
  const summary=JSON.parse(gunzipSync(first.rawPayload));assert.equal(summary.scope,'summary');assert.ok(!JSON.stringify(summary).includes('private passage'));
  const uncompressed=await app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'accept-encoding':'gzip;q=0'}});assert.equal(uncompressed.headers['content-encoding'],undefined);assert.equal(uncompressed.json().scope,'summary');
  const before=summaryLoads;
  const conditional=await Promise.all(Array.from({length:20},()=>app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'if-none-match':first.headers.etag}})));
  assert.ok(conditional.every(response=>response.statusCode===304));assert.equal(summaryLoads,before,'Conditional hits do not load the question bank');
  assert.equal((await app.inject({url:'/api/state-summary',headers:{cookie:cookie('s0')}})).statusCode,403);
  assert.equal((await app.inject({url:'/api/attempts/a0/session',headers:{cookie:cookie('s1')}})).statusCode,404);
  // Server commits the first answer, but the client never receives its receipt.
  // A subsequent edit and reload must replay that operation before sending the
  // latest answer, rather than falsely conflicting with our own committed write.
  let draft,dropReceipt=true;const requests=[];
  const store={read:async()=>structuredClone(draft),write:async(_key,value)=>{draft=structuredClone(value);}};
  const send=async changes=>{
    requests.push(structuredClone(changes));
    const response=await app.inject({method:'POST',url:'/api/actions/saveAnswers',headers:{cookie:cookie('s0')},payload:{attemptId:'a0',changes}});
    if(response.statusCode!==200)throw Object.assign(Error(response.json().error),{status:response.statusCode});
    if(dropReceipt){dropReceipt=false;throw Error('Synthetic lost acknowledgement after commit');}
    return response.json();
  };
  const draftBox=await new ExamOutbox({store,key:'s0:a0',send}).init();
  draftBox.edit('q',1,null);await assert.rejects(draftBox.flush(),/lost acknowledgement/);
  const firstOperation=draft.pending.q.operation;
  draftBox.edit('q',0);await draftBox.persisted;draftBox.close();
  const reloadedBox=await new ExamOutbox({store,key:'s0:a0',send}).init();
  try{await reloadedBox.flush();}finally{reloadedBox.close();}
  assert.equal(requests.length,3);assert.equal(requests[1].q.operation,firstOperation);
  assert.equal(requests[2].q.base,firstOperation);
  assert.deepEqual(draft.pending,{});
  const recovered=(await query("SELECT public_data FROM attempts WHERE id='a0'")).rows[0].public_data;
  assert.equal(recovered.answers.q,0);assert.equal(recovered.answerVersions.q,requests[2].q.operation);
  // A genuine competing write still conflicts; recovery must not rebase blindly.
  dropReceipt=true;
  const conflictBox=await new ExamOutbox({store,key:'s0:a0',send}).init();
  conflictBox.edit('q',1,recovered.answerVersions.q);
  await assert.rejects(conflictBox.flush(),/lost acknowledgement/);
  const uncertainOperation=draft.pending.q.operation;
  conflictBox.edit('q',0);await conflictBox.persisted;
  const competitor=await app.inject({method:'POST',url:'/api/actions/saveAnswers',headers:{cookie:cookie('s0')},payload:{attemptId:'a0',changes:{q:{value:1,base:uncertainOperation,operation:'competing-client-write'}}}});
  assert.equal(competitor.statusCode,200);
  try{await assert.rejects(conflictBox.flush(),error=>error.status===409);}finally{conflictBox.close();}
  assert.equal(draft.pending.q.value,0,'Unsent latest answer survives a genuine conflict');
  assert.equal((await query("SELECT public_data FROM attempts WHERE id='a0'")).rows[0].public_data.answerVersions.q,'competing-client-write');
  console.log('Actual HTTP/SQL outbox: lost acknowledgement, newer edit, reload, idempotent replay and latest answer recovery passed.');
  const start=performance.now();
  const receipts=await Promise.all(Array.from({length:200},(_,i)=>app.inject({method:'POST',url:'/api/actions/submitAttempt',headers:{cookie:cookie('s'+i)},payload:{attemptId:'a'+i}})));
  assert.ok(receipts.every(response=>response.statusCode===200&&response.json().attempt.status==='ready'));
  const resubmitted=await app.inject({method:'POST',url:'/api/actions/submitAttempt',headers:{cookie:cookie('s0')},payload:{attemptId:'a0'}});
  assert.equal(resubmitted.statusCode,200);
  assert.equal(resubmitted.json().attempt.submittedAt,receipts[0].json().attempt.submittedAt,'Retry returns the original submission receipt');
  const changed=await app.inject({url:'/api/state-summary',headers:{cookie:cookie('admin'),'if-none-match':first.headers.etag}});assert.equal(changed.statusCode,200);assert.notEqual(changed.headers.etag,first.headers.etag);
  const session=await app.inject({url:'/api/attempts/a0/session',headers:{cookie:cookie('s0')}});assert.equal(session.statusCode,200);assert.equal(session.json().attempts.length,1);
  console.log(JSON.stringify({test:'Production Fastify injection with isolated SQL, not VPS network capacity',concurrentSubmissions:receipts.length,submissionBurstMs:Math.round(performance.now()-start),entryAssets:assets.length,compression:'Brotli static + gzip JSON',conditionalRequests:20,extraSummaryLoadsOnConditionalHits:summaryLoads-before-1,queries}));
  if(process.env.G2G_PREVIEW_PORT){console.log('Synthetic browser preview: http://127.0.0.1:'+process.env.G2G_PREVIEW_PORT);await new Promise(()=>{});}
}finally{
  if(app)await app.close();hook.deregister();await db.close();delete globalThis.__httpDb;delete globalThis.__testFastify;
}
