import {pool,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {getBackupDriveAccess,backupDriveStatus} from './backup-google.js';

const KEY='image_sheet_picker';
async function read(){const r=await pool.query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):{};}
async function save(value,user){await pool.query('INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_by=EXCLUDED.updated_by,updated_at=now()',[KEY,encrypt(JSON.stringify(value)),user.id]);}
export function pickerConfiguration(previous,{apiKey,projectNumber}){
  apiKey=String(apiKey||previous.apiKey||'').trim();projectNumber=String(projectNumber||'').trim();
  if(!/^[A-Za-z0-9_-]{20,200}$/.test(apiKey))throw appError(400,'Nhập API key Google Picker hợp lệ.');
  if(!/^\d{6,30}$/.test(projectNumber))throw appError(400,'Nhập Project number (dãy số), không phải Project ID.');
  return {apiKey,projectNumber,folderId:previous.folderId||'',authorized:apiKey===previous.apiKey&&projectNumber===previous.projectNumber&&previous.authorized===true};
}
export async function getImageSheetGoogleAccess(){
  const config=await read();
  if(!config.authorized)throw appError(400,'Vào Cài đặt → Nâng cao → Google Drive và Sheet ảnh để cấp quyền trước.');
  let connection;try{connection=await getBackupDriveAccess();}catch{throw appError(400,'Kết nối Google đã hết hạn. Anh kết nối lại trong Cài đặt → Nâng cao.');}
  if(config.folderId!==connection.folderId)throw appError(400,'Kết nối Google đã đổi. Anh chọn lại Exam img trong Cài đặt → Nâng cao.');
  return connection;
}
export function registerImageSheetGoogleRoutes(app,{authenticate,sheetId,makeGoogle,storage={read,save},access=getBackupDriveAccess,driveStatus=backupDriveStatus}){
  app.get('/api/exam-images/google-settings',async(request,reply)=>{
    const user=await authenticate(request);reply.header('Cache-Control','private, no-store');
    const config=await storage.read(),drive=await driveStatus(user);
    return {configured:Boolean(config.apiKey&&config.projectNumber),projectNumber:config.projectNumber||'',authorized:Boolean(config.authorized&&config.folderId===drive.folderId),driveConnected:drive.connected,email:drive.email||'',oauthConfigured:drive.oauthConfigured};
  });
  app.post('/api/exam-images/google-settings',async(request,reply)=>{
    const user=await authenticate(request);reply.header('Cache-Control','private, no-store');
    const config=pickerConfiguration(await storage.read(),request.body||{});await storage.save(config,user);
    return {ok:true};
  });
  // Google Picker requires this short-lived drive.file access token in the
  // master's browser. Never return refresh tokens/client secrets or cache it.
  app.post('/api/exam-images/picker',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    const config=await storage.read();
    if(!config.apiKey||!config.projectNumber)throw appError(400,'Lưu API key và Project number trước khi chọn Sheet.');
    let connection;try{connection=await access();}catch{throw appError(400,'Kết nối Google Drive trong Cài đặt trước.');}
    return {apiKey:config.apiKey,appId:config.projectNumber,accessToken:connection.token,sheetId};
  });
  app.post('/api/exam-images/authorize',async(request,reply)=>{
    const user=await authenticate(request);reply.header('Cache-Control','private, no-store');
    if(request.body?.sheetId!==sheetId)throw appError(400,'Anh chọn đúng file Exam img đã chỉ định.');
    const config=await storage.read();
    if(!config.apiKey||!config.projectNumber)throw appError(400,'Chưa cấu hình Google Picker.');
    let connection;try{connection=await access();}catch{throw appError(400,'Kết nối Google đã hết hạn. Anh kết nối lại trong Cài đặt.');}
    const google=makeGoogle(connection.token);
    const file=await google('drive','GET',`/files/${sheetId}?fields=id,mimeType,trashed,capabilities(canEdit)`);
    if(file.id!==sheetId||file.trashed||file.mimeType!=='application/vnd.google-apps.spreadsheet'||file.capabilities?.canEdit!==true)throw appError(400,'Tài khoản Google này chưa có quyền chỉnh sửa Exam img.');
    const sheet=await google('sheets','GET',`/${sheetId}?fields=spreadsheetId`);
    if(sheet.spreadsheetId!==sheetId)throw appError(400,'Không xác minh được Sheet ảnh.');
    await storage.save({...config,authorized:true,folderId:connection.folderId},user);
    return {ok:true};
  });
  app.post('/api/exam-images/disconnect',async(request,reply)=>{
    const user=await authenticate(request);reply.header('Cache-Control','private, no-store');
    await storage.save({...await storage.read(),authorized:false},user);
    return {ok:true};
  });
}
