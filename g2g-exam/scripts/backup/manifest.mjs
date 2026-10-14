import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';

export function createManifest({createdAt=new Date().toISOString(),commit,files}) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Full Git commit SHA required');
  if (!Array.isArray(files)||!files.length) throw new Error('File inventory required');
  const inventory = files.map(({name,sha256,size})=>{
    if (!/^(database\.dump|uploads\/[A-Za-z0-9._/-]+|deployment\/[A-Za-z0-9._/-]+)$/.test(name) || name.split('/').includes('..')) throw new Error('Unsafe file name');
    if (!/^[a-f0-9]{64}$/.test(sha256)||!Number.isSafeInteger(size)||size<0) throw new Error('Invalid file digest');
    return {name,sha256,size};
  });
  if (new Set(inventory.map(x=>x.name)).size!==inventory.length) throw new Error('Duplicate file');
  return {format:1,application:'G2G Exam',createdAt,commit,files:inventory};
}
export function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
export async function verifyManifest(manifest,root){
  const {resolve,sep}=await import('node:path');
  const base=resolve(root);
  const validated=createManifest(manifest);
  for (const entry of validated.files){
    const full=resolve(base,entry.name);
    if (!full.startsWith(base+sep)) throw new Error('File outside staging');
    const {lstat}=await import('node:fs/promises');
    const stat=await lstat(full);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==entry.size) throw new Error('Invalid file: '+entry.name);
    if(sha256(await readFile(full))!==entry.sha256) throw new Error('Checksum mismatch: '+entry.name);
  }
  return true;
}
