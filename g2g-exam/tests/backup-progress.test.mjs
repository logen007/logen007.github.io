import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createBackupProgress} from '../server/src/backup-progress.js';
const writes=[];
const progress=createBackupProgress({kind:'backup',startedAt:'start',write:async value=>writes.push(value),now:()=>'now'});
await progress.phase('prepare');await progress.phase('upload');
assert.equal(writes[0].completedSteps,0);assert.equal(writes[1].completedSteps,5);
assert.equal(writes[1].stepCount,10);assert.equal(writes[1].phaseStartedAt,'now');
assert.equal(writes[0].phase,'prepare','Published snapshots must not mutate');
await assert.rejects(progress.phase('unknown'));
const restore=createBackupProgress({kind:'restore',write:async()=>{}});
await restore.phase('verify');assert.equal(restore.snapshot().stepCount,4);

// Execute the real orchestration against isolated fakes: no DB, Drive or disk writes.
let saved={state:'idle'},history=[],file,releaseDump,failUpload=false;
const expected=phase=>assert.equal(saved.phase,phase);
globalThis.__backupProgressTest={
 async query(sql,args){
  if(sql.startsWith('INSERT INTO settings')){saved=JSON.parse(args[0]);history.push(saved);return {rows:[]};}
  if(sql.includes("id='backup-job'"))return {rows:[{data:saved}]};
  if(sql.includes("id='backup'"))return {rows:[]};
  if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
  if(sql.startsWith('CREATE')||sql.startsWith('DROP'))expected('verify');
  return {rows:[]};
 },
 async command(cmd){
  if(cmd==='pg_dump'){expected('database');await new Promise(resolve=>{releaseDump=resolve;});}
  if(cmd==='tar')expected('compress');
  if(cmd==='python3')expected('extract');
  if(['pg_restore','psql'].includes(cmd))expected('verify');
  return {stdout:'32',stderr:''};
 },
 async copy(){expected('uploads');},
 async inventory(){expected('inventory');return {};},
 async verify(){expected('verify');},
 async upload(filename,name,checksum){expected('upload');if(failUpload)throw Error('Không thể tải lên Drive.');file={id:'test',name,createdTime:new Date().toISOString(),description:'g2g-backup-v2 sha256='+checksum};return file;},
 async download(){expected('download');return {body:[]};},
 async list(){assert.ok(['prepare','retention'].includes(saved.phase));return [file];}
};
const fake=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(!ctx.parentURL?.endsWith('/backup-job.js'))return next(specifier,ctx);
 const t='globalThis.__backupProgressTest';
 if(specifier==='./db.js')return fake(`export const query=(...args)=>${t}.query(...args);export const pool={connect:async()=>({query,release(){}})};export const appError=(code,message)=>Object.assign(Error(message),{statusCode:code});`);
 if(specifier==='node:fs/promises')return fake(`export default {mkdtemp:async()=>'/tmp/fake-backup-job',chmod:async()=>{},mkdir:async()=>{},cp:()=>${t}.copy(),writeFile:async()=>{},rm:async()=>{}};`);
 if(specifier==='node:fs')return fake(`export function createReadStream(){return (async function*(){yield 'archive';})();} export function createWriteStream(){return {};}`);
 if(specifier==='node:stream/promises')return fake('export async function pipeline(){}');
 if(specifier==='node:child_process')return fake(`export function execFile(){};execFile[Symbol.for('nodejs.util.promisify.custom')]=(...args)=>${t}.command(...args);`);
 if(specifier==='./backup-google.js')return fake(`export const uploadBackupArchive=(...args)=>${t}.upload(...args),downloadBackupFile=(...args)=>${t}.download(...args),listBackupFiles=()=>${t}.list();export async function deleteBackupFile(){throw Error('Must not delete anything in this test');}`);
 if(specifier.endsWith('/inventory.mjs'))return fake(`export const inventorySnapshot=()=>${t}.inventory();`);
 if(specifier.endsWith('/verify-staging.mjs'))return fake(`export const verifyStaging=()=>${t}.verify();`);
 return next(specifier,ctx);
}});
const oldEnabled=process.env.BACKUP_RUNNER_ENABLED,oldUrl=process.env.DATABASE_URL;
try{
 process.env.BACKUP_RUNNER_ENABLED='true';process.env.DATABASE_URL='postgres://test:test@localhost/test';
 const {startBackupJob,waitBackupJob,jobStatus}=await import('../server/src/backup-job.js');
 await startBackupJob();
 assert.equal(history[0].phase,'prepare','Initial status is persisted before acknowledgement');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await jobStatus()).phase,'database');
 assert.equal((await jobStatus()).state,'running');
 await assert.rejects(startBackupJob(),error=>error.statusCode===409);
 releaseDump();await waitBackupJob();
 assert.equal(saved.state,'success');assert.equal(saved.completedSteps,10);
 assert.deepEqual(history.filter(x=>x.state==='running').map(x=>x.phase),progress.snapshot().steps.map(x=>x.id));
 history=[];await startBackupJob('restore','test');await waitBackupJob();
 assert.equal(saved.state,'success');assert.equal(saved.completedSteps,4);
 failUpload=true;await startBackupJob();await new Promise(resolve=>setImmediate(resolve));releaseDump();await waitBackupJob();
 assert.equal(saved.state,'failed');assert.equal(saved.phase,'upload');assert.equal(saved.completedSteps,5);
 console.log('Backup progress: persisted initial status, all real operation boundaries, exclusive job, restore stages and exact failure phase passed');
}finally{
 hooks.deregister();delete globalThis.__backupProgressTest;
 if(oldEnabled===undefined)delete process.env.BACKUP_RUNNER_ENABLED;else process.env.BACKUP_RUNNER_ENABLED=oldEnabled;
 if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;
}
