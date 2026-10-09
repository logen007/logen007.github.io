import fs from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_RE=/\/uploads\/([A-Za-z0-9._-]+)/g;
let lastStatus={lastRunAt:null,lastSuccessAt:null,error:null,scanned:0,deleted:0,deletedBytes:0,referenced:0};

function collectReferences(value,out){
  if(typeof value==='string'){
    for(const match of value.matchAll(UPLOAD_RE))out.add(path.basename(match[1]));
    return;
  }
  if(Array.isArray(value)){for(const item of value)collectReferences(item,out);return;}
  if(value&&typeof value==='object')for(const item of Object.values(value))collectReferences(item,out);
}

async function databaseQuery(sql){
  const {pool}=await import('./db.js');
  return pool.query(sql);
}

export async function referencedUploadNames({query=databaseQuery}={}){
  const refs=new Set();
  const queries=[
    'SELECT data FROM questions',
    'SELECT data FROM exams',
    'SELECT public_data,private_data FROM attempts',
    'SELECT data FROM notifications',
    'SELECT data FROM settings',
  ];
  for(const sql of queries){
    const {rows}=await query(sql);
    for(const row of rows)collectReferences(row,refs);
  }
  return refs;
}

export function getMediaGarbageCollectionStatus(){return {...lastStatus};}

export async function runMediaGarbageCollection({uploadDir,graceHours=Number(process.env.MEDIA_GC_GRACE_HOURS||24),logger=console,referenceLoader=referencedUploadNames}={}){
  if(process.env.MEDIA_GC_ENABLED==='false')return {disabled:true,scanned:0,deleted:0};
  const root=path.resolve(uploadDir||process.env.UPLOAD_DIR||'/data/uploads');
  const graceMs=Math.max(1,Number(graceHours)||24)*60*60*1000;
  const cutoff=Date.now()-graceMs;
  const referenced=await referenceLoader();
  let entries=[];try{entries=await fs.readdir(root,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return {scanned:0,deleted:0};throw error;}
  let scanned=0,deleted=0,deletedBytes=0;
  for(const entry of entries){
    if(!entry.isFile())continue;
    scanned++;
    if(referenced.has(entry.name))continue;
    const file=path.join(root,entry.name),stat=await fs.stat(file);
    if(stat.mtimeMs>cutoff)continue;
    await fs.rm(file,{force:true});deleted++;deletedBytes+=stat.size;
  }
  const result={lastRunAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),error:null,scanned,deleted,deletedBytes,referenced:referenced.size};
  lastStatus=result;
  logger?.info?.(result,'media garbage collection complete');
  return result;
}

export function startMediaGarbageCollector({uploadDir,logger=console}={}){
  if(process.env.MEDIA_GC_ENABLED==='false')return()=>{};
  const intervalHours=Math.max(1,Number(process.env.MEDIA_GC_INTERVAL_HOURS||6));
  const run=()=>runMediaGarbageCollection({uploadDir,logger}).catch(error=>{
    lastStatus={...lastStatus,lastRunAt:new Date().toISOString(),error:String(error?.message||error)};
    logger?.error?.(error,'media garbage collection failed');
  });
  const first=setTimeout(run,Math.max(1,Number(process.env.MEDIA_GC_START_DELAY_SECONDS||10))*1000);first.unref?.();
  const timer=setInterval(run,intervalHours*60*60*1000);timer.unref?.();
  return()=>{clearTimeout(first);clearInterval(timer);};
}
