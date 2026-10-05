const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db=getFirestore();

const DEFAULT_SETTINGS={
  version:2,
  general:{
    systemName:'Thi thử tiếng Đức',
    organizationName:'G2G Career',
    supportEmail:'admin@g2gcareer.com',
    publicUrl:'https://logen007.github.io/g2g-exam/'
  },
  auth:{
    googleLoginEnabled:true,
    allowNewStudents:true
  },
  exam:{allowRetake:true,allowRestart:true},
  email:{
    enabled:true,
    provider:'firebase_trigger',
    senderName:'G2G Career',
    senderEmail:'admin@g2gcareer.com',
    replyTo:'admin@g2gcareer.com',
    resultSubject:'G2G – Đã có kết quả {exam}',
    resultBody:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nVui lòng đăng nhập hệ thống G2G để xem chi tiết.'
  },
  // Giữ để tương thích với dữ liệu/các bản code cũ.
  results:{notifyResultEmail:true,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
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
function validEmail(value){return !value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function normalizeSettings(input={}){
  const general=input.general||{},auth=input.auth||{},exam=input.exam||{},email=input.email||{},results=input.results||{},operations=input.operations||{};
  const emailEnabled=typeof email.enabled==='boolean'?email.enabled:bool(results.notifyResultEmail,DEFAULT_SETTINGS.email.enabled);
  const emailSubject=text(email.resultSubject||results.resultEmailSubject,DEFAULT_SETTINGS.email.resultSubject,220);
  const out={
    version:2,
    general:{
      systemName:text(general.systemName,DEFAULT_SETTINGS.general.systemName,80),
      organizationName:text(general.organizationName,DEFAULT_SETTINGS.general.organizationName,100),
      supportEmail:text(general.supportEmail,DEFAULT_SETTINGS.general.supportEmail,160),
      publicUrl:text(general.publicUrl,DEFAULT_SETTINGS.general.publicUrl,300)
    },
    auth:{
      googleLoginEnabled:bool(auth.googleLoginEnabled,DEFAULT_SETTINGS.auth.googleLoginEnabled),
      allowNewStudents:bool(auth.allowNewStudents,DEFAULT_SETTINGS.auth.allowNewStudents)
    },
    exam:{
      allowRetake:bool(exam.allowRetake,DEFAULT_SETTINGS.exam.allowRetake),
      allowRestart:bool(exam.allowRestart,DEFAULT_SETTINGS.exam.allowRestart)
    },
    email:{
      enabled:emailEnabled,
      provider:'firebase_trigger',
      senderName:text(email.senderName,DEFAULT_SETTINGS.email.senderName,100),
      senderEmail:text(email.senderEmail,DEFAULT_SETTINGS.email.senderEmail,160),
      replyTo:text(email.replyTo,DEFAULT_SETTINGS.email.replyTo,160),
      resultSubject:emailSubject,
      resultBody:text(email.resultBody,DEFAULT_SETTINGS.email.resultBody,3000)
    },
    results:{
      notifyResultEmail:emailEnabled,
      resultEmailSubject:emailSubject
    },
    operations:{
      maintenanceMode:bool(operations.maintenanceMode,DEFAULT_SETTINGS.operations.maintenanceMode),
      maintenanceMessage:text(operations.maintenanceMessage,DEFAULT_SETTINGS.operations.maintenanceMessage,500)
    }
  };
  if(!out.general.systemName)throw new HttpsError('invalid-argument','Tên hệ thống không được để trống.');
  if(!validEmail(out.general.supportEmail))throw new HttpsError('invalid-argument','Email hỗ trợ không hợp lệ.');
  if(!out.general.publicUrl)throw new HttpsError('invalid-argument','Địa chỉ hệ thống không được để trống.');
  if(!/^https?:\/\//i.test(out.general.publicUrl))throw new HttpsError('invalid-argument','Địa chỉ hệ thống phải bắt đầu bằng http:// hoặc https://.');
  if(!out.email.senderName)throw new HttpsError('invalid-argument','Tên người gửi email không được để trống.');
  if(!validEmail(out.email.senderEmail))throw new HttpsError('invalid-argument','Email người gửi không hợp lệ.');
  if(!validEmail(out.email.replyTo))throw new HttpsError('invalid-argument','Email nhận phản hồi không hợp lệ.');
  if(!out.email.resultSubject)throw new HttpsError('invalid-argument','Tiêu đề email không được để trống.');
  if(!out.email.resultBody)throw new HttpsError('invalid-argument','Nội dung email không được để trống.');
  if(!out.operations.maintenanceMessage)throw new HttpsError('invalid-argument','Thông báo bảo trì không được để trống.');
  return out;
}

exports.updateSystemSettings=onCall(async request=>{
  const uid=requireAuth(request),user=await getUser(uid);
  if(user.active===false||user.role!=='master')throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được thay đổi cài đặt hệ thống.');
  const clean=normalizeSettings(request.data?.settings||{}),at=now();
  const payload={...clean,updatedAt:at,updatedBy:uid,updatedByName:user.name||user.email||'Quản trị cấp cao'};
  const settingsRef=db.collection('settings').doc('global');
  const auditRef=db.collection('auditLog').doc();
  const batch=db.batch();
  batch.set(settingsRef,payload,{merge:false});
  batch.set(auditRef,{at,userId:uid,userName:user.name||'',action:'update_system_settings',entityType:'settings',entityId:'global',detail:{googleLoginEnabled:clean.auth.googleLoginEnabled,allowNewStudents:clean.auth.allowNewStudents,maintenanceMode:clean.operations.maintenanceMode,allowRetake:clean.exam.allowRetake,allowRestart:clean.exam.allowRestart,emailEnabled:clean.email.enabled,emailProvider:clean.email.provider}});
  await batch.commit();
  return {settings:payload};
});

exports.sendTestEmail=onCall(async request=>{
  const uid=requireAuth(request),user=await getUser(uid);
  if(user.active===false||user.role!=='master')throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được gửi email thử.');
  const snap=await db.collection('settings').doc('global').get();
  const clean=normalizeSettings(snap.exists?snap.data():DEFAULT_SETTINGS);
  if(!clean.email.enabled)throw new HttpsError('failed-precondition','Chức năng gửi email đang tắt.');
  const to=text(request.data?.to,user.email||clean.general.supportEmail,160);
  if(!validEmail(to)||!to)throw new HttpsError('invalid-argument','Địa chỉ nhận email thử không hợp lệ.');
  const at=now();
  const id=`test-${Date.now()}-${uid.slice(0,8)}`;
  const ref=db.collection('mail').doc(id);
  const auditRef=db.collection('auditLog').doc();
  const subject='G2G – Kiểm tra gửi email';
  const body=`Đây là email kiểm tra từ hệ thống ${clean.general.systemName}. Nếu bạn nhận được email này, hàng đợi gửi email đang hoạt động.`;
  const payload={
    to:[to],
    ...(clean.email.senderEmail?{from:`${clean.email.senderName} <${clean.email.senderEmail}>`}:{}),
    ...(clean.email.replyTo?{replyTo:clean.email.replyTo}:{}),
    message:{subject,text:body,html:`<p>${body}</p>`}
  };
  const batch=db.batch();
  batch.set(ref,payload,{merge:false});
  batch.set(auditRef,{at,userId:uid,userName:user.name||'',action:'send_test_email',entityType:'settings',entityId:'global',detail:{to}});
  await batch.commit();
  return {queued:true,to,id};
});

exports.DEFAULT_SETTINGS=DEFAULT_SETTINGS;
