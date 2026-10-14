#!/usr/bin/env node
// Fail closed if the disaster recovery export includes live credentials.
import {readdir,lstat} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
const forbidden=/(^|\/)(?:\.env(?:\..*)?|id_(?:rsa|ed25519)|.*\.pem|.*\.key|.*\.p12|.*\.pfx|rclone\.conf|.*age.*identity.*|.*credentials.*\.json|.*secret.*)(?:$|\/)/i;
export async function validateDeployment(directory){
 const root=resolve(directory);let files=0;
 async function walk(current){
  for(const entry of await readdir(current,{withFileTypes:true})){
   const full=join(current,entry.name),name=relative(root,full).split(sep).join('/');
   if(forbidden.test('/'+name))throw Error('Sensitive file in deployment export: '+name);
   const stat=await lstat(full);
   if(stat.isSymbolicLink())throw Error('Symlink in deployment export: '+name);
   if(stat.isDirectory())await walk(full);
   else if(stat.isFile())files++;
   else throw Error('Unsupported deployment entry: '+name);
  }
 }
 await walk(root);
 if(!files)throw Error('Deployment export is empty');
 return {files};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 try{if(process.argv.length!==3)throw Error('Usage: validate-deployment.mjs /export');console.log(JSON.stringify(await validateDeployment(process.argv[2])));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
