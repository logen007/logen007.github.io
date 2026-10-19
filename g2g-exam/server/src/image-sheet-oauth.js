import {pool,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {googleDriveOAuthClient,googleDriveOAuthConfig} from './google-drive-oauth.js';

const KEY='image_sheet_google';
async function read(){const r=await pool.query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):{};}
export async function saveImageSheetGoogleConnection(config,user){
  await pool.query('INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_by=EXCLUDED.updated_by,updated_at=now()',[KEY,encrypt(JSON.stringify(config)),user.id]);
}
export async function disconnectImageSheetGoogle(){
  // Local disconnect only: revoking the app grant can invalidate other tokens
  // for the same Google account, including an independent Backup connection.
  await pool.query('DELETE FROM secrets WHERE key=$1',[KEY]);
}
export async function imageSheetGoogleStatus(user){
  if(user?.role!=='master')throw appError(403,'Không có quyền.');
  const config=await read(),oauth=googleDriveOAuthConfig();
  return {connected:Boolean(config.refreshToken),email:config.email||'',oauthConfigured:Boolean(oauth.clientId&&oauth.clientSecret)};
}
export async function getImageSheetOAuthAccess(){
  const config=await read();
  if(!config.refreshToken)throw appError(400,'Kết nối tài khoản Google dành riêng cho Sheet ảnh trong Cài đặt.');
  const oauth=googleDriveOAuthClient();oauth.setCredentials({refresh_token:config.refreshToken});
  const {token}=await oauth.getAccessToken();
  if(!token)throw appError(400,'Kết nối Google Sheet ảnh đã hết hạn. Anh kết nối lại trong Cài đặt.');
  return {token};
}
