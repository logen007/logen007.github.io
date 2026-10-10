import path from 'node:path';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {initDb,getSettings,appError,pool} from './db.js';
import {registerAuthRoutes,currentUser,requireUser,requireRole} from './auth.js';
import {loadState,commitOperations} from './state.js';
import {handleAction} from './actions.js';
import {startMediaGarbageCollector} from './media-gc.js';
import {submitExpiredAttempts} from './actions/attempts.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.resolve(here,'../../public');
const uploadDir=path.resolve(process.env.UPLOAD_DIR||'/data/uploads');
const demoMediaUploadsEnabled=process.env.NODE_ENV!=='production'&&process.env.DEMO_MEDIA_UPLOAD_ENABLED==='true';
const demoUploadWindows=new Map();
if(process.env.NODE_ENV==='production'&&(!process.env.COOKIE_SECRET||/^(development-only-change-me|CHANGE_TO_A_LONG_RANDOM_VALUE)$/.test(process.env.COOKIE_SECRET))){
  throw new Error('Production requires a private COOKIE_SECRET; refusing insecure sessions.');
}
await fs.mkdir(uploadDir,{recursive:true});
await initDb();

const app=Fastify({logger:true,trustProxy:process.env.TRUST_PROXY==='true'});
await app.register(cookie,{secret:process.env.COOKIE_SECRET||'development-only-change-me',hook:'onRequest'});
const origins=String(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
await app.register(cors,{origin:(origin,cb)=>{if(!origin||!origins.length||origins.includes(origin))cb(null,true);else cb(new Error('Origin không được phép.'),false);},credentials:true});
await app.register(multipart,{limits:{fileSize:25*1024*1024,files:1}});

app.addHook('onSend',async(request,reply,payload)=>{
  const pathname=String(request.url||'').split('?')[0];
  const noCache=['/', '/adm', '/teacher', '/student', '/index.html', '/vi.html', '/runtime-config.js', '/styles.css', '/enhancements.css'].includes(pathname)||pathname.startsWith('/src/')||pathname.startsWith('/specs/');
  if(pathname.startsWith('/api/'))reply.header('Cache-Control','no-store');
  if(noCache){
    reply.header('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    reply.header('Pragma','no-cache');reply.header('Expires','0');reply.header('Surrogate-Control','no-store');
  }
  return payload;
});

await app.register(fastifyStatic,{root:publicDir,prefix:'/',index:['index.html']});
await registerAuthRoutes(app);

app.get('/api/health',async()=>{let db=true;try{await pool.query('SELECT 1');}catch{db=false;}return {ok:db,backend:'vps',database:db,time:new Date().toISOString()};});
app.get('/api/public-settings',async()=>{
  const s=await getSettings();
  const [students,graded,exams]=await Promise.all([
    pool.query(`SELECT count(*)::int AS count FROM users WHERE role='student'`),
    pool.query(`SELECT count(*)::int AS count FROM attempts WHERE status='published'`),
    pool.query(`SELECT data FROM exams WHERE status='published'`),
  ]);
  const examTypes=[...new Set(exams.rows.map(row=>[row.data.provider,row.data.level].filter(Boolean).join(' ')).filter(Boolean))].sort();
  return {general:{systemName:s.general.systemName,organizationName:s.general.organizationName,publicUrl:s.general.publicUrl,logoUrl:s.general.logoUrl,faviconUrl:s.general.faviconUrl},theme:s.theme,auth:{googleLoginEnabled:s.auth.googleLoginEnabled,allowNewStudents:s.auth.allowNewStudents},operations:{maintenanceMode:s.operations.maintenanceMode,maintenanceMessage:s.operations.maintenanceMessage},stats:{students:students.rows[0].count,graded:graded.rows[0].count,exams:exams.rowCount,examTypes}};
});
app.get('/api/settings',async request=>{await requireRole(request,'master');return {settings:await getSettings()};});
app.get('/api/state',async request=>loadState(await requireUser(request)));
app.post('/api/commit',async request=>commitOperations(await requireUser(request),request.body?.operations||[]));
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
  const name=`${Date.now()}-${randomUUID()}${ext||defaultExt}`;
  const dest=path.join(uploadDir,name);let size=0;
  part.file.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)part.file.destroy(appError(413,`Tệp ${kind} vượt quá giới hạn cho phép.`));});
  try{await pipeline(part.file,createWriteStream(dest,{flags:'wx'}));}catch(error){await fs.rm(dest,{force:true});throw error;}
  if(part.file.truncated||size>maxBytes){await fs.rm(dest,{force:true});throw appError(413,`Tệp ${kind} vượt quá giới hạn cho phép.`);}
  app.log.info({user:user.id,file:name,kind},'media uploaded');return {url:`/uploads/${name}`};
}

app.post('/api/media/audio',async request=>saveUpload(request,{kind:'âm thanh',maxBytes:25*1024*1024,mimePrefix:'audio/',defaultExt:'.audio'}));
app.post('/api/media/image',async request=>saveUpload(request,{kind:'hình ảnh',maxBytes:8*1024*1024,mimePrefix:'image/',defaultExt:'.img'}));
app.post('/api/demo/media/audio',async request=>saveUpload(request,{kind:'âm thanh',maxBytes:25*1024*1024,mimePrefix:'audio/',defaultExt:'.audio'},demoUploadUser(request)));
app.post('/api/demo/media/image',async request=>saveUpload(request,{kind:'hình ảnh',maxBytes:8*1024*1024,mimePrefix:'image/',defaultExt:'.img'},demoUploadUser(request)));
app.get('/uploads/:name',async(request,reply)=>{if(!demoMediaUploadsEnabled)await requireUser(request);const name=path.basename(request.params.name);return reply.sendFile(name,uploadDir);});
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
app.setNotFoundHandler((request,reply)=>{if(request.url.startsWith('/api/'))return reply.code(404).send({error:'API không tồn tại.'});return reply.sendFile('vi.html');});

const port=Number(process.env.PORT||8080);
await app.listen({host:'0.0.0.0',port});
const stopMediaGc=startMediaGarbageCollector({uploadDir,logger:app.log});
let expiryBusy=false;
const expiryTimer=setInterval(async()=>{if(expiryBusy)return;expiryBusy=true;try{await submitExpiredAttempts();}catch(error){app.log.error(error);}finally{expiryBusy=false;}},1000);
expiryTimer.unref();
const stop=async()=>{try{stopMediaGc();await app.close();await pool.end();}finally{process.exit(0);}};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
