const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { sendConfiguredEmail } = require('./mailer.js');

const db=getFirestore();
const REGION='asia-southeast1';

const DEFAULT_SETTINGS={
  version:3,
  general:{
    systemName:'Thi thử tiếng Đức',
    organizationName:'G2G Career',
    supportEmail:'admin@g2gcareer.com',
    publicUrl:'https://logen007.github.io/g2g-exam/'
  },
  auth:{
    googleLoginEnabled:true,
    allowNewStudents:true,
    allowedDomain:''
  },
  exam:{allowRetake:true,allowRestart:true},
  smtp:{
    enabled:false,
    host:'',
    port:587,
    security:'starttls',
    username:'',
    fromName:'G2G Career',
    fromEmail:'admin@g2gcareer.com',
    replyTo:'admin@g2gcareer.com',
    timeoutMs:20000,
    rejectUnauthorized:true
  },
  email:{
    enabled:false,
    resultSubject:'G2G – Đã có kết quả {exam}',
    resultText:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nXem chi tiết: {url}',
    resultHtml:'<p>Xin chào <strong>{student}</strong>,</p><p>Kết quả bài thi <strong>{exam}</strong> của bạn đã được công bố.</p><p>Điểm: <strong>{score}</strong><br>Kết quả: <strong>{result}</strong></p><p><a href="{url}">Đăng nhập hệ thống G2G để xem chi tiết</a></p>'
  },
  // Tương thích với dữ liệu/các bản code cũ.
  results:{notifyResultEmail:false,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
  operations:{
    maintenanceMode:false,
    maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'
  }
};

function now(){return new Date().toISOString();}
function requireAuth(request){if(!request.auth)throw new HttpsError('unauthenticated','Bạn cần đăng nhập.');return request.auth.uid;}
async function getUser(uid){const snap=await db.collection('users').doc(uid).get();if(!snap.exists)throw new HttpsError('permission-denied','Không tìm thấy tài khoản.');return {id:uid,...snap.data()};}
function text(value,fallback,max){const s=String(value??fallback??'').trim();return s.slice(0,max);}
function bool(value,fallback){return typeof value==='boolean'?value:Boolean(fallback);}
function integer(value,fallback,min,max){const n=Number.parseInt(value,10);return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));}
function validEmail(value){return !value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function normalizeDomain(value){return String(value||'').trim().toLowerCase().replace(/^@/,'').slice(0,160);}
function normalizeSettings(input={}){
  const general=input.general||{},auth=input.auth||{},exam=input.exam||{},smtp=input.smtp||{},email=input.email||{},results=input.results||{},operations=input.operations||{};
  const emailEnabled=typeof email.enabled==='boolean'?email.enabled:bool(results.notifyResultEmail,DEFAULT_SETTINGS.email.enabled);
  const emailSubject=text(email.resultSubject||results.resultEmailSubject,DEFAULT_SETTINGS.email.resultSubject,220);
  const security=['ssl','starttls','none'].includes(smtp.security)?smtp.security:DEFAULT_SETTINGS.smtp.security;
  const out={
    version:3,
    general:{
      systemName:text(general.systemName,DEFAULT_SETTINGS.general.systemName,80),
      organizationName:text(general.organizationName,DEFAULT_SETTINGS.general.organizationName,100),
      supportEmail:text(general.supportEmail,DEFAULT_SETTINGS.general.supportEmail,160),
      publicUrl:text(general.publicUrl,DEFAULT_SETTINGS.general.publicUrl,300)
    },
    auth:{
      googleLoginEnabled:bool(auth.googleLoginEnabled,DEFAULT_SETTINGS.auth.googleLoginEnabled),
      allowNewStudents:bool(auth.allowNewStudents,DEFAULT_SETTINGS.auth.allowNewStudents),
      allowedDomain:normalizeDomain(auth.allowedDomain)
    },
    exam:{
      allowRetake:bool(exam.allowRetake,DEFAULT_SETTINGS.exam.allowRetake),
      allowRestart:bool(exam.allowRestart,DEFAULT_SETTINGS.exam.allowRestart)
    },
    smtp:{
      enabled:bool(smtp.enabled,DEFAULT_SETTINGS.smtp.enabled),
      host:text(smtp.host,DEFAULT_SETTINGS.smtp.host,255),
      port:integer(smtp.port,DEFAULT_SETTINGS.smtp.port,1,65535),
      security,
      username:text(smtp.username,DEFAULT_SETTINGS.smtp.username,255),
      fromName:text(smtp.fromName,DEFAULT_SETTINGS.smtp.fromName,120),
      fromEmail:text(smtp.fromEmail,DEFAULT_SETTINGS.smtp.fromEmail,160),
      replyTo:text(smtp.replyTo,DEFAULT_SETTINGS.smtp.replyTo,160),
      timeoutMs:integer(smtp.timeoutMs,DEFAULT_SETTINGS.smtp.timeoutMs,3000,120000),
      rejectUnauthorized:bool(smtp.rejectUnauthorized,DEFAULT_SETTINGS.smtp.rejectUnauthorized)
    },
    email:{
      enabled:emailEnabled,
      resultSubject:emailSubject,
      resultText:text(email.resultText||email.resultBody,DEFAULT_SETTINGS.email.resultText,6000),
      resultHtml:String(email.resultHtml??DEFAULT_SETTINGS.email.resultHtml).trim().slice(0,12000)
    },
    results:{notifyResultEmail:emailEnabled,resultEmailSubject:emailSubject},
    operations:{
      maintenanceMode:bool(operations.maintenanceMode,DEFAULT_SETTINGS.operations.maintenanceMode),
      maintenanceMessage:text(operations.maintenanceMessage,DEFAULT_SETTINGS.operations.maintenanceMessage,500)
    }
  };
  if(!out.general.systemName)throw new HttpsError('invalid-argument','Tên hệ thống không được để trống.');
  if(!validEmail(out.general.supportEmail))throw new HttpsError('invalid-argument','Email hỗ trợ không hợp lệ.');
  if(!out.general.publicUrl||!/^https?:\/\//i.test(out.general.publicUrl))throw new HttpsError('invalid-argument','Địa chỉ hệ thống phải bắt đầu bằng http:// hoặc https://.');
  if(out.auth.allowedDomain&&!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(out.auth.allowedDomain))throw new HttpsError('invalid-argument','Tên miền email được phép không hợp lệ.');
  if(out.smtp.enabled&&!out.smtp.host)throw new HttpsError('invalid-argument','SMTP Host không được để trống khi bật SMTP.');
  if(!out.smtp.fromName)throw new HttpsError('invalid-argument','Tên người gửi không được để trống.');
  if(!validEmail(out.smtp.fromEmail)||!out.smtp.fromEmail)throw new HttpsError('invalid-argument','Email người gửi không hợp lệ.');
  if(!validEmail(out.smtp.replyTo))throw new HttpsError('invalid-argument','Email nhận phản hồi không hợp lệ.');
  if(!out.email.resultSubject)throw new HttpsError('invalid-argument','Tiêu đề email không được để trống.');
  if(!out.email.resultText&&!out.email.resultHtml)throw new HttpsError('invalid-argument','Cần ít nhất một mẫu nội dung email.');
  if(!out.operations.maintenanceMessage)throw new HttpsError('invalid-argument','Thông báo bảo trì không được để trống.');
  return out;
}

exports.updateSystemSettings=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),user=await getUser(uid);
  if(user.active===false||user.role!=='master')throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được thay đổi cài đặt hệ thống.');
  const clean=normalizeSettings(request.data?.settings||{}),at=now();
  const payload={...clean,updatedAt:at,updatedBy:uid,updatedByName:user.name||user.email||'Quản trị cấp cao'};
  const settingsRef=db.collection('settings').doc('global');
  const publicRef=db.collection('publicSettings').doc('global');
  const auditRef=db.collection('auditLog').doc();
  const batch=db.batch();
  batch.set(settingsRef,payload,{merge:false});
  batch.set(publicRef,{
    version:clean.version,
    general:{systemName:clean.general.systemName,organizationName:clean.general.organizationName,publicUrl:clean.general.publicUrl},
    auth:clean.auth,
    operations:{maintenanceMode:clean.operations.maintenanceMode,maintenanceMessage:clean.operations.maintenanceMessage},
    updatedAt:at
  },{merge:false});
  batch.set(auditRef,{at,userId:uid,userName:user.name||'',action:'update_system_settings',entityType:'settings',entityId:'global',detail:{googleLoginEnabled:clean.auth.googleLoginEnabled,allowNewStudents:clean.auth.allowNewStudents,allowedDomain:Boolean(clean.auth.allowedDomain),maintenanceMode:clean.operations.maintenanceMode,allowRetake:clean.exam.allowRetake,allowRestart:clean.exam.allowRestart,emailEnabled:clean.email.enabled,smtpEnabled:clean.smtp.enabled,smtpHostConfigured:Boolean(clean.smtp.host)}});
  await batch.commit();
  return {settings:payload};
});

// Giữ tên callable cũ để các bản frontend trước không bị lỗi.
exports.sendTestEmail=onCall({region:REGION,timeoutSeconds:60},async request=>{
  const uid=requireAuth(request),user=await getUser(uid);
  if(user.active===false||user.role!=='master')throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được gửi email thử.');
  const to=text(request.data?.to,user.email||'',160);
  if(!validEmail(to)||!to)throw new HttpsError('invalid-argument','Địa chỉ nhận email thử không hợp lệ.');
  try{
    const sent=await sendConfiguredEmail({to,subject:'G2G – Kiểm tra SMTP',text:'Đây là email kiểm tra SMTP từ hệ thống G2G.',html:'<p>Đây là email kiểm tra SMTP từ hệ thống <strong>G2G</strong>.</p>'});
    await db.collection('auditLog').add({at:now(),userId:uid,userName:user.name||'',action:'send_test_email',entityType:'settings',entityId:'smtp',detail:{to,messageId:sent.messageId}});
    return {sent:true,to,messageId:sent.messageId};
  }catch(error){
    throw new HttpsError('failed-precondition',String(error?.message||'Không gửi được email thử.').slice(0,500));
  }
});

exports.DEFAULT_SETTINGS=DEFAULT_SETTINGS;
exports.normalizeSettings=normalizeSettings;
