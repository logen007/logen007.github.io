import crypto from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {currentUser} from './auth.js';

const KEY='backup_google_drive';
const REDIRECT='/api/backup/google/callback';
const SCOPE='https://www.googleapis.com/auth/drive.file';
const states=new Map();
const env=()=>({
  clientId:process.env.BACKUP_GOOGLE_CLIENT_ID||'',
  clientSecret:process.env.BACKUP_GOOGLE_CLIENT_SECRET||'',
  redirect:process.env.BACKUP_GOOGLE_REDIRECT_URI||`${process.env.PUBLIC_URL||'https://exam.g2gcareer.com'}${REDIRECT}`
});
const client=()=>{const c=env();if(!c.clientId||!c.clientSecret)throw appError(503,'Chưa cấu hình Google OAuth dành cho Backup.');return new OAuth2Client(c.clientId,c.clientSecret,c.redirect);};
const admin=async request=>{const user=await currentUser(request);if(user?.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được quản lý Backup.');return user;};
async function read(){const result=await query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return result.rows[0]?JSON.parse(decrypt(result.rows[0].value_enc)):null;}
async function save(config,user){await query(`INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_by=EXCLUDED.updated_by,updated_at=now()`,[KEY,encrypt(JSON.stringify(config)),user.id]);}
async function drive(config,method,url,body){
  const oauth=client();oauth.setCredentials({refresh_token:config.refreshToken});
  const token=await oauth.getAccessToken();
  if(!token.token)throw appError(503,'Google Drive đã mất quyền truy cập. Hãy kết nối lại.');
  const response=await fetch(`https://www.googleapis.com/drive/v3${url}`,{
    method,headers:{Authorization:`Bearer ${token.token}`,...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw appError(503,'Google Drive không phản hồi hoặc quyền truy cập đã hết hạn.');
  return response.json();
}
async function ensureFolder(config){
  if(config.folderId)return config.folderId;
  const search=await drive(config,'GET',"/files?q="+encodeURIComponent("name = 'G2G Exam' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")+"&fields=files(id,name)&page_size=20");
  const id=search.files?.[0]?.id;
  if(id)return id;
  const folder=await drive(config,'POST','/files?fields=id',{name:'G2G Exam',mimeType:'application/vnd.google-apps.folder'});
  return folder.id;
}
export async function backupDriveStatus(user){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  const config=await read();
  return {connected:Boolean(config?.refreshToken),email:config?.email||'',folderId:config?.folderId||'',oauthConfigured:Boolean(env().clientId&&env().clientSecret)};
}
export async function registerBackupGoogleRoutes(app){
  app.get('/api/backup/google/connect',async(request,reply)=>{
    const user=await admin(request),state=crypto.randomBytes(32).toString('hex');
    for(const [key,item] of states)if(item.expires<Date.now())states.delete(key);
    states.set(state,{userId:user.id,expires:Date.now()+600000});
    const url=client().generateAuthUrl({access_type:'offline',prompt:'consent select_account',scope:[SCOPE,'openid','email'],state});
    return reply.redirect(url);
  });
  app.get(REDIRECT,async(request,reply)=>{
    const {code,state}=request.query||{},record=states.get(String(state||''));
    states.delete(String(state||''));
    const user=await admin(request);
    if(!code||!record||record.expires<Date.now()||record.userId!==user.id)throw appError(400,'Phiên kết nối Google Drive không hợp lệ.');
    const oauth=client(),{tokens}=await oauth.getToken(String(code));
    if(!tokens.refresh_token)throw appError(400,'Google không cấp quyền truy cập dài hạn. Hãy kết nối lại.');
    const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});
    if(!info.ok)throw appError(503,'Không xác minh được tài khoản Google.');
    const identity=await info.json();
    const config={refreshToken:tokens.refresh_token,email:identity.email||'',folderId:''};
    config.folderId=await ensureFolder(config);
    await save(config,user);
    return reply.redirect('/adm?tab=settings&settings=advanced');
  });
  app.post('/api/backup/google/disconnect',async request=>{
    const user=await admin(request),config=await read();
    if(config?.refreshToken){
      try{const oauth=client();await oauth.revokeToken(config.refreshToken);}catch{/* local disconnect must still succeed */}
    }
    await query('DELETE FROM secrets WHERE key=$1',[KEY]);
    return {ok:true};
  });
}
export async function getBackupDriveCredentials(){
  const config=await read();if(!config?.refreshToken)throw appError(503,'Chưa kết nối Google Drive Backup.');
  return {...config,clientId:env().clientId,clientSecret:env().clientSecret};
}
