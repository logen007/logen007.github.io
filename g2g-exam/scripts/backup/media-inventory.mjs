import {readdir,lstat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
export async function mediaInventory(directory){
 const base=resolve(directory),items=[];
 async function visit(folder){
  for(const e of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const full=join(folder,e.name),st=await lstat(full);
   if(st.isSymbolicLink())throw Error('Media symlink rejected: '+full);
   if(st.isDirectory()){await visit(full);continue;}
   if(!st.isFile())throw Error('Non-file media entry: '+full);
   const hash=createHash('sha256');
   for await(const chunk of createReadStream(full))hash.update(chunk);
   const after=await lstat(full);
   if(st.size!==after.size||st.mtimeMs!==after.mtimeMs||st.ctimeMs!==after.ctimeMs)throw Error('Media changed during inventory: '+full);
   items.push({name:relative(base,full).split(sep).join('/'),size:st.size,sha256:hash.digest('hex')});
  }
 }
 await visit(base);return items;
}
if(process.argv[1]&&process.argv[1].endsWith('media-inventory.mjs')){
 const [directory,out]=process.argv.slice(2);
 if(!directory||!out)throw Error('Usage: media-inventory.mjs directory output.json');
 await writeFile(out,JSON.stringify(await mediaInventory(directory)),{flag:'wx',mode:0o600});
}
