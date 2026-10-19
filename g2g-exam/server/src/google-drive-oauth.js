import {OAuth2Client} from 'google-auth-library';
import {appError} from './db.js';

// Both connections use the existing Cloud application, but never share tokens.
export const googleDriveOAuthConfig=()=>({
  clientId:process.env.BACKUP_GOOGLE_CLIENT_ID||'',
  clientSecret:process.env.BACKUP_GOOGLE_CLIENT_SECRET||'',
  redirect:process.env.BACKUP_GOOGLE_REDIRECT_URI||`${process.env.PUBLIC_URL||'https://exam.g2gcareer.com'}/api/backup/google/callback`
});
export function googleDriveOAuthClient(){
  const c=googleDriveOAuthConfig();
  if(!c.clientId||!c.clientSecret)throw appError(503,'Chưa cấu hình ứng dụng Google OAuth.');
  return new OAuth2Client(c.clientId,c.clientSecret,c.redirect);
}
