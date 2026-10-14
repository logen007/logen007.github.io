#!/usr/bin/env node
import {readFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {createManifest} from './manifest.mjs';

export async function verifyStaging(directory){
  const base=resolve(directory);
  const metadata=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));
  const manifest=createManifest(metadata);
  const declared=new Set(manifest.files.map(f=>f.name));
  if(!declared.has('database.dump'))throw new Error('Database dump missing from manifest');
  let total=0;
  for(const item of manifest.files){
    const full=resolve(base,item.name);
    if(!full.startsWith(base+sep))throw new Error('Path outside staging');
    const stat=await lstat(full);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.size)throw new Error('Invalid staged file: '+item.name);
    const hash=createHash('sha256');
    for await(const block of createReadStream(full))hash.update(block);
    if(hash.digest('hex')!==item.sha256)throw new Error('Checksum mismatch: '+item.name);
    total+=stat.size;
  }
  async function scan(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const full=join(dir,entry.name),name=relative(base,full).split(sep).join('/');
      if(entry.isSymbolicLink())throw new Error('Symlink in staging: '+name);
      if(entry.isDirectory()){await scan(full);continue;}
      if(!entry.isFile()||!declared.has(name))throw new Error('Unexpected staged file: '+name);
    }
  }
  for(const entry of await readdir(base,{withFileTypes:true})){
    if(entry.name==='manifest.json')continue;
    if(entry.isSymbolicLink())throw new Error('Symlink in staging: '+entry.name);
    if(entry.isDirectory()){
      if(!['uploads','deployment'].includes(entry.name))throw new Error('Unexpected directory: '+entry.name);
      await scan(join(base,entry.name));
    }else if(!entry.isFile()||!declared.has(entry.name))throw new Error('Unexpected staged file: '+entry.name);
  }
  return {ok:true,commit:manifest.commit,files:manifest.files.length,bytes:total};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  try{if(process.argv.length!==3)throw Error('Usage: node verify-staging.mjs /staging');
    console.log(JSON.stringify(await verifyStaging(process.argv[2])));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
