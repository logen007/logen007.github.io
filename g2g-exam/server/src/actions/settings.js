import {query,getSettings,audit,appError} from '../db.js';
import {setSmtpSecret,smtpSecretStatus,sendConfiguredMail} from '../mail.js';
import {mergeSettings} from '../defaults.js';
import {isPrimaryMasterEmail,normalizeEmail} from '../roles.js';

const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
const validColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''));

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
  settings.general.systemName=String(settings.general.systemName||'').trim().slice(0,80);
  settings.general.organizationName=String(settings.general.organizationName||'').trim().slice(0,100);
  settings.general.supportEmail=String(settings.general.supportEmail||'').trim().slice(0,160);
  settings.general.publicUrl=String(settings.general.publicUrl||'').trim().slice(0,300);
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
