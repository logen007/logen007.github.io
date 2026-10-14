import {readStatus,writeStatus} from './status.mjs';
const [directory,state]=process.argv.slice(2);
if(!directory||!['running','success','failed'].includes(state))throw Error('Invalid status');
const previous=await readStatus(directory),now=new Date().toISOString();
await writeStatus(directory,{state,updatedAt:now,startedAt:state==='running'?now:previous?.startedAt||now,...(state==='running'?{}:{finishedAt:now})});
