const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const nodemailer = require('nodemailer');

const db = getFirestore();
const secrets = new SecretManagerServiceClient();
const SMTP_SECRET_ID = 'SMTP_PASSWORD';
const REGION = 'asia-southeast1';

function now(){ return new Date().toISOString(); }
function projectId(){
  if(process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if(process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try{ return JSON.parse(process.env.FIREBASE_CONFIG||'{}').projectId || ''; }catch{ return ''; }
}
function requireAuth(request){
  if(!request.auth) throw new HttpsError('unauthenticated','Bạn cần đăng nhập.');
  return request.auth.uid;
}
async function getUser(uid){
  const snap=await db.collection('users').doc(uid).get();
  if(!snap.exists) throw new HttpsError('permission-denied','Không tìm thấy tài khoản.');
  return {id:uid,...snap.data()};
}
async function requireMaster(request){
  const uid=requireAuth(request),user=await getUser(uid);
  if(user.active===false||user.role!=='master') throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được cấu hình SMTP.');
  return user;
}
async function loadSettings(){
  const snap=await db.collection('settings').doc('global').get();
  return snap.exists?snap.data():{};
}
function smtpSettings(settings){
  const s=settings.smtp||{};
  return {
    enabled:s.enabled!==false,
    host:String(s.host||'').trim(),
    port:Math.max(1,Math.min(65535,Number(s.port||587))),
    security:['ssl','starttls','none'].includes(s.security)?s.security:'starttls',
    username:String(s.username||'').trim(),
    fromName:String(s.fromName||settings.general?.organizationName||'G2G Career').trim(),
    fromEmail:String(s.fromEmail||settings.general?.supportEmail||'').trim(),
    replyTo:String(s.replyTo||settings.general?.supportEmail||'').trim(),
    timeoutMs:Math.max(3000,Math.min(120000,Number(s.timeoutMs||20000))),
    rejectUnauthorized:s.rejectUnauthorized!==false
  };
}
function secretName(){
  const pid=projectId();
  if(!pid) throw new Error('Không xác định được Firebase Project ID.');
  return `projects/${pid}/secrets/${SMTP_SECRET_ID}`;
}
async function getSmtpPassword(){
  const name=`${secretName()}/versions/latest`;
  const [version]=await secrets.accessSecretVersion({name});
  const value=version.payload?.data?.toString('utf8')||'';
  if(!value) throw new Error('SMTP_PASSWORD chưa được cấu hình.');
  return value;
}
async function smtpSecretStatus(){
  try{
    const [version]=await secrets.accessSecretVersion({name:`${secretName()}/versions/latest`});
    return {configured:Boolean(version.payload?.data?.length),version:version.name?.split('/').pop()||'latest'};
  }catch(error){
    const code=Number(error?.code);
    if(code===5) return {configured:false,version:null};
    return {configured:false,version:null,error:String(error?.message||'Không đọc được Secret Manager.')};
  }
}
async function ensureSecretExists(){
  const name=secretName();
  try{ await secrets.getSecret({name}); return name; }
  catch(error){
    if(Number(error?.code)!==5) throw error;
    const pid=projectId();
    const [created]=await secrets.createSecret({
      parent:`projects/${pid}`,
      secretId:SMTP_SECRET_ID,
      secret:{replication:{automatic:{}}}
    });
    return created.name||name;
  }
}
async function setSmtpPassword(password){
  const clean=String(password||'');
  if(!clean) throw new HttpsError('invalid-argument','Mật khẩu SMTP không được để trống.');
  if(clean.length>4096) throw new HttpsError('invalid-argument','Mật khẩu SMTP quá dài.');
  const parent=await ensureSecretExists();
  const [version]=await secrets.addSecretVersion({parent,payload:{data:Buffer.from(clean,'utf8')}});
  return {configured:true,version:version.name?.split('/').pop()||null};
}
function buildTransport(smtp,password){
  if(!smtp.host) throw new Error('Chưa cấu hình SMTP Host.');
  if(!smtp.fromEmail) throw new Error('Chưa cấu hình email người gửi.');
  if(smtp.username&&!password) throw new Error('Chưa cấu hình mật khẩu SMTP.');
  const transport={
    host:smtp.host,
    port:smtp.port,
    secure:smtp.security==='ssl',
    requireTLS:smtp.security==='starttls',
    connectionTimeout:smtp.timeoutMs,
    greetingTimeout:smtp.timeoutMs,
    socketTimeout:smtp.timeoutMs,
    tls:{rejectUnauthorized:smtp.rejectUnauthorized}
  };
  if(smtp.username) transport.auth={user:smtp.username,pass:password};
  return nodemailer.createTransport(transport);
}
function fromAddress(smtp){
  const safeName=String(smtp.fromName||'').replace(/[\r\n"]/g,' ').trim();
  return safeName?`"${safeName}" <${smtp.fromEmail}>`:smtp.fromEmail;
}
function htmlEscape(v=''){
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderTemplate(template,vars={},html=false){
  let out=String(template||'');
  for(const [key,value] of Object.entries(vars)){
    const safe=html?htmlEscape(value??''):String(value??'');
    out=out.replaceAll(`{${key}}`,safe);
  }
  return out;
}

async function sendConfiguredEmail({to,subject,text,html}){
  const settings=await loadSettings();
  const smtp=smtpSettings(settings);
  if(!smtp.enabled) throw new Error('SMTP đang bị tắt trong Cài đặt.');
  const password=smtp.username?await getSmtpPassword():'';
  const transporter=buildTransport(smtp,password);
  const info=await transporter.sendMail({
    from:fromAddress(smtp),
    to,
    replyTo:smtp.replyTo||undefined,
    subject,
    text:text||undefined,
    html:html||undefined
  });
  return {messageId:info.messageId||'',response:info.response||''};
}

exports.updateSmtpSecret = onCall({region:REGION},async request=>{
  const user=await requireMaster(request);
  const result=await setSmtpPassword(request.data?.password);
  await db.collection('auditLog').add({at:now(),userId:user.id,userName:user.name||'',action:'update_smtp_secret',entityType:'settings',entityId:'smtp',detail:{version:result.version}});
  return result;
});

exports.getInfrastructureStatus = onCall({region:REGION},async request=>{
  await requireMaster(request);
  const settings=await loadSettings(),smtp=smtpSettings(settings),secret=await smtpSecretStatus();
  return {
    firebaseProject:projectId()||'Chưa xác định',
    functionsRegion:REGION,
    firestore:true,
    functions:true,
    googleLoginConfigured:Boolean(settings.auth?.googleEnabled),
    smtp:{
      enabled:smtp.enabled,
      configured:Boolean(smtp.host&&smtp.fromEmail&&(!smtp.username||secret.configured)),
      hostConfigured:Boolean(smtp.host),
      usernameConfigured:Boolean(smtp.username),
      secretConfigured:Boolean(secret.configured),
      secretVersion:secret.version||null,
      secretError:secret.error||null
    }
  };
});

exports.testSmtp = onCall({region:REGION,timeoutSeconds:60},async request=>{
  const user=await requireMaster(request);
  const to=String(request.data?.to||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpsError('invalid-argument','Email nhận thử không hợp lệ.');
  try{
    const settings=await loadSettings();
    const systemName=settings.general?.systemName||'G2G Thi thử';
    const sent=await sendConfiguredEmail({
      to,
      subject:`${systemName} – Kiểm tra SMTP`,
      text:`Đây là email kiểm tra SMTP từ ${systemName}. Nếu bạn nhận được email này, cấu hình gửi mail đang hoạt động.`,
      html:`<p>Đây là email kiểm tra SMTP từ <strong>${htmlEscape(systemName)}</strong>.</p><p>Nếu bạn nhận được email này, cấu hình gửi mail đang hoạt động.</p>`
    });
    await db.collection('auditLog').add({at:now(),userId:user.id,userName:user.name||'',action:'test_smtp',entityType:'settings',entityId:'smtp',detail:{to,messageId:sent.messageId}});
    return {ok:true,messageId:sent.messageId};
  }catch(error){
    console.error('SMTP test failed',error);
    throw new HttpsError('failed-precondition',String(error?.message||'Không gửi được email thử.').slice(0,500));
  }
});

exports.sendConfiguredEmail = sendConfiguredEmail;
exports.renderTemplate = renderTemplate;
exports.smtpSecretStatus = smtpSecretStatus;
