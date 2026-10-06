import {query,getSettings,audit,appError} from '../db.js';
import {setSmtpSecret,smtpSecretStatus,sendConfiguredMail} from '../mail.js';
import {mergeSettings} from '../defaults.js';

function cleanSettings(input={}){
  const settings=mergeSettings(input);
  const validEmail=value=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  settings.version=4;
  settings.general.systemName=String(settings.general.systemName||'').trim().slice(0,80);
  settings.general.organizationName=String(settings.general.organizationName||'').trim().slice(0,100);
  settings.general.supportEmail=String(settings.general.supportEmail||'').trim().slice(0,160);
  settings.general.publicUrl=String(settings.general.publicUrl||'').trim().slice(0,300);
  settings.auth.allowedDomain=String(settings.auth.allowedDomain||'').trim().toLowerCase().replace(/^@/,'').slice(0,160);
  settings.smtp.port=Math.max(1,Math.min(65535,Number(settings.smtp.port||587)));
  settings.smtp.timeoutMs=Math.max(3000,Math.min(120000,Number(settings.smtp.timeoutMs||20000)));
  if(!settings.general.systemName||!/^https?:\/\//.test(settings.general.publicUrl))throw appError(400,'Thông tin hệ thống không hợp lệ.');
  if(!validEmail(settings.general.supportEmail)||!validEmail(settings.smtp.fromEmail)||!validEmail(settings.smtp.replyTo))throw appError(400,'Địa chỉ email không hợp lệ.');
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
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to||'')))throw appError(400,'Email nhận thử không hợp lệ.');
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

export async function setUserRole(user,{userId,role}){
  if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được đổi vai trò.');
  if(userId===user.id)throw appError(409,'Không thể tự thay đổi vai trò của tài khoản quản trị.');
  if(!['student','teacher'].includes(role))throw appError(400,'Vai trò không hợp lệ.');
  await query(`UPDATE users SET role=$2,updated_at=now() WHERE id=$1`,[userId,role]);
  await audit(user,'set_user_role','user',userId,{role});
  return {userId,role};
}
