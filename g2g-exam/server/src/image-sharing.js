import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {open} from 'node:fs/promises';
import path from 'node:path';
import {pool,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {imageHeaderMatches} from './media-upload-policy.js';

const KEY='exam_image_sharing',TTL=7*24*60*60*1000;
const TYPES={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'};
const validName=name=>typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/.test(name)&&Boolean(TYPES[name.split('.').at(-1).toLowerCase()]);
const sign=(state,name,grant)=>createHmac('sha256',state.key).update(JSON.stringify([name,grant.nonce,grant.expiresAt])).digest('base64url');
const equal=(a,b)=>typeof a==='string'&&/^[A-Za-z0-9_-]{43}$/.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function sharedImageLogUrl(url){return String(url||'').startsWith('/shared-exam-images/')?String(url).split('?')[0]:url;}
export function imageShareName(value,origin){
  try{const u=new URL(value);if(u.origin!==new URL(origin).origin||!u.pathname.startsWith('/uploads/'))return null;const name=u.pathname.slice('/uploads/'.length);return validName(name)?name:null;}catch{return null;}
}
async function read(client=pool){const r=await client.query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):{key:randomBytes(32).toString('hex'),images:{}};}
async function mutate(fn){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(182733,2)');
    const state=await read(client),result=await fn(state);
    await client.query('INSERT INTO secrets(key,value_enc) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now()',[KEY,encrypt(JSON.stringify(state))]);
    await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export function createImageSharing({readState=read,mutateState=mutate,now=Date.now}={}){
  return {
    issue:({urls,origin})=>mutateState(state=>{
      const result=new Map(),time=now();
      for(const [name,grant] of Object.entries(state.images))if(grant.expiresAt<=time)delete state.images[name];
      for(const url of urls){
        const name=imageShareName(url,origin);if(!name)continue;
        const grant=state.images[name]||{nonce:randomBytes(24).toString('hex'),expiresAt:time+TTL};state.images[name]=grant;
        result.set(url,{url:new URL(`/shared-exam-images/${name}?signature=${sign(state,name,grant)}`,origin).href,expiresAt:new Date(grant.expiresAt).toISOString()});
      }
      return result;
    }),
    verify:async(name,signature)=>{
      if(!validName(name))return false;
      const state=await readState(),grant=state.images[name];
      return Boolean(grant&&grant.expiresAt>now()&&equal(signature,sign(state,name,grant)));
    },
    revoke:({url,origin})=>mutateState(state=>{
      let u;try{u=new URL(url);}catch{throw appError(400,'Nhập đúng link chia sẻ ảnh.');}
      const name=u.pathname.slice('/shared-exam-images/'.length),grant=state.images[name];
      if(u.origin!==new URL(origin).origin||!u.pathname.startsWith('/shared-exam-images/')||!validName(name))throw appError(400,'Nhập đúng link chia sẻ ảnh của website.');
      // A stale link must not revoke a newer grant for the same image.
      if(grant&&equal(u.searchParams.get('signature'),sign(state,name,grant)))delete state.images[name];
      return {ok:true};
    })
  };
}
export const imageSharing=createImageSharing();
export function registerImageSharingRoutes(app,{authenticate,uploadDir,origin,sharing=imageSharing}){
  app.get('/shared-exam-images/:name',async(request,reply)=>{
    reply.header('Cache-Control','private, no-store').header('Referrer-Policy','no-referrer').header('X-Robots-Tag','noindex, nofollow, noarchive').header('X-Content-Type-Options','nosniff');
    const {name}=request.params;
    if(!await sharing.verify(name,request.query.signature))return reply.code(404).send({error:'Link ảnh không hợp lệ, đã hết hạn hoặc đã thu hồi.'});
    const mime=TYPES[name.split('.').at(-1).toLowerCase()];
    let file;
    try{file=await open(path.join(uploadDir,name),'r');const buffer=Buffer.alloc(512);const {bytesRead}=await file.read(buffer,0,512,0);if(!imageHeaderMatches(buffer.subarray(0,bytesRead),mime))return reply.code(404).send({error:'Ảnh không khả dụng.'});}
    catch{return reply.code(404).send({error:'Ảnh không khả dụng.'});}finally{await file?.close();}
    reply.header('Content-Type',mime);return reply.sendFile(name,uploadDir,{cacheControl:false,lastModified:false,etag:false});
  });
  app.post('/api/exam-images/shares/revoke',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    return sharing.revoke({url:request.body?.url,origin:origin()});
  });
}
