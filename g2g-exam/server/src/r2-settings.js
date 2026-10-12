import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {configureR2Media} from './r2-media.js';

const envConfig=env=>({enabled:env.R2_MEDIA_ENABLED==='true',account:env.R2_ACCOUNT_ID||'',bucket:env.R2_BUCKET||'',accessKeyId:env.R2_ACCESS_KEY_ID||'',secretAccessKey:env.R2_SECRET_ACCESS_KEY||''});
const asEnv=c=>({R2_MEDIA_ENABLED:String(c.enabled),R2_ACCOUNT_ID:c.account,R2_BUCKET:c.bucket,R2_ACCESS_KEY_ID:c.accessKeyId,R2_SECRET_ACCESS_KEY:c.secretAccessKey});
const publicConfig=c=>({enabled:c.enabled,account:c.account,bucket:c.bucket,credentialsConfigured:Boolean(c.accessKeyId&&c.secretAccessKey)});
export function normalizeR2Config(input,previous={}){
  if(typeof input.enabled!=='boolean')throw appError(400,'Trạng thái R2 không hợp lệ.');
  const c={enabled:input.enabled};
  for(const key of ['account','bucket','accessKeyId','secretAccessKey']){
    if(input[key]!==undefined&&typeof input[key]!=='string')throw appError(400,'Thông tin R2 không hợp lệ.');
    c[key]=(input[key]||'').trim();
    if(c[key].length>256)throw appError(400,'Thông tin R2 quá dài.');
  }
  if(c.account&&!/^[a-f0-9]{32}$/.test(c.account))throw appError(400,'Account ID phải gồm 32 ký tự hex.');
  if(c.bucket&&!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.bucket))throw appError(400,'Tên bucket gồm 3–63 chữ thường, số hoặc dấu gạch ngang.');
  if(Boolean(c.accessKeyId)!==Boolean(c.secretAccessKey))throw appError(400,'Nhập đầy đủ cả hai khóa để thay khóa kết nối.');
  if(!c.accessKeyId&&c.account===previous.account){c.accessKeyId=previous.accessKeyId||'';c.secretAccessKey=previous.secretAccessKey||'';}
  if(c.enabled&&(!c.account||!c.bucket||!c.accessKeyId||!c.secretAccessKey))throw appError(400,'Điền đầy đủ thông tin trước khi bật R2.');
  return c;
}

// Read-only probe: never creates a bucket or changes its public access/CORS policy.
export async function checkR2Connection(c){
  normalizeR2Config({...c,enabled:true});
  const {S3Client,HeadBucketCommand}=await import('@aws-sdk/client-s3');
  const client=new S3Client({region:'auto',endpoint:`https://${c.account}.r2.cloudflarestorage.com`,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey},maxAttempts:1});
  try{await client.send(new HeadBucketCommand({Bucket:c.bucket}),{abortSignal:AbortSignal.timeout(10000)});}
  catch{throw appError(400,'Không kết nối được R2. Kiểm tra Account ID, bucket, quyền truy cập và cặp khóa.');}
  finally{client.destroy();}
}

export function createR2Settings({db=query,env=process.env,check=checkR2Connection,configure=configureR2Media}={}){
  let active=null,options=null,queue=Promise.resolve();
  const runtime={get enabled(){return Boolean(active);},source:name=>active?.source(name)??null,stop(){active?.stop();active=null;}};
  async function read(){
    const result=await db("SELECT value_enc FROM secrets WHERE key='r2_media_config'");
    return result.rowCount?JSON.parse(decrypt(result.rows[0].value_enc)):envConfig(env);
  }
  async function apply(c){
    if(!options)return;
    const next=await configure({...options,env:asEnv(c)});
    const previous=active;active=next;previous?.stop();
  }
  function admin(user){if(user?.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được cấu hình R2.');}
  async function action(user,name,input={}){
    admin(user);
    if(name==='getR2Settings')return publicConfig(await read());
    if(!['saveR2Settings','testR2Settings'].includes(name))throw appError(404,'Thao tác không tồn tại.');
    const run=async()=>{
      const config=normalizeR2Config(input,await read());
      if(name==='testR2Settings'||config.enabled)await check({...config,enabled:true});
      if(name==='testR2Settings')return {message:'Kết nối bucket thành công. Cần quyền Object Read & Write và CORS để tải ảnh/audio trên web.'};
      await db("INSERT INTO secrets(key,value_enc,updated_by) VALUES('r2_media_config',$1,$2) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now(),updated_by=EXCLUDED.updated_by",[encrypt(JSON.stringify(config)),user.id]);
      try{await apply(config);}catch{runtime.stop();throw appError(503,'Đã lưu cấu hình nhưng chưa khởi chạy được R2. VPS vẫn hoạt động; hãy lưu lại để thử lại.');}
      return publicConfig(config);
    };
    // Serializes credential rotation and runtime replacement; media requests never read SQL.
    const pending=queue.then(run);queue=pending.catch(()=>{});return pending;
  }
  return {runtime,action,async start(opts){options=opts;try{await apply(await read());}catch{opts.logger?.warn('R2 settings unavailable; serving VPS media.');}return runtime;}};
}
export const r2Settings=createR2Settings();
