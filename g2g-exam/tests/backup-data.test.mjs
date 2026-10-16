import assert from 'node:assert/strict';
import {readBackupData,loadBackupData,invalidateBackupData,clearBackupData} from '../src/settings/backup-data.js';
const oldFetch=globalThis.fetch,oldNow=Date.now;
let now=100000,waiter;const calls={};
try{
 Date.now=()=>now;
 globalThis.fetch=async url=>{
  const key=url.endsWith('getBackupStatus')?'status':'files';calls[key]=(calls[key]||0)+1;
  const gate=waiter;if(gate)await gate;
  return {ok:true,json:async()=>key==='status'?{status:{state:'idle'},drive:{connected:true},enabled:true}:{files:[{id:'one'}]}};
 };
 clearBackupData();
 const first=loadBackupData('master','files'),second=loadBackupData('master','files');
 assert.equal(first,second,'Concurrent views share exactly one request');
 await first;assert.equal(calls.files,1);
 await loadBackupData('master','files');assert.equal(calls.files,1);
 assert.equal(readBackupData('master').files.files[0].id,'one');
 for(let i=0;i<5;i++){now+=3000;await loadBackupData('master','status',{force:true});await loadBackupData('master','files');}
 assert.equal(calls.files,1,'Progress ticks do not repeatedly list Drive files');
 now+=60001;await loadBackupData('master','files');assert.equal(calls.files,2);
 invalidateBackupData('master',['files']);await loadBackupData('master','files');assert.equal(calls.files,3,'Mutations bypass the list TTL');
 let release;waiter=new Promise(resolve=>{release=resolve;});
 const stale=loadBackupData('master','files',{force:true});
 const rejected=assert.rejects(stale,{name:'AbortError'});
 assert.equal(readBackupData('another-master').files,null,'Account switches never display another account snapshot');
 release();await rejected;waiter=null;
 assert.equal(readBackupData('another-master').files,null,'Old requests cannot populate the next account cache');
 await loadBackupData('another-master','files');
 clearBackupData();assert.equal(readBackupData('another-master').files,null,'Logout clears cached metadata');
 console.log('Backup cache: shared requests, warm navigation, list TTL, forced invalidation, account isolation and stale-response rejection passed');
}finally{globalThis.fetch=oldFetch;Date.now=oldNow;clearBackupData();}
