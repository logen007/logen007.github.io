import {readFile,writeFile,rename,mkdir,rm,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseArchive,retention} from './retention.mjs';

const allowed=new Set(['daily','monthly']);
export function validateHistory(entries){
  if(!Array.isArray(entries)||entries.length>100)throw new Error('Invalid history');
  const seen=new Set();
  return entries.map(entry=>{
    if(!entry||!allowed.has(entry.type)||parseArchive(entry.name)===null||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<0)throw new Error('Invalid history entry');
    const key=entry.type+':'+entry.name;
    if(seen.has(key))throw new Error('Duplicate archive');
    seen.add(key);
    return {type:entry.type,name:entry.name,sha256:entry.sha256,size:entry.size};
  });
}
export function addVerified(history,entry){
  const current=validateHistory(history),[next]=validateHistory([entry]);
  const merged=[next,...current.filter(item=>!(item.name===next.name&&item.type===next.type))];
  const daily=retention(merged.filter(item=>item.type==='daily').map(item=>item.name),7).keep;
  const monthly=retention(merged.filter(item=>item.type==='monthly').map(item=>item.name),1).keep;
  return merged.filter(item=>item.type==='daily'?daily.includes(item.name):monthly.includes(item.name));
}
export async function readHistory(dir){
  try{return validateHistory(JSON.parse(await readFile(join(dir,'history.json'),'utf8')));}
  catch(error){if(error.code==='ENOENT')return [];throw error;}
}
export async function writeHistory(dir,entries){
  const safe=validateHistory(entries);await mkdir(dir,{recursive:true,mode:0o700});
  const temp=join(dir,'.history-'+randomUUID());
  try{await writeFile(temp,JSON.stringify(safe)+'\n',{flag:'wx',mode:0o640});await chmod(temp,0o640);await rename(temp,join(dir,'history.json'));}
  catch(error){await rm(temp,{force:true});throw error;}
  return safe;
}
