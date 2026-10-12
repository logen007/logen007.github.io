import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMediaMirror,configureR2Media,validMediaName} from '../server/src/r2-media.js';
import {createMediaDelivery} from '../src/ui/media-fallback.js';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-r2-test-'));
try{
  const objects=new Map();let puts=0,signs=0,offline=false;
  const store={put:async(key,body,type,hash)=>{if(offline)throw new Error('offline');puts++;objects.set(key,{size:body.length,hash});},head:async key=>objects.get(key),sign:async key=>{signs++;return `https://r2.test/${key}?signed`;}};
  const mirror=createMediaMirror({uploadDir:root,store,logger:{warn(){}}});
  assert.equal(await configureR2Media({uploadDir:root,env:{}}),null);
  assert.equal(await configureR2Media({uploadDir:root,env:{R2_MEDIA_ENABLED:'true'},logger:{warn(){}}}),null);
  for(const bad of ['../secret','..','.r2','x/y','%2f',''])assert.equal(validMediaName(bad),false);
  await fs.writeFile(path.join(root,'a.mp3'),'sound');
  assert.equal(await mirror.source('a.mp3'),null);
  await mirror.sync();assert.equal(puts,1);
  const url=await mirror.source('a.mp3');assert.match(url,/r2.test\/media\//);
  assert.equal(await mirror.source('a.mp3'),url);assert.equal(signs,1);
  await mirror.sync();assert.equal(puts,1);
  const restarted=createMediaMirror({uploadDir:root,store});
  assert.equal(await restarted.source('a.mp3'),url);
  const otherBucket=createMediaMirror({uploadDir:root,store,namespace:'other'});
  assert.equal(await otherBucket.source('a.mp3'),null);
  await fs.writeFile(path.join(root,'a.mp3'),'changed audio');
  assert.equal(await mirror.source('a.mp3'),null);
  offline=true;await mirror.sync();assert.equal(await mirror.source('a.mp3'),null);
  offline=false;await mirror.sync();assert.notEqual(await mirror.source('a.mp3'),url);
  await fs.unlink(path.join(root,'a.mp3'));assert.equal(await mirror.source('a.mp3'),null);
  // A bad HEAD result must never promote the remote object.
  await fs.writeFile(path.join(root,'b.jpg'),'image');
  const corrupt=createMediaMirror({uploadDir:root,namespace:'corrupt',logger:{warn(){}},store:{...store,head:async()=>({size:0,hash:'wrong'})}});
  await corrupt.sync();assert.equal(await corrupt.source('b.jpg'),null);

  const request=new Request('https://exam.test/uploads/a.mp3',{headers:{Range:'bytes=2-4'}});
  let calls=[];
  const success=createMediaDelivery({fetchMedia:async(req)=>{calls.push(req);return new Response('abc');}});
  assert.equal(await (await success(request)).text(),'abc');
  assert.match(calls[0].url,/delivery=r2/);assert.equal(calls[0].headers.get('Range'),'bytes=2-4');
  assert.equal(calls[0].credentials,'same-origin');assert.equal(calls[0].mode,'cors');
  let time=0;calls=[];
  const fallback=createMediaDelivery({now:()=>time,fetchMedia:async req=>{calls.push(req.url);if(req.url.includes('?'))throw new Error('CORS/network');return new Response('local');}});
  assert.equal(await (await fallback(request)).text(),'local');assert.equal(calls.length,2);
  await fallback(request);assert.equal(calls.length,3); // cooldown skips R2
  time=300001;await fallback(request);assert.equal(calls.length,5);
  calls=[];
  const denied=createMediaDelivery({fetchMedia:async req=>{calls.push(req);return new Response('',{status:401});}});
  assert.equal((await denied(request)).status,401);assert.equal(calls.length,1);
  const forbidden=createMediaDelivery({fetchMedia:async()=>new Response('',{status:403})});
  assert.equal((await forbidden(request)).status,403);
  calls=[];
  const timeout=createMediaDelivery({timeoutMs:5,fetchMedia:(req,options)=>{calls.push(req);if(options)return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout'))));return Promise.resolve(new Response('local'));}});
  assert.equal(await (await timeout(request)).text(),'local');assert.equal(calls.length,2);
  // Resume a broken remote body without replacing/replaying the audio element.
  calls=[];let read=0;
  const remote=new Response(new ReadableStream({pull(c){if(read++===0)c.enqueue(new TextEncoder().encode('ab'));else c.error(new Error('lost connection'));}}),{headers:{'Content-Length':'5'}});
  Object.defineProperty(remote,'redirected',{value:true});
  const streaming=createMediaDelivery({fetchMedia:async req=>{calls.push(req);return calls.length===1?remote:new Response('cde',{status:206,headers:{'Content-Range':'bytes 2-4/5'}});}});
  assert.equal(await (await streaming(new Request('https://exam.test/uploads/a.mp3'))).text(),'abcde');
  assert.equal(calls[1].headers.get('Range'),'bytes=2-4');
  assert.equal(calls[1].url,'https://exam.test/uploads/a.mp3');
  console.log('R2: verified mirror, restart, rollback, private config, idempotence, mutation/deletion, range preservation, timeout, authorization and interrupted-stream fallback passed.');
}finally{await fs.rm(root,{recursive:true,force:true});}
