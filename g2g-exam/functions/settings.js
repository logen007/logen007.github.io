const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db=getFirestore();

const DEFAULT_SETTINGS={
  version:1,
  general:{systemName:'Thi thử tiếng Đức',organizationName:'G2G Career',supportEmail:'admin@g2gcareer.com'},
  exam:{allowRetake:true,allowRestart:true},
  results:{notifyResultEmail:true,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
  operations:{maintenanceMode:false,maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'}
};

function now(){return new Date().toISOString();}
function requireAuth(request){if(!request.auth)throw new HttpsError('unauthenticated','Bạn cần đăng nhập.');return request.auth.uid;}
async function getUser(uid){const snap=await db.collection('users').doc(uid).get();if(!snap.exists)throw new HttpsError('permission-denied','Không tìm thấy tài khoản.');return {id:uid,...snap.data()};}
function text(value,fallback,max){const s=String(value??fallback??'').trim();return s.slice(0,max);}
function bool(value,fallback){return typeof value==='boolean'?value:Boolean(fallback);}
function normalizeSettings(input={}){
  const general=input.general||{},exam=input.exam||{},results=input.results||{},operations=input.operations||{};
  const out={
    version:1,
    general:{
      systemName:text(general.systemName,DEFAULT_SETTINGS.general.systemName,80),
      organizationName:text(general.organizationName,DEFAULT_SETTINGS.general.organizationName,100),
      supportEmail:text(general.supportEmail,DEFAULT_SETTINGS.general.supportEmail,160)
    },
    exam:{
      allowRetake:bool(exam.allowRetake,DEFAULT_SETTINGS.exam.allowRetake),
      allowRestart:bool(exam.allowRestart,DEFAULT_SETTINGS.exam.allowRestart)
    },
    results:{
      notifyResultEmail:bool(results.notifyResultEmail,DEFAULT_SETTINGS.results.notifyResultEmail),
      resultEmailSubject:text(results.resultEmailSubject,DEFAULT_SETTINGS.results.resultEmailSubject,180)
    },
    operations:{
      maintenanceMode:bool(operations.maintenanceMode,DEFAULT_SETTINGS.operations.maintenanceMode),
      maintenanceMessage:text(operations.maintenanceMessage,DEFAULT_SETTINGS.operations.maintenanceMessage,500)
    }
  };
  if(!out.general.systemName)throw new HttpsError('invalid-argument','Tên hệ thống không được để trống.');
  if(out.general.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.general.supportEmail))throw new HttpsError('invalid-argument','Email hỗ trợ không hợp lệ.');
  if(!out.results.resultEmailSubject)throw new HttpsError('invalid-argument','Tiêu đề email không được để trống.');
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
  batch.set(auditRef,{at,userId:uid,userName:user.name||'',action:'update_system_settings',entityType:'settings',entityId:'global',detail:{maintenanceMode:clean.operations.maintenanceMode,allowRetake:clean.exam.allowRetake,allowRestart:clean.exam.allowRestart,notifyResultEmail:clean.results.notifyResultEmail}});
  await batch.commit();
  return {settings:payload};
});

exports.DEFAULT_SETTINGS=DEFAULT_SETTINGS;
