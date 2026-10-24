import crypto from 'node:crypto';
import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';

const KEY='speaking_lab_100ms';
export async function readHmsConfig(client={query}){
 const r=await client.query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);
 return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):null;
}
export function hmsToken(config,claims={}){
 const seconds=Math.floor(Date.now()/1000);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const payload={access_key:config.accessKey,type:'management',version:2,iat:seconds,nbf:seconds-5,exp:seconds+3600,jti:crypto.randomUUID(),...claims};
 const body=encode({alg:'HS256',typ:'JWT'})+'.'+encode(payload);
 return body+'.'+crypto.createHmac('sha256',config.appSecret).update(body).digest('base64url');
}
export async function hmsRequest(config,path,{method='GET',body,missing=false}={}){
 if(!config)throw appError(503,'Chưa kết nối 100ms. Quản trị viên cần mở Cài đặt trong Thi Nói thử nghiệm.');
 let r;
 try{r=await fetch('https://api.100ms.live/v2/'+path,{method,headers:{Authorization:'Bearer '+hmsToken(config),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});}
 catch{throw Object.assign(appError(502,'Không kết nối được 100ms.'),{providerOperation:method+' '+path,providerRetryable:method==='GET'});}
 if(missing&&r.status===404)return null;
 if(!r.ok)throw Object.assign(appError(502,`100ms trả lỗi ${r.status}. Kiểm tra khóa, template, quyền và cấu hình ghi hình trên 100ms.`),{providerStatus:r.status,providerOperation:method+' '+path,providerRetryable:method==='GET'&&(r.status===429||r.status>=500)});
 return r.status===204?{}:r.json();
}
export async function saveHmsConfig(input,user,client={query}){
 const previous=await readHmsConfig(client);
 const config={accessKey:String(input.accessKey||previous?.accessKey||'').trim(),appSecret:String(input.appSecret||previous?.appSecret||'').trim(),templateId:String(input.templateId||'').trim(),role:String(input.role||'').trim()};
 if(!/^[a-zA-Z0-9_-]{8,128}$/.test(config.accessKey)||config.appSecret.length<16||config.appSecret.length>1024||!/^[a-zA-Z0-9_-]{8,128}$/.test(config.templateId)||!/^[a-zA-Z0-9_-]{1,64}$/.test(config.role))throw appError(400,'Điền Access Key, App Secret, Template ID và tên vai trò hợp lệ.');
 const template=await hmsRequest(config,'templates/'+encodeURIComponent(config.templateId));
 const role=template.roles?.[config.role];
 if(!role)throw appError(400,'Không tìm thấy vai trò này trong template 100ms.');
 if(Object.values(role.permissions||{}).some(value=>value===true))throw appError(400,'Vai trò thí sinh không được có quyền quản trị/ghi hình. Hãy tắt các quyền trong mục Permissions của vai trò.');
 if(!role.publishParams?.allowed?.includes('audio')||!role.publishParams?.allowed?.includes('video')||!role.subscribeParams?.subscribeToRoles?.includes(config.role))throw appError(400,'Vai trò phải được gửi camera/micro và nhận hình/tiếng của cùng vai trò.');
 const recordings=await hmsRequest(config,'templates/'+encodeURIComponent(config.templateId)+'/recordings');
 const rec=Array.isArray(recordings)&&recordings.length===1?recordings[0]:null;
 if(!rec?.compositeRecording?.browserComposite?.enabled||rec.compositeRecording.browserComposite.autoStart||rec.trackRecording?.enabled||rec.streamRecording?.enabled||rec.compositeRecording.customComposite?.enabled||Number(rec.maxDuration)<3600)throw appError(400,'Template cần đúng một Room composite recording, giới hạn ít nhất 3600 giây; tắt auto-start, track/stream recording và custom composite.');
 config.recordingDestination=rec.name;
 await client.query(`INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_by=EXCLUDED.updated_by,updated_at=now()`,[KEY,encrypt(JSON.stringify(config)),user.id]);
 return {configured:true,templateId:config.templateId,role:config.role};
}
export async function hmsPresence(config,roomId,members){
 const result=await hmsRequest(config,`active-rooms/${roomId}/peers`,{missing:true});
 const peers=Object.values(result?.peers||{});
 const detail=await Promise.all(peers.filter(p=>members.some(m=>m.id===p.user_id)).map(p=>hmsRequest(config,`active-rooms/${roomId}/peers/${encodeURIComponent(p.id)}`,{missing:true})));
 return members.map(member=>{
  const matches=detail.filter(p=>p?.user_id===member.id);
  const tracks=Object.values(matches[0]?.tracks||{});
  return {id:member.id,connected:matches.length===1,devices:matches.length,audio:matches.length===1&&tracks.some(t=>t.type==='audio'&&t.source==='regular'&&t.mute===false),video:matches.length===1&&tracks.some(t=>t.type==='video'&&t.source==='regular'&&t.mute===false)};
 });
}
