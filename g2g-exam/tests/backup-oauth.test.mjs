import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const routes=new Map(),values=new Map();
let lastOptions,revoked=false;
globalThis.__backupMocks={
 query:async(sql,args)=>{if(sql.startsWith('SELECT'))return {rows:values.has(args[0])?[{value_enc:values.get(args[0])}]:[]};if(sql.startsWith('INSERT'))values.set(args[0],args[1]);if(sql.startsWith('DELETE'))values.delete(args[0]);return {};},
 appError:(statusCode,message)=>Object.assign(new Error(message),{statusCode}),
 currentUser:async request=>request.user,
 encrypt:value=>value,decrypt:value=>value,
 OAuth2Client:class{
  generateAuthUrl(options){lastOptions=options;return 'https://accounts.google.com/test';}
  async getToken(){return {tokens:{refresh_token:'private-refresh',access_token:'private-access'}};}
  setCredentials(){}
  async getAccessToken(){return {token:'private-access'};}
  async revokeToken(){revoked=true;}
 }
};
const hooks=registerHooks({resolve(specifier,ctx,next){
 if(ctx.parentURL?.endsWith('/backup-google.js')){
  const names=specifier==='google-auth-library'?'OAuth2Client':specifier==='./db.js'?'query,appError':specifier==='./auth.js'?'currentUser':specifier==='./settings-secrets.js'?'encrypt,decrypt':null;
  if(names)return {shortCircuit:true,url:'data:text/javascript,export const {'+names+'}=globalThis.__backupMocks;'};
 }
 return next(specifier,ctx);
}});
const originalFetch=globalThis.fetch;
process.env.BACKUP_GOOGLE_CLIENT_ID='test-client';
process.env.BACKUP_GOOGLE_CLIENT_SECRET='test-secret';
let revokedAccess=false;
globalThis.fetch=async url=>({ok:!revokedAccess,json:async()=>url.includes('userinfo')?{email:'admin@example.test',email_verified:true}:url.includes('/files?q=')?{files:[]}:{id:'folder-id',mimeType:'application/vnd.google-apps.folder'}});
try{
 const {registerBackupGoogleRoutes,backupDriveStatus}=await import('../server/src/backup-google.js');
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
 await callback(request,reply);
 await assert.rejects(callback(request,reply),e=>e.statusCode===400);
 const status=await backupDriveStatus(master);
 assert.equal(status.folderId,'folder-id');
 assert.equal(status.connected,true);
 assert.doesNotMatch(JSON.stringify(status),/private-refresh|private-access|test-secret/);
 revokedAccess=true;
 const expired=await backupDriveStatus(master);
 assert.equal(expired.connected,false);assert.equal(expired.needsReconnect,true);
 revokedAccess=false;
 await assert.rejects(backupDriveStatus({role:'teacher'}),e=>e.statusCode===403);
 await routes.get('/api/backup/google/disconnect')({user:master});
 assert.equal(revoked,true);assert.equal((await backupDriveStatus(master)).connected,false);
 console.log('Backup OAuth: master-only, browser binding, replay rejection, private credentials, disconnect passed.');
}finally{hooks.deregister();globalThis.fetch=originalFetch;delete globalThis.__backupMocks;}
