// Isolated SQL and streamed binary data; Google/100ms and auth are mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import Fastify from '../server/node_modules/fastify/fastify.js';
const {PGlite}=await import(process.env.G2G_PGLITE_PATH),db=new PGlite(),context=new AsyncLocalStorage();
const query=(sql,args)=>(context.getStore()||db).query(sql,args);
const appError=(statusCode,message)=>Object.assign(Error(message),{statusCode});
globalThis.__archiveTest={query,withTx:fn=>db.transaction(c=>context.run(c,()=>fn({query}))),appError,
 getBackupDriveAccess:async()=>({token:'private-token',folderId:'root-folder'}),readHmsConfig:async()=>({}),hmsRequest:async()=>({url:'https://storage.test/private-recording.mp4'}),
 requireRole:async(request,...roles)=>{const id=request.headers['test-user'],user={id,role:id==='student'?'student':id==='other-teacher'?'teacher':'master'};if(!user.id)throw appError(401,'Login');if(!roles.includes(user.role))throw appError(403,'Forbidden');return user;}};
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(ctx.parentURL?.endsWith('/speaking-archive.js')||ctx.parentURL?.endsWith('/speaking-drive.js')){
  const names={'./db.js':'query,withTx,appError','./backup-google.js':'getBackupDriveAccess','./speaking-hms.js':'readHmsConfig,hmsRequest','./auth.js':'requireRole'}[specifier];
  if(names)return {shortCircuit:true,url:'data:text/javascript,export const {'+names+'}=globalThis.__archiveTest;'};
 }return next(specifier,ctx);
}});
const originalFetch=globalThis.fetch,files=new Map(),binary=Buffer.from('0000ftyp-real-streamed-test-video'),md5=crypto.createHash('md5').update(binary).digest('hex');
let generated=0,downloads=0,uploads=0,failAfterUpload=false,corrupt=false,deny=false,uploadMetadata;
globalThis.fetch=async(input,options={})=>{
 const url=String(input),method=options.method||'GET';
 assert.notEqual(method,'DELETE','Source and Drive recordings must never be deleted');
 if(url==='https://storage.test/private-recording.mp4'){downloads++;return new Response(binary,{headers:{'content-length':String(binary.length),'content-type':'video/mp4'}});}
 assert.equal(options.headers.Authorization,'Bearer private-token');
 if(deny)return new Response('',{status:403});
 if(url.includes('/files/generateIds'))return Response.json({ids:['file'+(++generated)]});
 if(url.includes('/files?q='))return Response.json({files:[{id:'video-folder'}]});
 if(url.includes('/upload/drive/v3/files?')){uploadMetadata=JSON.parse(options.body);assert.deepEqual(uploadMetadata.parents,['video-folder']);return new Response(null,{headers:{location:'https://www.googleapis.com/upload-session'}});}
 if(url.endsWith('/upload-session')){
  uploads++;const chunks=[];for await(const chunk of options.body)chunks.push(chunk);assert.deepEqual(Buffer.concat(chunks),binary);
  files.set(uploadMetadata.id,{id:uploadMetadata.id,mimeType:'video/mp4',size:String(binary.length),md5Checksum:corrupt?'bad':md5,appProperties:uploadMetadata.appProperties});
  return failAfterUpload?new Response('',{status:503}):Response.json(files.get(uploadMetadata.id));
 }
 const match=url.match(/\/files\/(file\d+)\?/);if(match){
  if(url.endsWith('?alt=media')){assert.equal(options.headers.Range,'bytes=0-3');return new Response(binary.subarray(0,4),{status:206,headers:{'content-range':'bytes 0-3/'+binary.length,'content-length':'4','accept-ranges':'bytes'}});}
  return files.has(match[1])?Response.json(files.get(match[1])):new Response('',{status:404});
 }
 throw Error('Unexpected URL '+url);
};
const app=Fastify(),before=(await fs.readdir(tmpdir())).filter(n=>n.startsWith('g2g-speaking-video-'));
try{
 await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
 await query("INSERT INTO users(id,email,role,data) VALUES('owner','owner@test.example','teacher','{}')");
 const {runSpeakingArchiveOnce,registerSpeakingArchiveRoutes}=await import('../server/src/speaking-archive.js');
 const {streamDriveRecording}=await import('../server/src/speaking-drive.js');
 registerSpeakingArchiveRoutes(app);app.get('/video',async(request,reply)=>streamDriveRecording('file1',request,reply));
 const insert=async id=>query('INSERT INTO speaking_lab_sessions(id,owner_id,data) VALUES($1,$2,$3::jsonb)',[id,'owner',JSON.stringify({state:'completed',assetId:'asset-'+id,members:[],reviews:{note:'Keep teacher comments'}})]);
 const row=async id=>(await query('SELECT data FROM speaking_lab_sessions WHERE id=$1',[id])).rows[0].data;
 await insert('one');assert.equal(await runSpeakingArchiveOnce(),true);
 assert.equal((await row('one')).driveArchive.state,'saved');assert.equal((await row('one')).driveArchive.md5,md5);assert.deepEqual((await row('one')).reviews,{note:'Keep teacher comments'});
 assert.equal(await runSpeakingArchiveOnce(),false,'Saved recording is never re-uploaded');
 await insert('two');failAfterUpload=true;await runSpeakingArchiveOnce();assert.equal((await row('two')).driveArchive.state,'retrying');
 await query("UPDATE speaking_lab_sessions SET data=jsonb_set(data,'{driveArchive,retryAt}','0') WHERE id='two'");
 failAfterUpload=false;await runSpeakingArchiveOnce();assert.equal((await row('two')).driveArchive.state,'saved');assert.equal(uploads,2);assert.equal(downloads,2);assert.equal(generated,2,'Retry reuses stable file ID after response loss');
 await insert('three');corrupt=true;await runSpeakingArchiveOnce();assert.equal((await row('three')).driveArchive.state,'retrying','Checksum mismatch must not report saved');corrupt=false;
 const send=(method,url,user)=>app.inject({method,url:'/api/speaking-lab/'+url,headers:{'test-user':user,origin:new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin}});
 assert.equal((await app.inject({method:'POST',url:'/api/speaking-lab/sessions/three/archive-retry',headers:{'test-user':'owner',origin:'https://evil.test'}})).statusCode,403);
 assert.equal((await send('GET','archive-status','student')).statusCode,403);
 assert.equal((await send('POST','sessions/three/archive-retry','student')).statusCode,403);
 assert.equal((await send('POST','sessions/three/archive-retry','other-teacher')).statusCode,403,'Teachers cannot manage archives');
 assert.equal((await send('GET','archive-status','other-teacher')).statusCode,403);
 assert.equal((await send('POST','sessions/three/archive-retry','admin')).statusCode,200,'Admin can retry a finished recording');
 assert.equal((await row('three')).driveArchive.state,'queued');
 deny=true;await runSpeakingArchiveOnce();assert.equal((await row('three')).driveArchive.state,'retrying');assert.equal((await row('three')).state,'completed','Drive failure cannot change exam outcome');deny=false;
 const video=await app.inject({method:'GET',url:'/video',headers:{range:'bytes=0-3'}});assert.equal(video.statusCode,206);assert.equal(video.headers['content-range'],'bytes 0-3/'+binary.length);assert.deepEqual(video.rawPayload,binary.subarray(0,4));assert.equal(video.headers['cache-control'],'private, no-store');
 assert.equal((await app.inject({method:'GET',url:'/video',headers:{range:'invalid'}})).statusCode,416);
 const after=(await fs.readdir(tmpdir())).filter(n=>n.startsWith('g2g-speaking-video-'));assert.deepEqual(after.sort(),before.sort(),'Temporary video files are cleaned after success and failure');
 console.log('Speaking archive: SQL queue, streamed upload, checksums, idempotent retry, cleanup, permissions, state isolation and range playback passed.');
}finally{await app.close();await db.close();hooks.deregister();globalThis.fetch=originalFetch;delete globalThis.__archiveTest;}
