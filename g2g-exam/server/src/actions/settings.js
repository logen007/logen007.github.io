import {query,getSettings,audit,appError} from '../db.js';
import {setSmtpSecret,smtpSecretStatus,sendConfiguredMail} from '../mail.js';
import {mergeSettings} from '../defaults.js';
import {isPrimaryMasterEmail,normalizeEmail} from '../roles.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {getMediaGarbageCollectionStatus} from '../media-gc.js';

const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
const validColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''));
const uploadDir=path.resolve(process.env.UPLOAD_DIR||'/data/uploads');
const uploadPattern=/\/uploads\/([A-Za-z0-9._-]+)/g;

function uploadNames(value,names=new Set()){
  if(typeof value==='string')for(const match of value.matchAll(uploadPattern))names.add(path.basename(match[1]));
  else if(Array.isArray(value))for(const item of value)uploadNames(item,names);
  else if(value&&typeof value==='object')for(const item of Object.values(value))uploadNames(item,names);
  return names;
}

async function fileBytes(file){try{return (await fs.stat(file)).size;}catch{return 0;}}
async function directoryBytes(root,{skip=new Set()}={}){
  let total=0,entries=[];
  try{entries=await fs.readdir(root,{withFileTypes:true});}catch{return 0;}
  for(const entry of entries){
    if(skip.has(entry.name))continue;
    const target=path.join(root,entry.name);
    total+=entry.isDirectory()?await directoryBytes(target,{skip}):entry.isFile()?await fileBytes(target):0;
  }
  return total;
}

function normalizeTeacherEmails(values=[]){
  return [...new Set((Array.isArray(values)?values:[]).map(normalizeEmail).filter(validEmail).filter(email=>!isPrimaryMasterEmail(email)))].sort();
}

async function saveTeacherEmails(settings,userId){
  settings.auth.teacherEmails=normalizeTeacherEmails(settings.auth.teacherEmails);
  await query(`UPDATE settings SET data=$1::jsonb,updated_at=now(),updated_by=$2 WHERE id='global'`,[JSON.stringify(settings),userId]);
}

function cleanSettings(input={}){
  const settings=mergeSettings(input);
  const optionalEmail=value=>!value||validEmail(value);
  settings.version=5;
  settings.operations.trashRetentionDays=Number(settings.operations.trashRetentionDays);
  if(!Number.isInteger(settings.operations.trashRetentionDays)||settings.operations.trashRetentionDays<1||settings.operations.trashRetentionDays>3650)throw appError(400,'Thời hạn thùng rác phải từ 1 đến 3650 ngày.');
  settings.general.systemName=String(settings.general.systemName||'').trim().slice(0,80);
  settings.general.organizationName=String(settings.general.organizationName||'').trim().slice(0,100);
  settings.general.supportEmail=String(settings.general.supportEmail||'').trim().slice(0,160);
  settings.general.publicUrl=String(settings.general.publicUrl||'').trim().slice(0,300);
  for(const key of ['logoUrl','faviconUrl']){
    const url=String(settings.general[key]||'').trim();
    if(url&&!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url))throw appError(400,'Đường dẫn ảnh thương hiệu không hợp lệ.');
    settings.general[key]=url;
  }
  settings.theme.primaryColor=String(settings.theme.primaryColor||'').trim();
  settings.auth.allowedDomain=String(settings.auth.allowedDomain||'').trim().toLowerCase().replace(/^@/,'').slice(0,160);
  settings.auth.teacherEmails=normalizeTeacherEmails(settings.auth.teacherEmails);
  settings.smtp.port=Math.max(1,Math.min(65535,Number(settings.smtp.port||587)));
  settings.smtp.timeoutMs=Math.max(3000,Math.min(120000,Number(settings.smtp.timeoutMs||20000)));
  if(!settings.general.systemName||!/^https?:\/\//.test(settings.general.publicUrl))throw appError(400,'Thông tin hệ thống không hợp lệ.');
  if(!validColor(settings.theme.primaryColor))throw appError(400,'Màu chủ đạo không hợp lệ.');
  if(!optionalEmail(settings.general.supportEmail)||!optionalEmail(settings.smtp.fromEmail)||!optionalEmail(settings.smtp.replyTo))throw appError(400,'Địa chỉ email không hợp lệ.');
  if(settings.smtp.enabled&&!settings.smtp.host)throw appError(400,'Cần điền SMTP Host trước khi bật SMTP.');
  return settings;
}

export async function updateSystemSettings(user,{settings}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được thay đổi Cài đặt.');
  const clean=cleanSettings(settings||{});
  await query(`UPDATE settings SET data=$1::jsonb,updated_at=now(),updated_by=$2 WHERE id='global'`,[JSON.stringify(clean),user.id]);
  await audit(user,'update_system_settings','settings','global',{smtpEnabled:clean.smtp.enabled,emailEnabled:clean.email.enabled});
  return {settings:clean};
}

export async function updateSmtpSecret(user,{password}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được cập nhật mật khẩu SMTP.');
  return setSmtpSecret(password,user.id);
}

export async function testSmtp(user,{to}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được gửi email thử.');
  if(!validEmail(to))throw appError(400,'Email nhận thử không hợp lệ.');
  const settings=await getSettings();
  const sent=await sendConfiguredMail({
    to,
    subject:`${settings.general.systemName} – Kiểm tra SMTP`,
    text:'Đây là email kiểm tra SMTP từ hệ thống G2G.',
    html:'<p>Đây là email kiểm tra SMTP từ hệ thống <strong>G2G</strong>.</p>',
    ignoreDisabled:true,
  });
  await audit(user,'test_smtp','settings','smtp',{to,messageId:sent.messageId});
  return {ok:true,messageId:sent.messageId};
}

export async function getInfrastructureStatus(user){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xem trạng thái hạ tầng.');
  const settings=await getSettings();
  const secret=await smtpSecretStatus();
  let database=true;
  try{await query('SELECT 1');}catch{database=false;}
  const [databaseSize,tableSizes,examRows,questionRows,uploadBytes,applicationBytes,disk]=await Promise.all([
    query(`SELECT pg_database_size(current_database())::bigint AS bytes`),
    query(`SELECT relname AS name,pg_total_relation_size(oid)::bigint AS bytes FROM pg_class WHERE relname=ANY($1::text[])`,[['users','exams','questions','attempts','notifications','audit_log','settings']]),
    query(`SELECT id,data FROM exams WHERE status<>'trash' ORDER BY updated_at DESC`),
    query(`SELECT id,data FROM questions WHERE status<>'trash'`),
    directoryBytes(uploadDir),
    directoryBytes(process.cwd(),{skip:new Set(['node_modules','.git','uploads'])}),
    fs.statfs(uploadDir).catch(()=>null),
  ]);
  const questions=new Map(questionRows.rows.map(row=>[row.id,row.data||{}]));
  const examStorage=await Promise.all(examRows.rows.map(async row=>{
    const exam=row.data||{},questionIds=[...new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]))];
    const questionData=questionIds.map(id=>questions.get(id)).filter(Boolean),media=uploadNames([exam,...questionData]);
    let mediaBytes=0;for(const name of media)mediaBytes+=await fileBytes(path.join(uploadDir,name));
    const dataBytes=Buffer.byteLength(JSON.stringify(exam))+questionData.reduce((sum,item)=>sum+Buffer.byteLength(JSON.stringify(item)),0);
    return {id:row.id,title:exam.title||row.id,provider:exam.provider||'',level:exam.level||'',dataBytes,mediaBytes,totalBytes:dataBytes+mediaBytes,questions:questionData.filter(item=>!item.example).length,mediaFiles:media.size};
  }));
  const memoryTotal=os.totalmem(),memoryFree=os.freemem(),cpuCores=os.cpus().length||1,cpuUsage=process.cpuUsage(),uptimeSeconds=Math.max(1,process.uptime());
  return {
    backend:'VPS',
    postgresql:database,
    googleLoginConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),
    smtp:{
      enabled:Boolean(settings.smtp.enabled),
      configured:Boolean(settings.smtp.host&&settings.smtp.fromEmail&&(!settings.smtp.username||secret.configured)),
      secretConfigured:secret.configured,
      secretUpdatedAt:secret.updatedAt,
    },
    storage:true,
    resources:{
      cpu:{cores:cpuCores,loadPercent:Math.min(100,Math.round(os.loadavg()[0]/cpuCores*1000)/10),applicationAveragePercent:Math.round((cpuUsage.user+cpuUsage.system)/1e6/uptimeSeconds/cpuCores*1000)/10,loadAverage:os.loadavg().map(value=>Math.round(value*100)/100)},
      memory:{totalBytes:memoryTotal,usedBytes:memoryTotal-memoryFree,freeBytes:memoryFree,processBytes:process.memoryUsage().rss,heapBytes:process.memoryUsage().heapUsed},
      disk:disk?{totalBytes:Number(disk.blocks)*Number(disk.bsize),freeBytes:Number(disk.bfree)*Number(disk.bsize),usedBytes:(Number(disk.blocks)-Number(disk.bfree))*Number(disk.bsize)}:null,
      usage:{databaseBytes:Number(databaseSize.rows[0]?.bytes||0),uploadsBytes:uploadBytes,applicationBytes},
      databaseTables:Object.fromEntries(tableSizes.rows.map(row=>[row.name,Number(row.bytes||0)])),
      uptimeSeconds:Math.round(uptimeSeconds),
      mediaGarbageCollection:getMediaGarbageCollectionStatus(),
    },
    examStorage,
  };
}

export async function setTeacherByEmail(user,{email,enabled=true}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được cấp quyền giáo viên.');
  const clean=normalizeEmail(email);
  if(!validEmail(clean))throw appError(400,'Email không hợp lệ.');
  if(isPrimaryMasterEmail(clean))throw appError(409,'Tài khoản Master Admin luôn giữ quyền quản trị cấp cao.');
  const settings=await getSettings();
  const emails=new Set(normalizeTeacherEmails(settings.auth.teacherEmails));
  if(enabled)emails.add(clean);else emails.delete(clean);
  settings.auth.teacherEmails=[...emails].sort();
  await saveTeacherEmails(settings,user.id);
  const target=await query(`SELECT id,role FROM users WHERE lower(email)=lower($1) LIMIT 1`,[clean]);
  if(target.rowCount&&target.rows[0].role!=='master'){
    await query(`UPDATE users SET role=$2,updated_at=now() WHERE id=$1`,[target.rows[0].id,enabled?'teacher':'student']);
  }
  await audit(user,enabled?'grant_teacher_email':'revoke_teacher_email','user_email',clean,{enabled});
  return {email:clean,enabled,userId:target.rows[0]?.id||null};
}

export async function setUserRole(user,{userId,role}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được đổi vai trò.');
  if(!['student','teacher'].includes(role))throw appError(400,'Vai trò không hợp lệ.');
  const target=await query(`SELECT id,email,role FROM users WHERE id=$1`,[userId]);
  if(!target.rowCount)throw appError(404,'Không tìm thấy tài khoản.');
  const account=target.rows[0];
  if(userId===user.id||isPrimaryMasterEmail(account.email)||account.role==='master')throw appError(409,'Không thể thay đổi quyền của tài khoản Master Admin.');
  await query(`UPDATE users SET role=$2,updated_at=now() WHERE id=$1`,[userId,role]);
  const settings=await getSettings(),emails=new Set(normalizeTeacherEmails(settings.auth.teacherEmails)),email=normalizeEmail(account.email);
  if(role==='teacher')emails.add(email);else emails.delete(email);
  settings.auth.teacherEmails=[...emails].sort();
  await saveTeacherEmails(settings,user.id);
  await audit(user,'set_user_role','user',userId,{role,email});
  return {userId,role,email};
}
