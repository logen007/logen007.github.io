import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readdir} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import {createManifest} from './manifest.mjs';

const safeRelative = value => value && !value.split('/').some(part=>part==='..'||part==='.'||!part);
const fingerprint = s => `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;

async function digestFile(file) {
  const before=await lstat(file);
  if(!before.isFile()||before.isSymbolicLink())throw new Error('Non-regular file: '+file);
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  const after=await lstat(file);
  if(fingerprint(before)!==fingerprint(after))throw new Error('File changed during backup: '+file);
  return {sha256:hash.digest('hex'),size:after.size};
}

async function walk(root,folder,output,prefix) {
  for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=join(folder,entry.name);
    const stat=await lstat(full);
    if(stat.isSymbolicLink())throw new Error('Symlink in backup input: '+full);
    if(stat.isDirectory()){await walk(root,full,output,prefix);continue;}
    if(!stat.isFile())throw new Error('Unsupported backup input: '+full);
    const name=prefix+'/'+relative(root,full).split(sep).join('/');
    if(!safeRelative(name))throw new Error('Unsafe backup path');
    output.push({name,...await digestFile(full)});
  }
}

// Call only on a frozen/staged snapshot. Re-checking content does not make a live
// PostgreSQL dump and concurrently modified media transactionally consistent.
export async function inventorySnapshot({databaseDump,uploadsDir,deploymentDir,commit}){
  const files=[{name:'database.dump',...await digestFile(resolve(databaseDump))}];
  for(const [folder,prefix] of [[uploadsDir,'uploads'],[deploymentDir,'deployment']]){
    if(!folder)continue;
    const root=resolve(folder);
    if(!(await lstat(root)).isDirectory())throw new Error('Expected directory: '+root);
    await walk(root,root,files,prefix);
  }
  return createManifest({commit,files});
}
