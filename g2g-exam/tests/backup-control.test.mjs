import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let connected=true,busy=false,preferences,job={state:'idle'},lastWrite;
const jobs=[];
globalThis.__backupControlTest={
 async query(sql,args){lastWrite={sql,args};preferences=JSON.parse(args[0]);return {rows:[]};},
 drive:async()=>({connected}),files:async()=>[{id:'owned-backup'}],
 preferences:async()=>preferences||{enabled:false,time:'03:00',intervalDays:1,dailyCopies:7,monthlyCopies:1},
 status:async()=>job,
 async start(kind,id){
  if(process.env.BACKUP_RUNNER_ENABLED!=='true')throw Object.assign(Error('Disabled'),{statusCode:503});
  if(busy)throw Object.assign(Error('Busy'),{statusCode:409});
  busy=true;jobs.push({kind,id});job={state:'running'};return {queued:true};
 }
};
const fake=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(ctx.parentURL?.endsWith('/backup-control.js')){
  const t='globalThis.__backupControlTest';
  if(specifier==='./db.js')return fake(`export const query=(...args)=>${t}.query(...args),appError=(statusCode,message)=>Object.assign(Error(message),{statusCode});`);
  if(specifier==='./backup-google.js')return fake(`export const backupDriveStatus=()=>${t}.drive(),listBackupFiles=()=>${t}.files();`);
  if(specifier==='./backup-job.js')return fake(`export const preferences=()=>${t}.preferences(),jobStatus=()=>${t}.status(),startBackupJob=(...args)=>${t}.start(...args);`);
 }
 return next(specifier,ctx);
}});
const oldEnabled=process.env.BACKUP_RUNNER_ENABLED;
try{
 const {backupAction}=await import('../server/src/backup-control.js');
 const master={id:'master',role:'master'};
 for(const name of ['getBackupStatus','getBackupPreferences','saveBackupPreferences','runBackupNow','requestBackupRestore'])await assert.rejects(backupAction({role:'teacher'},name),e=>e.statusCode===403);
 process.env.BACKUP_RUNNER_ENABLED='false';
 await assert.rejects(backupAction(master,'runBackupNow'),e=>e.statusCode===503);
 process.env.BACKUP_RUNNER_ENABLED='true';connected=false;
 await assert.rejects(backupAction(master,'runBackupNow'),e=>e.statusCode===409);
 connected=true;
 await assert.rejects(backupAction(master,'requestBackupRestore',{id:'foreign-backup'}),e=>e.statusCode===404);
 const results=await Promise.allSettled([backupAction(master,'runBackupNow'),backupAction(master,'runBackupNow')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await backupAction(master,'getBackupStatus')).status.state,'running');
 busy=false;await backupAction(master,'requestBackupRestore',{id:'owned-backup'});
 assert.deepEqual(jobs.at(-1),{kind:'restore',id:'owned-backup'});
 const prefs={enabled:false,time:'04:30',intervalDays:2,dailyCopies:5,monthlyCopies:2};
 await backupAction(master,'saveBackupPreferences',prefs);
 assert.equal(lastWrite.args[1],'master');
 assert.equal((await backupAction(master,'getBackupPreferences')).preferences.time,'04:30');
 await assert.rejects(backupAction(master,'saveBackupPreferences',{...prefs,intervalDays:0}),e=>e.statusCode===400);
 await assert.rejects(backupAction(master,'unknown'),e=>e.statusCode===404);
 job={state:'success',fileId:'legacy',lastBackupAt:'2026-10-16T00:00:00Z'};
 let fileReads=0;
 globalThis.__backupControlTest.files=async()=>{fileReads++;return [{id:'legacy',appProperties:{appVersion:'1.3.181'}}];};
 assert.equal((await backupAction(master,'getBackupStatus')).status.lastBackupVersion,'1.3.181');
 assert.equal((await backupAction(master,'getBackupStatus')).status.lastBackupVersion,'1.3.181');
 assert.equal(fileReads,1,'Legacy version metadata lookup is reused');
 console.log('Backup API: master permissions, runner gate, Drive ownership, exclusive jobs and validated preferences passed');
}finally{
 hooks.deregister();delete globalThis.__backupControlTest;
 if(oldEnabled===undefined)delete process.env.BACKUP_RUNNER_ENABLED;else process.env.BACKUP_RUNNER_ENABLED=oldEnabled;
}
