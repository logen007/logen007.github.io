import {readHistory,writeHistory,addVerified} from './history.mjs';
const [directory,name,sha256,archived='false',bytes='0']=process.argv.slice(2);
if(!directory||!['true','false'].includes(archived))throw Error('Invalid history arguments');
const entry={name,sha256,size:Number(bytes)};
let history=addVerified(await readHistory(directory),{...entry,type:'daily'});
if(archived==='true')history=addVerified(history,{...entry,type:'monthly'});
await writeHistory(directory,history);
