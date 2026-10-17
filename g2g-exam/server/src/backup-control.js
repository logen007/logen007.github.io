import {appError,query} from './db.js';
import {backupDriveStatus,listBackupFiles} from './backup-google.js';
import {preferences,jobStatus,startBackupJob} from './backup-job.js';
import {validateBackupPreferences} from './backup-policy.js';
let versionLookup;
export async function backupSummary(){
 const status={...await jobStatus()};
 // Legacy jobs predate saved version metadata; reuse one lookup per archive.
 if(status.lastBackupAt&&status.fileId&&status.lastBackupVersion===undefined){
  if(versionLookup?.id!==status.fileId)versionLookup={id:status.fileId,promise:listBackupFiles({role:'master'}).then(files=>files.find(file=>file.id===status.fileId)?.appProperties?.appVersion||null)};
  try{status.lastBackupVersion=await versionLookup.promise;}catch{versionLookup=null;}
 }
 return {status,history:[],latest:null};
}
export async function backupAction(user,name,data={}){
 if(user?.role!=='master')throw appError(403,'Không có quyền quản lý Backup.');
 const enabled=process.env.BACKUP_RUNNER_ENABLED==='true';
 if(name==='getBackupPreferences')return {preferences:await preferences(),active:enabled};
 if(name==='saveBackupPreferences'){
  let p;try{p=validateBackupPreferences(data);}catch(e){throw appError(400,e.message);}
  if(p.enabled&&!enabled)throw appError(409,'Backup chưa sẵn sàng.');
  await query("INSERT INTO settings(id,data,updated_by) VALUES('backup',$1::jsonb,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=now()",[JSON.stringify(p),user.id]);
  return {preferences:p,active:enabled};
 }
 if(name==='getBackupStatus')return {drive:await backupDriveStatus(user),...await backupSummary(),enabled};
 if(name==='runBackupNow'||name==='requestBackupRestore'){
  if(!(await backupDriveStatus(user)).connected)throw appError(409,'Chưa kết nối Google Drive.');
  if(name==='requestBackupRestore'&&!(await listBackupFiles(user)).some(f=>f.id===data.id))throw appError(404,'Không tìm thấy backup.');
  return startBackupJob(name==='runBackupNow'?'backup':'restore',data.id);
 }
 throw appError(404,'Thao tác Backup không tồn tại.');
}
