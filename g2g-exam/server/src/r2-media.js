import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const validMediaName=name=>typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)&&name.length<=240;
const fingerprint=stat=>`${stat.size}:${stat.mtimeMs}`;
const mime=name=>({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',webm:'audio/webm'})[name.split('.').pop().toLowerCase()]||'application/octet-stream';

// Local files remain authoritative. Never redirect an unverified or deleted file.
// The manifest contains object keys, not credentials or signed URLs.
export function createMediaMirror({uploadDir,store,logger=console,namespace='default'}){
  const manifestDir=path.join(uploadDir,'.r2',createHash('sha256').update(namespace).digest('hex').slice(0,16)),manifestFile=path.join(manifestDir,'manifest.json');
  let entries={},busy=false,stopped=false;
  const status={totalFiles:null,syncedFiles:null,syncedBytes:null,pendingFiles:null,skippedFiles:null,lastScanAt:null,lastSuccessAt:null,error:null};
  const signed=new Map();
  const ready=fs.readFile(manifestFile,'utf8').then(raw=>{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid manifest');entries=parsed;}).catch(error=>{if(error.code!=='ENOENT')logger.warn?.('R2 manifest unavailable; using VPS media.');});
  async function sync(){
    await ready;if(busy||stopped)return;busy=true;
    try{
      const files=await fs.readdir(uploadDir,{withFileTypes:true});
      const inventory=[];
      for(const file of files){
        if(file.isFile()&&validMediaName(file.name))inventory.push({name:file.name,stat:await fs.stat(path.join(uploadDir,file.name))});
      }
      const refresh=()=>{
        status.totalFiles=inventory.length;status.syncedFiles=0;status.syncedBytes=0;status.skippedFiles=0;
        for(const item of inventory){
          if(entries[item.name]?.fingerprint===fingerprint(item.stat)){status.syncedFiles++;status.syncedBytes+=item.stat.size;}
          else if(item.stat.size>25*1024*1024)status.skippedFiles++;
        }
        status.pendingFiles=status.totalFiles-status.syncedFiles-status.skippedFiles;
      };
      refresh();status.lastScanAt=new Date().toISOString();status.error=null;
      let changed=false;
      for(const file of files){
        if(stopped)break;
        if(!file.isFile()||!validMediaName(file.name))continue;
        const filename=path.join(uploadDir,file.name),stat=await fs.stat(filename);
        if(entries[file.name]?.fingerprint===fingerprint(stat))continue;
        if(stat.size>25*1024*1024)continue;
        const body=await fs.readFile(filename),hash=createHash('sha256').update(body).digest('hex');
        const key=`media/${hash}/${file.name}`;
        await store.put(key,body,mime(file.name),hash);
        const remote=await store.head(key);
        if(remote.size!==body.length||remote.hash!==hash)throw new Error('R2 verification failed');
        const after=await fs.stat(filename);
        if(fingerprint(after)!==fingerprint(stat))continue;
        entries[file.name]={key,fingerprint:fingerprint(stat)};changed=true;
        status.syncedFiles++;status.syncedBytes+=stat.size;status.pendingFiles=Math.max(0,status.pendingFiles-1);
      }
      if(changed){
        await fs.mkdir(manifestDir,{recursive:true});
        await fs.writeFile(manifestFile+'.tmp',JSON.stringify(entries),{mode:0o600});
        await fs.rename(manifestFile+'.tmp',manifestFile);
      }
      if(!stopped)status.lastSuccessAt=new Date().toISOString();
    }catch{status.error='Đồng bộ chưa hoàn tất; VPS vẫn phục vụ. Hệ thống sẽ thử lại ở lượt quét sau.';logger.warn?.('R2 mirror incomplete; local files remain available and next scan will retry.');}
    finally{busy=false;}
  }
  async function source(name){
    await ready;if(!validMediaName(name))return null;
    const entry=Object.hasOwn(entries,name)?entries[name]:null;
    if(!entry)return null;
    try{
      const stat=await fs.stat(path.join(uploadDir,name));
      if(!stat.isFile()||fingerprint(stat)!==entry.fingerprint)return null;
      if(typeof entry.key!=='string'||!entry.key.startsWith('media/'))return null;
      const cached=signed.get(entry.key);
      if(cached&&cached.until>Date.now())return cached.url;
      const url=await store.sign(entry.key);
      if(signed.size>=2000)signed.delete(signed.keys().next().value);
      signed.set(entry.key,{url,until:Date.now()+45*60*1000});
      return url;
    }catch{return null;}
  }
  return {sync,source,status:()=>({...status,syncing:busy}),stop:()=>{stopped=true;}};
}

export async function configureR2Media({uploadDir,env=process.env,logger=console}){
  if(env.R2_MEDIA_ENABLED!=='true')return null;
  const {R2_ACCOUNT_ID:account,R2_BUCKET:bucket,R2_ACCESS_KEY_ID:accessKeyId,R2_SECRET_ACCESS_KEY:secretAccessKey}=env;
  if(!/^[a-f0-9]{32}$/.test(account||'')||!bucket||!accessKeyId||!secretAccessKey){
    logger.warn?.('R2 configuration incomplete; using VPS media.');return null;
  }
  const {S3Client,PutObjectCommand,HeadObjectCommand,GetObjectCommand}=await import('@aws-sdk/client-s3');
  const {getSignedUrl}=await import('@aws-sdk/s3-request-presigner');
  const client=new S3Client({region:'auto',endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId,secretAccessKey},maxAttempts:2});
  const send=command=>client.send(command,{abortSignal:AbortSignal.timeout(30000)});
  const mirror=createMediaMirror({uploadDir,logger,namespace:`${account}/${bucket}`,store:{
    put:(Key,Body,ContentType,hash)=>send(new PutObjectCommand({Bucket:bucket,Key,Body,ContentType,Metadata:{sha256:hash},CacheControl:'private, max-age=3600'})),
    head:async Key=>{const r=await send(new HeadObjectCommand({Bucket:bucket,Key}));return {size:r.ContentLength,hash:r.Metadata?.sha256};},
    sign:Key=>getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key}),{expiresIn:3600}),
  }});
  const first=setTimeout(()=>void mirror.sync(),10000);first.unref();
  const timer=setInterval(()=>void mirror.sync(),300000);timer.unref();
  return {source:mirror.source,status:mirror.status,stop(){clearTimeout(first);clearInterval(timer);mirror.stop();client.destroy();}};
}
