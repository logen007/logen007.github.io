import path from 'node:path';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {initDb,getSettings,getDataRevision,appError,pool} from './db.js';
import {createStateCache} from './state-cache.js';
import {registerAuthRoutes,currentUser,requireUser,requireRole} from './auth.js';
import {loadState,commitOperations} from './state.js';
import {loadExamCatalog} from './exam-catalog.js';
import {loadAttemptSync} from './attempt-sync.js';
import {stateResponse} from './state-response.js';
import {handleAction} from './actions.js';
import {registerPublicationRoute} from './publication-route.js';
import {startMediaGarbageCollector} from './media-gc.js';
import {startTrashGarbageCollector} from './trash-gc.js';
import {submitExpiredAttempts} from './actions/attempts.js';
import {r2Settings} from './r2-settings.js';
import {registerMediaDeliveryRoutes} from './media-routes.js';
import {APP_VERSION} from '../../src/release.js';
import {registerBackupGoogleRoutes} from './backup-google.js';
import {withMediaMutation} from './media-backup-lock.js';
import {startWritingAiWorker} from './writing-ai-queue.js';
import {startResultEmailWorker} from './actions/grading.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.resolve(process.env.WEB_PUBLIC_DIR||path.resolve(here,'../../public'));
const assetDir=path.resolve(process.env.WEB_ASSETS_DIR||'/data/web-assets');
const compressJson=promisify(gzip);
const uploadDir=path.resolve(process.env.UPLOAD_DIR||'/data/uploads');
const demoMediaUploadsEnabled=process.env.NODE_ENV!=='production'&&process.env.DEMO_MEDIA_UPLOAD_ENABLED==='true';
const demoUploadWindows=new Map();
if(process.env.NODE_ENV==='production'&&(!process.env.COOKIE_SECRET||/^(development-only-change-me|CHANGE_TO_A_LONG_RANDOM_VALUE)$/.test(process.env.COOKIE_SECRET))){
  throw new Error('Production requires a private COOKIE_SECRET; refusing insecure sessions.');
}
await fs.mkdir(uploadDir,{recursive:true});
await initDb();

const app=Fastify({logger:true,trustProxy:process.env.TRUST_PROXY==='true'});
const r2Media=await r2Settings.start({uploadDir,logger:app.log});
await app.register(cookie,{secret:process.env.COOKIE_SECRET||'development-only-change-me',hook:'onRequest'});
const origins=String(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
await app.register(cors,{origin:(origin,cb)=>{if(!origin||!origins.length||origins.includes(origin))cb(null,true);else cb(new Error('Origin không được phép.'),false);},credentials:true});
await app.register(multipart,{limits:{fileSize:25*1024*1024,files:1}});

app.addHook('onSend',async(request,reply,payload)=>{
  const pathname=String(request.url||'').split('?')[0];
  const noCache=['/', '/adm', '/teacher', '/student', '/index.html', '/vi.html', '/runtime-config.js'].includes(pathname);
  const sourceAsset=['/styles.css','/enhancements.css'].includes(pathname)||pathname.startsWith('/src/')||pathname.startsWith('/specs/');
  if(pathname.startsWith('/api/')&&!reply.hasHeader('Cache-Control'))reply.header('Cache-Control','no-store');
  if(sourceAsset)reply.header('Cache-Control','public, max-age=0, must-revalidate');
  if(pathname.startsWith('/assets/')&&reply.statusCode<400){
    reply.header('Cache-Control','public, max-age=31536000, immutable');
    const vary=new Set(String(reply.getHeader('Vary')||'').split(',').map(item=>item.trim()).filter(Boolean));vary.add('Accept-Encoding');reply.header('Vary',[...vary].join(', '));
  }
  if(noCache){
    reply.header('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    reply.header('Pragma','no-cache');reply.header('Expires','0');reply.header('Surrogate-Control','no-store');
  }
  const gzipAccepted=String(request.headers['accept-encoding']||'').split(',').some(item=>/^\s*gzip\s*(?:;|$)/i.test(item)&&!/\bq\s*=\s*0(?:\.0*)?\s*(?:;|$)/i.test(item));
  if(typeof payload==='string'&&Buffer.byteLength(payload)>1024&&String(reply.getHeader('Content-Type')||'').includes('application/json')&&!reply.hasHeader('Content-Encoding')&&gzipAccepted){
    reply.header('Content-Encoding','gzip');
    const vary=new Set(String(reply.getHeader('Vary')||'').split(',').map(item=>item.trim()).filter(Boolean));vary.add('Accept-Encoding');reply.header('Vary',[...vary].join(', '));
    reply.removeHeader('Content-Length');
    return compressJson(payload);
  }
  return payload;
});

// Retain content-addressed chunks across deployments for students/editors who
// still have an older tab open. Existing media/database volumes are untouched.
await fs.mkdir(assetDir,{recursive:true});
try{await fs.cp(path.join(publicDir,'assets'),assetDir,{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
await app.register(fastifyStatic,{root:assetDir,prefix:'/assets/',decorateReply:false,preCompressed:true});
await app.register(fastifyStatic,{root:publicDir,prefix:'/',index:['index.html'],preCompressed:true});
await registerAuthRoutes(app);
await registerBackupGoogleRoutes(app);

app.get('/api/health',async()=>{let db=true;try{await pool.query('SELECT 1');}catch{db=false;}return {ok:db,backend:'vps',database:db,time:new Date().toISOString()};});
app.get('/api/version',async()=>({version:APP_VERSION}));
const publicSettingsCache=createStateCache({revision:getDataRevision,ttlMs:30000,maxEntries:1});
app.get('/api/public-settings',async()=>publicSettingsCache('public',async()=>{
  const s=await getSettings();
  const [students,graded,exams,teachers,attempts]=await Promise.all([
    pool.query(`SELECT count(*)::int AS count FROM users WHERE role='student'`),
    pool.query(`SELECT count(*)::int AS count FROM attempts WHERE status='published'`),
    pool.query(`SELECT data->>'provider' AS provider,data->>'level' AS level FROM exams WHERE status='published'`),
    pool.query(`SELECT count(*)::int AS count FROM users WHERE role='teacher'`),
    pool.query(`SELECT count(*)::int AS count FROM attempts WHERE status IN ('grading','ready','published')`),
  ]);
  const examTypes=[...new Set(exams.rows.map(row=>[row.provider,row.level].filter(Boolean).join(' ')).filter(Boolean))].sort();
  return {general:{examMessages:s.general.examMessages||'',systemName:s.general.systemName,organizationName:s.general.organizationName,publicUrl:s.general.publicUrl,logoUrl:s.general.logoUrl,faviconUrl:s.general.faviconUrl},theme:s.theme,auth:{googleLoginEnabled:s.auth.googleLoginEnabled,allowNewStudents:s.auth.allowNewStudents},operations:{maintenanceMode:s.operations.maintenanceMode,maintenanceMessage:s.operations.maintenanceMessage},stats:{teachers:teachers.rows[0].count,attempts:attempts.rows[0].count,students:students.rows[0].count,graded:graded.rows[0].count,exams:exams.rowCount,examTypes}};
}));
app.get('/api/settings',async request=>{await requireRole(request,'master');return {settings:await getSettings()};});
const cachedState=createStateCache({revision:getDataRevision});
const readState=async(request,reply,scope,load)=>{
  const user=await requireUser(request);
  const state=await cachedState(JSON.stringify([scope,user]),()=>load(user));
  return stateResponse(state,request,reply,{prehashed:true});
};
app.get('/api/state',async(request,reply)=>readState(request,reply,'full',loadState));
app.get('/api/state-summary',async(request,reply)=>readState(request,reply,'summary',user=>loadState(user,{summaryOnly:true})));
app.get('/api/exam-catalog',async(request,reply)=>readState(request,reply,'catalog',loadExamCatalog));
app.get('/api/attempts/:id/sync',async(request,reply)=>stateResponse(await loadAttemptSync(await requireUser(request),request.params.id),request,reply));
app.get('/api/attempts/:id/session',async(request,reply)=>{
  const user=await requireRole(request,'student');
  return stateResponse(await loadState(user,{attemptId:request.params.id}),request,reply);
});
app.post('/api/commit',async request=>commitOperations(await requireUser(request),request.body?.operations||[]));
registerPublicationRoute(app,requireUser);
app.post('/api/actions/:name',async request=>handleAction(await requireUser(request),request.params.name,request.body||{}));

function demoUploadUser(request){
  if(!demoMediaUploadsEnabled)throw appError(404,'Chế độ upload demo chưa được bật.');
  const now=Date.now(),key=request.ip||'unknown';
  const recent=(demoUploadWindows.get(key)||[]).filter(time=>now-time<60*60*1000);
  if(recent.length>=10)throw appError(429,'Chế độ demo chỉ cho phép tối đa 10 audio mỗi giờ.');
  recent.push(now);demoUploadWindows.set(key,recent);return {id:'demo-teacher',role:'teacher'};
}

async function saveUpload(request,{kind,maxBytes,mimePrefix,defaultExt},user=null){
  user=user||await requireRole(request,'teacher','master');
  const part=await request.file();
  if(!part)throw appError(400,`Chưa chọn tệp ${kind}.`);
  if(part.mimetype&&!part.mimetype.startsWith(mimePrefix))throw appError(400,`Tệp tải lên không phải ${kind}.`);
  const ext=path.extname(part.filename||'').replace(/[^.a-zA-Z0-9]/g,'').slice(0,10);
  const imageStem=path.basename(part.filename||'image',ext).toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,60)||'image';
  const name=mimePrefix==='image/'&&part.mimetype==='image/jpeg'
    ?`${imageStem}-${randomUUID().slice(0,8)}.jpg`
    :`${Date.now()}-${randomUUID()}${ext||defaultExt}`;
  const dest=path.join(uploadDir,name);let size=0;
  part.file.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)part.file.destroy(appError(413,`Tệp ${kind} vượt quá giới hạn cho phép.`));});
  await withMediaMutation(async()=>{
    try{await pipeline(part.file,createWriteStream(dest,{flags:'wx'}));}catch(error){await fs.rm(dest,{force:true});throw error;}
    if(part.file.truncated||size>maxBytes){await fs.rm(dest,{force:true});throw appError(413,`Tệp ${kind} vượt quá giới hạn cho phép.`);}
  });
  app.log.info({user:user.id,file:name,kind},'media uploaded');return {url:`/uploads/${name}`};
}

app.post('/api/media/audio',async request=>saveUpload(request,{kind:'âm thanh',maxBytes:25*1024*1024,mimePrefix:'audio/',defaultExt:'.audio'}));
app.post('/api/media/image',async request=>saveUpload(request,{kind:'hình ảnh',maxBytes:8*1024*1024,mimePrefix:'image/',defaultExt:'.img'}));
app.post('/api/demo/media/audio',async request=>saveUpload(request,{kind:'âm thanh',maxBytes:25*1024*1024,mimePrefix:'audio/',defaultExt:'.audio'},demoUploadUser(request)));
app.post('/api/demo/media/image',async request=>saveUpload(request,{kind:'hình ảnh',maxBytes:8*1024*1024,mimePrefix:'image/',defaultExt:'.img'},demoUploadUser(request)));
registerMediaDeliveryRoutes(app,{uploadDir,r2Media,authenticate:async request=>{if(!demoMediaUploadsEnabled)await requireUser(request);}});
app.get('/brand/:kind',async(request,reply)=>{
  const key=request.params.kind==='logo'?'logoUrl':request.params.kind==='favicon'?'faviconUrl':null;
  if(!key)throw appError(404,'Ảnh không tồn tại.');
  const settings=await getSettings(),name=path.basename(settings.general[key]||'');
  if(!name)throw appError(404,'Ảnh không tồn tại.');
  reply.header('Cache-Control','public, max-age=300');
  return reply.sendFile(name,uploadDir);
});
app.get('/api/whoami',async request=>({user:await currentUser(request)}));

app.setErrorHandler((error,_request,reply)=>{app.log.error(error);const status=Number(error.statusCode)||500;reply.code(status).send({error:status>=500?'Lỗi máy chủ. Vui lòng thử lại.':error.message,code:status});});
app.setNotFoundHandler((request,reply)=>{if(request.url.startsWith('/api/'))return reply.code(404).send({error:'API không tồn tại.'});if(/^\/(assets|src|specs)\//.test(request.url))return reply.code(404).send({error:'Tài nguyên không tồn tại.'});return reply.sendFile('vi.html');});

const {startMonitorHistory}=await import('./monitor-history.js');
const stopMonitorHistory=startMonitorHistory(app.log);
const port=Number(process.env.PORT||8080);
app.addHook('onClose',async()=>{stopMonitorHistory();r2Media?.stop();stopMediaGc();stopTrashGc();stopWritingAi();stopResultEmails();clearInterval(expiryTimer);});
await app.listen({host:'0.0.0.0',port});
const stopMediaGc=startMediaGarbageCollector({uploadDir,logger:app.log});
const stopTrashGc=startTrashGarbageCollector({uploadDir,logger:app.log});
const stopWritingAi=startWritingAiWorker({logger:app.log});
const stopResultEmails=startResultEmailWorker(app.log);
let expiryBusy=false;
const expiryTimer=setInterval(async()=>{if(expiryBusy)return;expiryBusy=true;try{await submitExpiredAttempts();}catch(error){app.log.error(error);}finally{expiryBusy=false;}},5000);
expiryTimer.unref();
export {app};
const stop=async()=>{try{await app.close();await pool.end();}finally{process.exit(0);}};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
