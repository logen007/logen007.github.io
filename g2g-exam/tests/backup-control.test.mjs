import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {registerHooks} from 'node:module';
import {writeStatus} from '../scripts/backup/status.mjs';
import {writeHistory} from '../scripts/backup/history.mjs';
const directory=await mkdtemp(join(tmpdir(),'g2g-control-'));
await mkdir(join(directory,'requests'));
process.env.BACKUP_CONTROL_DIR=directory;
process.env.BACKUP_RUNNER_ENABLED='false';
globalThis.__backupConnected=true;
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(ctx.parentURL?.endsWith('/backup-control.js')){
  if(specifier==='./db.js')return {shortCircuit:true,url:'data:text/javascript,export const appError=(statusCode,message)=>Object.assign(new Error(message),{statusCode});'};
  if(specifier==='./backup-google.js')return {shortCircuit:true,url:'data:text/javascript,export const backupDriveStatus=async()=>({connected:globalThis.__backupConnected});'};
 }
 return next(specifier,ctx);
}});
try{
 const {backupAction}=await import('../server/src/backup-control.js');
 const master={role:'master'};
 await assert.rejects(backupAction({role:'teacher'},'getBackupStatus'),e=>e.statusCode===403);
 await assert.rejects(backupAction(master,'runBackupNow'),e=>e.statusCode===503);
 process.env.BACKUP_RUNNER_ENABLED='true';
 globalThis.__backupConnected=false;
 await assert.rejects(backupAction(master,'runBackupNow'),e=>e.statusCode===409);
 globalThis.__backupConnected=true;
 const results=await Promise.allSettled([backupAction(master,'runBackupNow'),backupAction(master,'runBackupNow')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await backupAction(master,'getBackupStatus')).status.state,'queued');
 assert.ok(await readFile(join(directory,'requests','request'),'utf8'));
 await rm(join(directory,'requests','request'));
 const now=new Date().toISOString();
 await writeStatus(directory,{state:'running',updatedAt:now,startedAt:now});
 await assert.rejects(backupAction(master,'runBackupNow'),e=>e.statusCode===409);
 await writeStatus(directory,{state:'success',updatedAt:now,startedAt:now,finishedAt:now});
 await writeHistory(directory,[{name:'g2g-20261014T030000Z.tar.gz.age',type:'daily',sha256:'a'.repeat(64),size:123}]);
 const status=await backupAction(master,'getBackupStatus');
 assert.equal(status.latest.size,123);assert.equal(status.history[0].sha256,'a'.repeat(64));
 assert.doesNotMatch(JSON.stringify(status),/rclone.conf|refreshToken/);
 console.log('Backup API: permissions, disabled gate, exclusive queue, running guard and verified history passed.');
}finally{hooks.deregister();delete globalThis.__backupConnected;await rm(directory,{recursive:true,force:true});}
