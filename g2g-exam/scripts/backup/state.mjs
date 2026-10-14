import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const valid=new Set(['queued','running','success','failed']);
export function backupState(input){
 if(!input||!valid.has(input.state)||!Number.isFinite(Date.parse(input.updatedAt)))throw Error('Invalid backup state');
 return {state:input.state,updatedAt:input.updatedAt,...(input.finishedAt?{finishedAt:input.finishedAt}:{})};
}
export async function readBackupState(directory){
 try{return backupState(JSON.parse(await readFile(join(directory,'status.json'),'utf8')));}
 catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function writeBackupState(directory,input){
 const value=backupState(input);
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=join(directory,'status.json'),temp=join(directory,'status.json.tmp');
 await writeFile(temp,JSON.stringify(value),{mode:0o600});
 await rename(temp,file);
 return value;
}
