// Host-only bridge from encrypted G2G settings to rclone's private OAuth config.
// Must run in deployed application tree; never expose token to browser or logs.
import {mkdir,writeFile,rename,rm,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {query,pool} from '../../server/src/db.js';
import {decrypt} from '../../server/src/settings-secrets.js';
const dir=process.env.BACKUP_PRIVATE_DIR;
if(!dir)throw Error('Private runner directory required; never store OAuth credentials in the web control mount');
const id=process.env.BACKUP_GOOGLE_CLIENT_ID;
const secret=process.env.BACKUP_GOOGLE_CLIENT_SECRET;
if(!id||!secret)throw Error('Backup OAuth client credentials not configured');
try{
 const result=await query("SELECT value_enc FROM secrets WHERE key='backup_google_drive'");
 if(!result.rowCount)throw Error('Connect Google Drive in Backup settings first');
 const cfg=JSON.parse(decrypt(result.rows[0].value_enc));
 if(!cfg.refreshToken||!cfg.folderId)throw Error('Incomplete Drive connection');
 for(const value of [cfg.folderId,id,secret])if(/[\r\n\0]/.test(value))throw Error('Invalid OAuth configuration');
 if(!/^[A-Za-z0-9_-]+$/.test(cfg.folderId))throw Error('Invalid Drive folder');
 const token={access_token:'',refresh_token:cfg.refreshToken,token_type:'Bearer',expiry:'2000-01-01T00:00:00Z'};
 const lines=['[gdrive]','type = drive','scope = drive.file','root_folder_id = '+cfg.folderId,'client_id = '+id,'client_secret = '+secret,'token = '+JSON.stringify(token),''];
 await mkdir(dir,{recursive:true,mode:0o700});
 const target=join(dir,'rclone.conf'),tmp=target+'.tmp.'+process.pid;
 try{await writeFile(tmp,lines.join('\n'),{flag:'wx',mode:0o600});await rename(tmp,target);await chmod(target,0o600);}
 finally{await rm(tmp,{force:true});}
 console.log('Private rclone configuration prepared');
}finally{await pool.end();}
