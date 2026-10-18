import {createReadStream,createWriteStream} from 'node:fs';
import {mkdtemp,rm,statfs,readdir,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {getBackupDriveAccess} from './backup-google.js';
import {readHmsConfig,hmsRequest} from './speaking-hms.js';
import {appError} from './db.js';

const API='https://www.googleapis.com/drive/v3',MAX=2*1024**3;
const fields='id,size,md5Checksum,mimeType,trashed,appProperties';
export async function cleanupAbandonedRecordingTemps(){
 for(const entry of await readdir(tmpdir(),{withFileTypes:true})){
  if(!entry.isDirectory()||!/^g2g-speaking-video-[A-Za-z0-9]{6}$/.test(entry.name))continue;
  const filename=path.join(tmpdir(),entry.name),info=await lstat(filename);
  if(info.isDirectory()&&Date.now()-info.mtimeMs>2*3600000)await rm(filename,{recursive:true,force:true});
 }
}
export async function driveJson(access,url,body){
 const response=await fetch(API+url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 if(response.status===404)return null;
 if(!response.ok)throw appError(503,'Không truy cập được Google Drive. Kiểm tra kết nối và dung lượng trống.');
 return response.json();
}
export async function generateRecordingFileId(){
 const access=await getBackupDriveAccess(),result=await driveJson(access,'/files/generateIds?count=1&space=drive&type=files');
 if(!result?.ids?.[0])throw appError(503,'Không tạo được mã video trên Drive.');
 return result.ids[0];
}
// Explicit admin deletion only; transfer/retry paths must never call this.
export async function deleteDriveRecordings(sessionId,archive={},checkReferences=async()=>{}){
 const access=await getBackupDriveAccess(),files=new Map();
 if(archive.fileId){
  const file=await driveJson(access,'/files/'+encodeURIComponent(archive.fileId)+'?fields=id,appProperties');
  if(file)files.set(file.id,file);
 }
 const q="appProperties has { key='speakingSession' and value='"+sessionId.replace(/'/g,"\\'")+"' }";
 let pageToken;
 do{
  const result=await driveJson(access,'/files?q='+encodeURIComponent(q)+'&fields=nextPageToken,files(id,appProperties)&pageSize=100'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));
  if(!result)throw appError(503,'Chưa kiểm tra được các bản ghi trên Drive.');
  for(const file of result.files||[])files.set(file.id,file);
  pageToken=result.nextPageToken;
 }while(pageToken);
 // Verify every target before deleting any file; never trust a client-supplied ID.
 for(const file of files.values())if(file.appProperties?.speakingSession!==sessionId)throw appError(409,'File Drive không thuộc ca này. Chưa xóa dữ liệu.');
 await checkReferences([...files.keys()]);
 for(const file of files.values()){
  const response=await fetch(API+'/files/'+encodeURIComponent(file.id),{method:'DELETE',headers:{Authorization:'Bearer '+access.token},signal:AbortSignal.timeout(30000)});
  if(!response.ok&&response.status!==404)throw appError(503,'Chưa xóa hết video trên Drive. Ca vẫn được giữ để thử lại.');
  await response.body?.cancel();
 }
 return files.size;
}
function verified(file,job){return file&&!file.trashed&&file.mimeType==='video/mp4'&&file.appProperties?.speakingSession===job.id&&Number(file.size)===job.archive.size&&file.md5Checksum===job.archive.md5;}
async function recordingFolder(access){
 const q="'"+access.folderId.replace(/'/g,"\\'")+"' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Video thi nói'";
 const result=await driveJson(access,'/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=10');
 if(result?.files?.length)return result.files[0].id;
 const folder=await driveJson(access,'/files?fields=id',{name:'Video thi nói',mimeType:'application/vnd.google-apps.folder',parents:[access.folderId]});
 if(!folder?.id)throw appError(503,'Không tạo được thư mục video thi nói.');return folder.id;
}
export async function archiveRecording(job,saveChecksum){
 const access=await getBackupDriveAccess();
 const existing=await driveJson(access,'/files/'+encodeURIComponent(job.archive.fileId)+'?fields='+fields);
 if(existing){if(verified(existing,job))return;throw appError(409,'Video trên Drive chưa khớp bản gốc. Cần quản trị viên kiểm tra.');}
 const folder=await recordingFolder(access),config=await readHmsConfig();
 if(!config)throw appError(503,'Chưa kết nối 100ms để tải bản ghi.');
 const source=await hmsRequest(config,'recording-assets/'+encodeURIComponent(job.assetId)+'/presigned-url?presign_duration=900');
 const url=new URL(source.url||'');
 // The URL comes only from the signed 100ms management API, never client input.
 if(url.protocol!=='https:'||url.username||url.password)throw appError(502,'Liên kết bản ghi không hợp lệ.');
 let directory;
 try{
  directory=await mkdtemp(path.join(tmpdir(),'g2g-speaking-video-'));const filename=path.join(directory,'recording.mp4');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15*60000)});
  if(!response.ok||!response.body)throw appError(503,'Không tải được bản ghi từ 100ms.');
  const expected=Number(response.headers.get('content-length')||0),space=await statfs(directory);
  if(expected>MAX||expected>space.bavail*space.bsize-256*1024**2){await response.body.cancel();throw appError(507,'Không đủ dung lượng tạm để chuyển video.');}
  let size=0;const md5=crypto.createHash('md5');
  const meter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>MAX)return callback(appError(413,'Video vượt giới hạn chuyển 2 GB.'));md5.update(chunk);callback(null,chunk);}});
  await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(filename,{flags:'wx',mode:0o600}));
  if(!size||expected&&size!==expected)throw appError(502,'Bản ghi tải về chưa đầy đủ.');
  job.archive.size=size;job.archive.md5=md5.digest('hex');await saveChecksum(job.archive);
  const init=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields='+fields,{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},body:JSON.stringify({id:job.archive.fileId,name:'Thi-noi-'+job.id+'.mp4',mimeType:'video/mp4',parents:[folder],appProperties:{speakingSession:job.id}}),signal:AbortSignal.timeout(30000)});
  const location=init.headers.get('location');
  if(!init.ok||!location||new URL(location).origin!=='https://www.googleapis.com')throw appError(503,'Không khởi tạo được tải video lên Drive.');
  const upload=await fetch(location,{method:'PUT',headers:{Authorization:'Bearer '+access.token,'Content-Length':String(size),'Content-Type':'video/mp4'},body:createReadStream(filename),duplex:'half',signal:AbortSignal.timeout(15*60000)});
  if(!upload.ok)throw appError(503,'Tải video lên Drive chưa thành công. Hệ thống sẽ thử lại.');
  await upload.body?.cancel();
  if(!verified(await driveJson(access,'/files/'+encodeURIComponent(job.archive.fileId)+'?fields='+fields),job))throw appError(502,'Chưa xác nhận được toàn vẹn video trên Drive.');
 }finally{if(directory)await rm(directory,{recursive:true,force:true});}
}
export async function streamDriveRecording(fileId,request,reply){
 const access=await getBackupDriveAccess(),range=request.headers.range;
 if(range&&!/^bytes=\d*-\d*$/.test(range))throw appError(416,'Khoảng video không hợp lệ.');
 const response=await fetch(API+'/files/'+encodeURIComponent(fileId)+'?alt=media',{headers:{Authorization:'Bearer '+access.token,...(range?{Range:range}:{})},signal:AbortSignal.timeout(120000)});
 if(![200,206].includes(response.status)||!response.body){await response.body?.cancel();throw appError(503,'Chưa mở được video từ Drive.');}
 reply.code(response.status).header('Content-Type','video/mp4').header('Cache-Control','private, no-store');
 for(const name of ['content-length','content-range','accept-ranges'])if(response.headers.has(name))reply.header(name,response.headers.get(name));
 return reply.send(Readable.fromWeb(response.body));
}
