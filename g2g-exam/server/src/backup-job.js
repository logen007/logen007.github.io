import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pipeline} from 'node:stream/promises';
import {pool,query,appError} from './db.js';
import {MEDIA_BACKUP_LOCK} from './media-backup-lock.js';
import {listBackupFiles,downloadBackupFile,uploadBackupArchive,deleteBackupFile} from './backup-google.js';
import {inventorySnapshot} from '../../scripts/backup/inventory.mjs';
import {verifyStaging} from '../../scripts/backup/verify-staging.mjs';
import {backupDefaults,backupDue,retainedBackupIds} from './backup-policy.js';
import {APP_VERSION} from '../../src/release.js';

const run=promisify(execFile),master={role:'master'},jobLock=[1398705745,2];
let active=null;
const ready=()=>process.env.BACKUP_RUNNER_ENABLED==='true';
export async function preferences(){const r=await query("SELECT data FROM settings WHERE id='backup'");return {...backupDefaults,...r.rows[0]?.data};}
export async function jobStatus(){
 const r=await query("SELECT data FROM settings WHERE id='backup-job'");
 const value=r.rows[0]?.data||{state:'idle'};
 if(!active&&value.state==='running')return {...value,state:'interrupted',message:'Lần chạy trước bị gián đoạn. Có thể chạy lại.'};
 return value;
}
async function state(value){await query("INSERT INTO settings(id,data) VALUES('backup-job',$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",[JSON.stringify(value)]);}
async function hash(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
function pgEnv(database){
 const uri=new URL(process.env.DATABASE_URL);
 return {...process.env,PGHOST:uri.hostname,PGPORT:uri.port||'5432',PGUSER:decodeURIComponent(uri.username),PGPASSWORD:decodeURIComponent(uri.password),PGDATABASE:database||decodeURIComponent(uri.pathname.slice(1))};
}
async function command(cmd,args,env=process.env){try{return await run(cmd,args,{env,timeout:1800000,maxBuffer:2*1024*1024});}catch{throw Error('Không hoàn tất bước '+cmd+'. Kiểm tra dung lượng và kết nối database.');}}
async function restoreCheck(payload,client){
 await verifyStaging(payload);
 const suffix=randomBytes(10).toString('hex'),db='g2g_check_'+suffix,role='g2g_check_'+suffix,password=randomBytes(32).toString('hex');
 let roleCreated=false,dbCreated=false;
 try{
  await client.query('CREATE ROLE "'+role+'" LOGIN PASSWORD \''+password+'\' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT');roleCreated=true;
  await client.query('CREATE DATABASE "'+db+'" OWNER "'+role+'" TEMPLATE template0');dbCreated=true;
  await command('pg_restore',['--no-owner','--no-acl','--exit-on-error','--dbname',db,path.join(payload,'database.dump')],{...pgEnv(db),PGUSER:role,PGPASSWORD:password});
  const {stdout}=await command('psql',['-At','-c',"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],{...pgEnv(db),PGUSER:role,PGPASSWORD:password});
  if(Number(stdout.trim())<5)throw Error('Bản phục hồi thiếu bảng dữ liệu.');
  return {tables:Number(stdout.trim())};
 }finally{
  if(dbCreated)await client.query('DROP DATABASE "'+db+'" WITH (FORCE)');
  if(roleCreated)await client.query('DROP ROLE "'+role+'"');
 }
}
async function downloadChecked(file,destination){
 const remote=await downloadBackupFile(master,file.id);
 await pipeline(remote.body,createWriteStream(destination,{mode:0o600}));
 const expected=file.description?.match(/^g2g-backup-v2 sha256=([a-f0-9]{64})$/)?.[1];
 if(!expected||await hash(destination)!==expected)throw Error('Bản trên Drive không khớp checksum.');
}
async function execute(kind,id,client,startedAt){
 const previous=await jobStatus(),work=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-job-'));
 await fs.chmod(work,0o700);
 const payload=path.join(work,'payload'),archive=path.join(work,'backup.tar.gz');
 let mediaLocked=false;
 try{
  await state({state:'running',kind,startedAt,lastBackupAt:previous.lastBackupAt,message:kind==='backup'?'Đang tạo bản sao…':'Đang kiểm tra phục hồi…'});
  await fs.mkdir(payload,{mode:0o700});
  if(kind==='backup'){
   const lock=await client.query('SELECT pg_try_advisory_lock($1,$2) AS locked',MEDIA_BACKUP_LOCK);
   if(!lock.rows[0].locked)throw Error('Đang có file được cập nhật. Thử backup lại sau.');
   mediaLocked=true;
   const uploads=process.env.UPLOAD_DIR||'/data/uploads';
   await command('pg_dump',['--format=custom','--file',path.join(payload,'database.dump')],pgEnv());
   await fs.cp(uploads,path.join(payload,'uploads'),{recursive:true});
   await client.query('SELECT pg_advisory_unlock($1,$2)',MEDIA_BACKUP_LOCK);mediaLocked=false;
   await fs.mkdir(path.join(payload,'deployment'));
   const recovery={version:APP_VERSION,repository:'https://github.com/logen007/logen007.github.io',settingsEncryptionKey:process.env.SETTINGS_ENCRYPTION_KEY||'',instructions:'Restore database.dump with PostgreSQL 16 pg_restore; restore uploads directory. Set SETTINGS_ENCRYPTION_KEY from this file to read the restored encrypted service settings. Reconfigure Google OAuth and other deployment environment values.'};
   await fs.writeFile(path.join(payload,'deployment','recovery.json'),JSON.stringify(recovery,null,2),{mode:0o600});
   const manifest=await inventorySnapshot({databaseDump:path.join(payload,'database.dump'),uploadsDir:path.join(payload,'uploads'),deploymentDir:path.join(payload,'deployment'),commit:process.env.BACKUP_GIT_COMMIT||'0'.repeat(40)});
   await fs.writeFile(path.join(payload,'manifest.json'),JSON.stringify(manifest));
   await command('tar',['-czf',archive,'-C',payload,'.']);
   const checksum=await hash(archive),name='g2g-'+new Date().toISOString().replace(/[:.]/g,'-')+'.tar.gz';
   const file=await uploadBackupArchive(archive,name,checksum);
   await state({state:'running',kind,startedAt,lastBackupAt:previous.lastBackupAt,message:'Đã tải lên Drive. Đang tải lại và kiểm tra phục hồi…'});
   const downloaded=path.join(work,'download.tar.gz');await downloadChecked({...file,description:'g2g-backup-v2 sha256='+checksum},downloaded);
   const restored=path.join(work,'restored');await fs.mkdir(restored);
   await command('python3',['/app/scripts/backup/safe-extract.py',downloaded,restored]);
   const result=await restoreCheck(restored,client);
   // Only prune after remote download and isolated restore have succeeded.
   const p=await preferences(),{keep,ordered}=retainedBackupIds(await listBackupFiles(master),p);
   for(const old of ordered)if(!keep.has(old.id))await deleteBackupFile(master,old.id);
   await state({state:'success',kind,startedAt,finishedAt:new Date().toISOString(),lastBackupAt:new Date().toISOString(),fileId:file.id,name,sha256:checksum,...result,message:'Backup đã lên Drive và phục hồi thử thành công.'});
  }else{
   const file=(await listBackupFiles(master)).find(f=>f.id===id);
   if(!file)throw Error('Không tìm thấy bản backup.');
   await downloadChecked(file,archive);
   await command('python3',['/app/scripts/backup/safe-extract.py',archive,payload]);
   const result=await restoreCheck(payload,client);
   await state({state:'success',kind,startedAt,finishedAt:new Date().toISOString(),lastBackupAt:previous.lastBackupAt,...result,message:'Phục hồi thử thành công. Dữ liệu đang dùng được giữ nguyên.'});
  }
 }catch(error){
  await state({state:'failed',kind,startedAt,finishedAt:new Date().toISOString(),lastBackupAt:previous.lastBackupAt,message:error.message?.startsWith('Không')||error.message?.startsWith('Bản')||error.message?.startsWith('Đang')?error.message:'Không hoàn tất backup hoặc phục hồi. Kiểm tra kết nối Drive và dung lượng VPS.'});
 }finally{
  if(mediaLocked)await client.query('SELECT pg_advisory_unlock($1,$2)',MEDIA_BACKUP_LOCK);
  await fs.rm(work,{recursive:true,force:true});
 }
}
export async function startBackupJob(kind='backup',id){
 if(!ready())throw appError(503,'Backup chưa sẵn sàng.');
 if(active)throw appError(409,'Đang có một tác vụ backup hoặc phục hồi.');
 active=Promise.resolve();
 let client,locked=false;
 try{
  client=await pool.connect();
  const r=await client.query('SELECT pg_try_advisory_lock($1,$2) AS locked',jobLock);locked=r.rows[0].locked;
  if(!locked)throw appError(409,'Backup đang chạy.');
  const startedAt=new Date().toISOString();
  active=execute(kind,id,client,startedAt).catch(()=>{}).finally(async()=>{try{await client.query('SELECT pg_advisory_unlock($1,$2)',jobLock);}finally{client.release();active=null;}});
  return {queued:true};
 }catch(error){if(client){if(locked)await client.query('SELECT pg_advisory_unlock($1,$2)',jobLock);client.release();}active=null;throw error;}
}
export async function waitBackupJob(){await active;return jobStatus();}
export function startBackupScheduler(){
 let checking=false;
 const tick=async()=>{if(checking||active||!ready())return;checking=true;try{const p=await preferences(),s=await jobStatus();if(backupDue(p,s.lastBackupAt)&&(!s.finishedAt||Date.now()-Date.parse(s.finishedAt)>3600000))await startBackupJob();}catch{}finally{checking=false;}};
 const timer=setInterval(tick,60000);timer.unref();return ()=>clearInterval(timer);
}
