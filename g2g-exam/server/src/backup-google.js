import crypto from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {currentUser} from './auth.js';

const KEY='backup_google_drive';
const REDIRECT='/api/backup/google/callback';
const SCOPE='https://www.googleapis.com/auth/drive.file';
const states=new Map();
let folderCheck;
const env=()=>({
  clientId:process.env.BACKUP_GOOGLE_CLIENT_ID||'',
  clientSecret:process.env.BACKUP_GOOGLE_CLIENT_SECRET||'',
  redirect:process.env.BACKUP_GOOGLE_REDIRECT_URI||`${process.env.PUBLIC_URL||'https://exam.g2gcareer.com'}${REDIRECT}`
});
const client=()=>{const c=env();if(!c.clientId||!c.clientSecret)throw appError(503,'Chưa cấu hình Google OAuth dành cho Backup.');return new OAuth2Client(c.clientId,c.clientSecret,c.redirect);};
const admin=async request=>{const user=await currentUser(request);if(user?.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được quản lý Backup.');return user;};
async function read(){const result=await query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return result.rows[0]?JSON.parse(decrypt(result.rows[0].value_enc)):null;}
export async function uploadBackupArchive(filename,name,sha256){
  const config=await getBackupDriveCredentials(),oauth=client();oauth.setCredentials({refresh_token:config.refreshToken});
  const {token}=await oauth.getAccessToken();
  const {stat}=await import('node:fs/promises'),{createReadStream}=await import('node:fs');
  const size=(await stat(filename)).size;
  const init=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime,description',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json','X-Upload-Content-Type':'application/gzip','X-Upload-Content-Length':String(size)},
    body:JSON.stringify({name,parents:[config.folderId],description:'g2g-backup-v2 sha256='+sha256}),signal:AbortSignal.timeout(30000)});
  const location=init.headers.get('location');
  if(!init.ok||!location||new URL(location).origin!=='https://www.googleapis.com')throw appError(503,'Không tạo được bản backup trên Drive.');
  const result=await fetch(location,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'content-length':String(size)},body:createReadStream(filename),duplex:'half',signal:AbortSignal.timeout(1800000)});
  if(!result.ok)throw appError(503,'Tải bản backup lên Drive thất bại.');
  return result.json();
}
async function save(config,user){await query(`INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_by=EXCLUDED.updated_by,updated_at=now()`,[KEY,encrypt(JSON.stringify(config)),user.id]);folderCheck=null;}
async function drive(config,method,url,body){
  const oauth=client();oauth.setCredentials({refresh_token:config.refreshToken});
  const token=await oauth.getAccessToken();
  if(!token.token)throw appError(503,'Google Drive đã mất quyền truy cập. Hãy kết nối lại.');
  const response=await fetch(`https://www.googleapis.com/drive/v3${url}`,{
    method,headers:{Authorization:`Bearer ${token.token}`,...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)
  });
  if(!response.ok){folderCheck=null;throw appError(503,'Google Drive không phản hồi hoặc quyền truy cập đã hết hạn.');}
  return response.status===204?{}:response.json();
}
async function ensureFolder(config){
  if(config.folderId)return config.folderId;
  const search=await drive(config,'GET',"/files?q="+encodeURIComponent("name = 'G2G Exam' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")+"&fields=files(id,name)&pageSize=20");
  const id=search.files?.[0]?.id;
  if(id)return id;
  const folder=await drive(config,'POST','/files?fields=id',{name:'G2G Exam',mimeType:'application/vnd.google-apps.folder'});
  return folder.id;
}
export async function backupDriveStatus(user){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  const config=await read();
  let accessible=false;
  if(config?.refreshToken&&config.folderId){
    const key=crypto.createHash('sha256').update(config.refreshToken+'\n'+config.folderId).digest('hex');
    if(!folderCheck||folderCheck.key!==key||folderCheck.expires<=Date.now()){
      const check={key,expires:Infinity};
      check.pending=drive(config,'GET',`/files/${encodeURIComponent(config.folderId)}?fields=id,mimeType,trashed`)
        .then(folder=>folder.trashed!==true&&folder.mimeType==='application/vnd.google-apps.folder').catch(()=>false)
        .then(ok=>{check.expires=Date.now()+(ok?60000:10000);return ok;});
      folderCheck=check;
    }
    accessible=await folderCheck.pending;
  }
  return {connected:accessible,needsReconnect:Boolean(config?.refreshToken)&&!accessible,email:config?.email||'',folderId:config?.folderId||'',oauthConfigured:Boolean(env().clientId&&env().clientSecret)};
}
export async function registerBackupGoogleRoutes(app){
  app.get('/api/backup/google/connect',async(request,reply)=>{
    const user=await admin(request),state=crypto.randomBytes(32).toString('hex');
    const oauth=client();
    for(const [key,item] of states)if(item.expires<Date.now())states.delete(key);
    states.set(state,{userId:user.id,expires:Date.now()+600000});
    reply.setCookie('g2g_backup_oauth',state,{path:REDIRECT,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',signed:true,maxAge:600});
    const url=oauth.generateAuthUrl({access_type:'offline',prompt:'consent select_account',scope:[SCOPE,'openid','email'],state});
    return reply.redirect(url);
  });
  app.get(REDIRECT,async(request,reply)=>{
    const {code,state}=request.query||{},record=states.get(String(state||''));
    const browser=request.unsignCookie(request.cookies?.g2g_backup_oauth||'');
    reply.clearCookie('g2g_backup_oauth',{path:REDIRECT});
    states.delete(String(state||''));
    const user=await admin(request);
    if(!code||!record||!browser.valid||browser.value!==state||record.expires<Date.now()||record.userId!==user.id)throw appError(400,'Phiên kết nối Google Drive không hợp lệ.');
    const oauth=client(),{tokens}=await oauth.getToken(String(code));
    if(!tokens.refresh_token)throw appError(400,'Google không cấp quyền truy cập dài hạn. Hãy kết nối lại.');
    const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});
    if(!info.ok)throw appError(503,'Không xác minh được tài khoản Google.');
    const identity=await info.json();
    if(identity.email_verified!==true)throw appError(400,'Email Google chưa được xác minh.');
    const config={refreshToken:tokens.refresh_token,email:identity.email||'',folderId:''};
    config.folderId=await ensureFolder(config);
    await save(config,user);
    return reply.redirect('/adm?tab=backup');
  });
  app.post('/api/backup/google/disconnect',async request=>{
    const user=await admin(request),config=await read();
    if(config?.refreshToken){
      try{const oauth=client();await oauth.revokeToken(config.refreshToken);}catch{/* local disconnect must still succeed */}
    }
    await query('DELETE FROM secrets WHERE key=$1',[KEY]);
    folderCheck=null;
    return {ok:true};
  });
}
export async function getBackupDriveCredentials(){
  const config=await read();if(!config?.refreshToken)throw appError(503,'Chưa kết nối Google Drive Backup.');
  return {...config,clientId:env().clientId,clientSecret:env().clientSecret};
}
export async function listBackupFiles(user){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  const config=await read();if(!config?.folderId)throw appError(409,'Chưa kết nối Google Drive.');
  const files=[];let next='';
  do{
    const result=await drive(config,'GET',`/files?q=${encodeURIComponent(`'${config.folderId}' in parents and trashed = false`)}&fields=nextPageToken,files(id,name,size,createdTime,mimeType,description)&orderBy=createdTime desc&pageSize=1000`+(next?'&pageToken='+encodeURIComponent(next):''));
    files.push(...result.files||[]);next=result.nextPageToken||'';
  }while(next);
  return files.filter(file=>file.mimeType!=='application/vnd.google-apps.folder').map(file=>({...file,size:Number(file.size||0)}));
}
export async function deleteBackupFile(user,id){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  if(!/^[A-Za-z0-9_-]+$/.test(String(id||'')))throw appError(400,'Mã backup không hợp lệ.');
  const config=await read();if(!config?.folderId)throw appError(409,'Chưa kết nối Google Drive.');
  const item=await drive(config,'GET',`/files/${encodeURIComponent(id)}?fields=id,parents`);
  if(!item.parents?.includes(config.folderId))throw appError(404,'Không tìm thấy backup.');
  await drive(config,'DELETE',`/files/${encodeURIComponent(id)}`);
  return {ok:true};
}
export async function downloadBackupFile(user,id){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  if(!/^[A-Za-z0-9_-]+$/.test(String(id||'')))throw appError(400,'Mã backup không hợp lệ.');
  const config=await read();if(!config?.folderId)throw appError(409,'Chưa kết nối Google Drive.');
  const item=await drive(config,'GET',`/files/${encodeURIComponent(id)}?fields=id,name,parents,mimeType`);
  if(!item.parents?.includes(config.folderId)||item.mimeType==='application/vnd.google-apps.folder')throw appError(404,'Không tìm thấy backup.');
  const oauth=client();oauth.setCredentials({refresh_token:config.refreshToken});const token=await oauth.getAccessToken();
  const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,{headers:{Authorization:`Bearer ${token.token}`},signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw appError(503,'Không tải được backup từ Google Drive.');
  return {name:item.name,body:response.body};
}
