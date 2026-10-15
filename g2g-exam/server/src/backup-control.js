import fs from 'node:fs/promises';
import path from 'node:path';
import {appError,query} from './db.js';
import {backupDriveStatus} from './backup-google.js';
import {readStatus} from '../../scripts/backup/status.mjs';
import {readHistory} from '../../scripts/backup/history.mjs';
import {parseArchive} from '../../scripts/backup/retention.mjs';
const folder=()=>path.resolve(process.env.BACKUP_CONTROL_DIR||'/data/backup-control');
export async function backupSummary(){
 const directory=folder(),status=await readStatus(directory),history=await readHistory(directory);
 const latest=history.filter(item=>item.type==='daily').sort((a,b)=>b.name.localeCompare(a.name))[0]||null;
 let queued=false;try{await fs.access(path.join(directory,'requests','request'));queued=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 return {status:queued&&status?.state!=='running'?{state:'queued',updatedAt:new Date().toISOString()}:status,latest:latest?{...latest,createdAt:new Date(parseArchive(latest.name)).toISOString()}:null,history};
}
export async function backupAction(user,name,data={}){
 if(user?.role!=='master')throw appError(403,'Không có quyền quản lý Backup.');
 if(name==='getBackupPreferences'){
  const result=await query("SELECT data FROM settings WHERE id='backup'");
  return {preferences:result.rows[0]?.data||{time:'03:00',intervalDays:1,dailyCopies:7,monthlyCopies:1},active:false};
 }
 if(name==='saveBackupPreferences'){
  const {time,intervalDays,dailyCopies,monthlyCopies}=data;
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||'')||!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>30||!Number.isInteger(dailyCopies)||dailyCopies<1||dailyCopies>90||!Number.isInteger(monthlyCopies)||monthlyCopies<0||monthlyCopies>24)throw appError(400,'Giờ hoặc số bản lưu không hợp lệ.');
  const preferences={time,intervalDays,dailyCopies,monthlyCopies,timeZone:'Asia/Ho_Chi_Minh'};
  await query("INSERT INTO settings(id,data,updated_by) VALUES('backup',$1::jsonb,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=now()",[JSON.stringify(preferences),user.id]);
  return {preferences,active:false};
 }
 if(name==='getBackupStatus'){
  const [drive,summary]=await Promise.all([backupDriveStatus(user),backupSummary()]);
  return {drive,...summary,enabled:process.env.BACKUP_RUNNER_ENABLED==='true'};
 }
 if(name==='runBackupNow'){
  if(process.env.BACKUP_RUNNER_ENABLED!=='true')throw appError(503,'Chưa cấu hình backup runner trên VPS.');
  if(!(await backupDriveStatus(user)).connected)throw appError(409,'Chưa kết nối Google Drive.');
  const {status}=await backupSummary();
  if(['queued','running'].includes(status?.state))throw appError(409,'Backup đang chạy hoặc đang chờ.');
  // Only the requests subdirectory is writable by the web process.
  try{await fs.writeFile(path.join(folder(),'requests','request'),new Date().toISOString(),{flag:'wx',mode:0o660});}
  catch(error){if(error.code==='EEXIST')throw appError(409,'Đã có yêu cầu đang chờ.');throw error;}
  return {queued:true};
 }
 if(name==='requestBackupRestore'){
  throw appError(503,'Chức năng phục hồi chưa được kích hoạt.');
  if(!(await backupDriveStatus(user)).connected)throw appError(409,'Chưa kết nối Google Drive.');
  const id=String(data.id||'');if(!/^[A-Za-z0-9_-]+$/.test(id))throw appError(400,'Mã backup không hợp lệ.');
  await fs.mkdir(path.join(folder(),'requests'),{recursive:true,mode:0o770});
  await fs.writeFile(path.join(folder(),'requests','restore.json'),JSON.stringify({id,requestedAt:new Date().toISOString(),requestedBy:user.id}),{mode:0o660});
  return {queued:true,message:'Đã yêu cầu phục hồi vào môi trường kiểm tra. Dữ liệu đang chạy không bị thay đổi.'};
 }
 throw appError(404,'Thao tác Backup không tồn tại.');
}
