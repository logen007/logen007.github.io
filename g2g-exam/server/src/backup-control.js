import fs from 'node:fs/promises';
import path from 'node:path';
import {appError} from './db.js';
import {backupDriveStatus} from './backup-google.js';
const folder=()=>path.resolve(process.env.BACKUP_CONTROL_DIR||'/data/backup-control');
async function read(name){try{return JSON.parse(await fs.readFile(path.join(folder(),name),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function backupAction(user,name){
 if(user?.role!=='master')throw appError(403,'Không có quyền quản lý Backup.');
 if(name==='getBackupStatus'){const [drive,status,history]=await Promise.all([backupDriveStatus(user),read('status.json'),read('history.json')]);return {drive,status,history:Array.isArray(history)?history.slice(0,8):[],enabled:process.env.BACKUP_RUNNER_ENABLED==='true'};}
 if(name==='runBackupNow'){
  if(process.env.BACKUP_RUNNER_ENABLED!=='true')throw appError(503,'Chưa cấu hình backup runner trên VPS.');
  if(!(await backupDriveStatus(user)).connected)throw appError(409,'Chưa kết nối Google Drive.');
  await fs.mkdir(folder(),{recursive:true,mode:0o700});
  try{await fs.writeFile(path.join(folder(),'request'),new Date().toISOString(),{flag:'wx',mode:0o600});}catch(error){if(error.code==='EEXIST')throw appError(409,'Đã có yêu cầu đang chờ.');throw error;}
  return {queued:true};
 }
 throw appError(404,'Thao tác Backup không tồn tại.');
}
