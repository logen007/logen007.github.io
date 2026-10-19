import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const routes=new Map(),values=new Map();
let lastOptions,revoked=false,lastCredentials;
globalThis.__backupMocks={
 query:async(sql,args)=>{if(sql.startsWith('SELECT'))return {rows:values.has(args[0])?[{value_enc:values.get(args[0])}]:[]};if(sql.startsWith('INSERT'))values.set(args[0],args[1]);if(sql.startsWith('DELETE'))values.delete(args[0]);return {};},
 appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode}),
 currentUser:async request=>request.user,
 encrypt:value=>value,decrypt:value=>value,
 OAuth2Client:class{
  generateAuthUrl(options){lastOptions=options;return 'https://accounts.google.com/test';}
  async getToken(code){return {tokens:{refresh_token:code==='sheet'?'sheet-refresh':'private-refresh',access_token:code==='sheet'?'sheet-access':'private-access'}};}
  setCredentials(credentials){lastCredentials=credentials;}
  async getAccessToken(){return {token:lastCredentials?.refresh_token==='sheet-refresh'?'sheet-access':'private-access'};}
  async revokeToken(){revoked=true;}
 }
};
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(['/backup-google.js','/google-drive-oauth.js','/image-sheet-oauth.js'].some(path=>ctx.parentURL?.endsWith(path))){
  const names=specifier==='google-auth-library'?'OAuth2Client':specifier==='./db.js'?'query,appError,pool':specifier==='./auth.js'?'currentUser':specifier==='./settings-secrets.js'?'encrypt,decrypt':null;
  if(names)return {shortCircuit:true,url:'data:text/javascript,export const {'+names+'}=globalThis.__backupMocks;'};
 }
 return next(specifier,ctx);
}});
globalThis.__backupMocks.pool={query:globalThis.__backupMocks.query};
const originalFetch=globalThis.fetch;
const originalNow=Date.now;let now=Date.now(),requests=0;Date.now=()=>now;
process.env.BACKUP_GOOGLE_CLIENT_ID='test-client';
process.env.BACKUP_GOOGLE_CLIENT_SECRET='test-secret';
let revokedAccess=false;
globalThis.fetch=async(url,options)=>{requests++;return {ok:!revokedAccess,json:async()=>url.includes('userinfo')?{email:options.headers.Authorization==='Bearer sheet-access'?'sheet@example.test':'backup@example.test',email_verified:true}:url.includes('/files?q=')?{files:[]}:{id:'folder-id',mimeType:'application/vnd.google-apps.folder'}};};
try{
 const {registerBackupGoogleRoutes,backupDriveStatus,listBackupFiles,deleteBackupFile}=await import('../server/src/backup-google.js');
 await registerBackupGoogleRoutes({get:(p,fn)=>routes.set(p,fn),post:(p,fn)=>routes.set(p,fn)});
 const connect=routes.get('/api/backup/google/connect'),callback=routes.get('/api/backup/google/callback');
 const master={id:'admin',role:'master'},reply={setCookie(name,value){this.cookie=value;},clearCookie(){},redirect:url=>url};
 await assert.rejects(connect({user:{role:'student'}},reply),e=>e.statusCode===403);
 await connect({user:master},reply);
 assert.ok(lastOptions.scope.includes('https://www.googleapis.com/auth/drive.file'));
 assert.equal(lastOptions.access_type,'offline');
 const request={user:master,query:{state:lastOptions.state,code:'test'},cookies:{g2g_backup_oauth:reply.cookie},unsignCookie:value=>({valid:true,value})};
 await assert.rejects(callback({...request,cookies:{g2g_backup_oauth:'different-browser'}},reply),e=>e.statusCode===400);
 await connect({user:master},reply);
 request.query.state=lastOptions.state;request.cookies.g2g_backup_oauth=reply.cookie;
 assert.equal(await callback(request,reply),'/adm?tab=settings&settings=advanced');
 await assert.rejects(callback(request,reply),e=>e.statusCode===400);
 const status=await backupDriveStatus(master);
 assert.equal(status.folderId,'folder-id');
 assert.equal(status.connected,true);
 assert.equal(status.email,'backup@example.test');
 assert.doesNotMatch(JSON.stringify(status),/private-refresh|private-access|test-secret/);
 const backupBefore=values.get('backup_google_drive');
 const imageConnect=routes.get('/api/exam-images/google/connect');
 await assert.rejects(imageConnect({},reply),e=>e.statusCode===401);
 await assert.rejects(imageConnect({user:{role:'student'}},reply),e=>e.statusCode===403);
 await imageConnect({user:master},reply);
 const imageRequest={...request,query:{state:lastOptions.state,code:'sheet'},cookies:{g2g_backup_oauth:reply.cookie}};
 // Purpose comes from server-held state, never query input at callback.
 imageRequest.query.purpose='backup';
 assert.equal(await callback(imageRequest,reply),'/adm?tab=settings&settings=advanced');
 assert.equal(values.get('backup_google_drive'),backupBefore,'Sheet connection must not replace Backup credentials');
 assert.ok(values.has('image_sheet_google'));
 const {getImageSheetOAuthAccess,imageSheetGoogleStatus,disconnectImageSheetGoogle,saveImageSheetGoogleConnection}=await import('../server/src/image-sheet-oauth.js');
 assert.equal((await getImageSheetOAuthAccess()).token,'sheet-access');
 const sheetStatus=await imageSheetGoogleStatus(master);assert.equal(sheetStatus.email,'sheet@example.test');
 assert.doesNotMatch(JSON.stringify(sheetStatus),/private-refresh|private-access|sheet-refresh|sheet-access|test-secret/);
 await disconnectImageSheetGoogle();
 assert.equal(values.has('image_sheet_google'),false);assert.equal(revoked,false,'Sheet disconnect never revokes shared app grants');
 assert.equal(values.get('backup_google_drive'),backupBefore);
 await assert.rejects(getImageSheetOAuthAccess(),/dành riêng/,'Missing Sheet credentials must never fall back to Backup');
 await assert.rejects(callback(imageRequest,reply),e=>e.statusCode===400);
 const before=requests;await Promise.all([backupDriveStatus(master),backupDriveStatus(master)]);assert.equal(requests,before,'Frequent status polling reuses the folder check');
 revokedAccess=true;
 now+=60001;
 const expired=await backupDriveStatus(master);
 assert.equal(expired.connected,false);assert.equal(expired.needsReconnect,true);
 revokedAccess=false;
 await assert.rejects(backupDriveStatus({role:'teacher'}),e=>e.statusCode===403);
 const previousFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.notEqual(options.method,'DELETE','Image registry must never be deleted as a backup');
  return {ok:true,json:async()=>url.includes('/files?q=')?{files:[{id:'archive',mimeType:'application/gzip'},{id:'sheet',mimeType:'application/vnd.google-apps.spreadsheet'}]}:{id:'sheet',parents:['folder-id'],mimeType:'application/vnd.google-apps.spreadsheet'}};
 };
 assert.deepEqual((await listBackupFiles(master)).map(f=>f.id),['archive']);
 await assert.rejects(deleteBackupFile(master,'sheet'),e=>e.statusCode===404);
 globalThis.fetch=previousFetch;
 await saveImageSheetGoogleConnection({refreshToken:'sheet-refresh',email:'sheet@example.test'},master);
 const sheetBefore=values.get('image_sheet_google');
 await routes.get('/api/backup/google/disconnect')({user:master});
 assert.equal(revoked,true);assert.equal((await backupDriveStatus(master)).connected,false);
 assert.equal(values.get('image_sheet_google'),sheetBefore,'Backup disconnect must not delete independent Sheet credentials');
 assert.equal((await getImageSheetOAuthAccess()).token,'sheet-access');
 console.log('Backup OAuth: master-only, browser binding, replay rejection, private credentials, disconnect passed.');
}finally{hooks.deregister();globalThis.fetch=originalFetch;Date.now=originalNow;delete globalThis.__backupMocks;}
