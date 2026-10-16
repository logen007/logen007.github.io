// Bound permission/playback waits: iOS may leave either promise pending during a call.
function deadline(promise,ms,late=()=>{}){
 let expired=false,timer;
 const bounded=Promise.resolve(promise).then(value=>{if(expired){late(value);return new Promise(()=>{});}return value;});
 return Promise.race([bounded,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Object.assign(Error('Thiết bị chưa phản hồi.'),{name:'TimeoutError'}));},ms);})]).finally(()=>clearTimeout(timer));
}
export const stopMedia=stream=>stream?.getTracks().forEach(track=>track.stop());
export function mediaAvailable(stream){
 const tracks=stream?.getTracks()||[];
 return ['audio','video'].every(kind=>tracks.some(t=>t.kind===kind&&t.readyState!=='ended'&&t.enabled!==false&&t.muted!==true));
}
export async function acquirePreview(video,{mediaDevices=globalThis.navigator?.mediaDevices,permissionMs=15000,playMs=8000}={}){
 if(!mediaDevices?.getUserMedia)throw Object.assign(Error('Trình duyệt không hỗ trợ camera/micro.'),{name:'NotSupportedError'});
 const stream=await deadline(mediaDevices.getUserMedia({audio:true,video:{facingMode:'user',width:{ideal:720},height:{ideal:1280},aspectRatio:{ideal:9/16}}}),permissionMs,stopMedia);
 try{
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.srcObject=stream;
  await deadline(video.play(),playMs);
  if(!mediaAvailable(stream))throw Object.assign(Error('Camera/micro đang tạm ngừng.'),{name:'DeviceInterruptedError'});
  return stream;
 }catch(error){stopMedia(stream);video.srcObject=null;throw error;}
}
export function mediaErrorText(error){
 if(['NotAllowedError','PermissionDeniedError'].includes(error.name))return 'Chưa được cấp quyền camera/micro. Mở quyền của trang trong trình duyệt, chọn Cho phép rồi thử lại.';
 if(error.name==='NotFoundError')return 'Không tìm thấy đủ camera và micro trên thiết bị này.';
 if(error.name==='NotSupportedError')return 'Trình duyệt chưa hỗ trợ kiểm tra thiết bị. Hãy mở bằng Safari trên iPhone hoặc Chrome trên Android.';
 return 'Chưa nhận được hình/tiếng. Hãy kết thúc cuộc gọi điện thoại/Zalo, đóng ứng dụng đang dùng camera hoặc micro, rồi bấm Kiểm tra lại. Nếu vẫn lỗi trên iPhone, đóng tab này và mở link bằng Safari.';
}
export function recordSample(stream,{Recorder=globalThis.MediaRecorder,durationMs=3000,waitMs=4000,onRecorder=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  let recorder,stopTimer,watchdog,settled=false;
  const finish=(error,blob)=>{
   if(settled)return;settled=true;clearTimeout(stopTimer);clearTimeout(watchdog);
   if(recorder){recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;if(recorder.state==='recording')try{recorder.stop();}catch{}}
   error?reject(error):resolve(blob);
  };
  try{
   if(!mediaAvailable(stream))throw Error('Camera/micro đang tạm ngừng.');
   if(!Recorder)throw Object.assign(Error('Trình duyệt không hỗ trợ thu thử.'),{name:'NotSupportedError'});
   const chunks=[],type=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>Recorder.isTypeSupported?.(t));
   recorder=new Recorder(new MediaStream(stream.getAudioTracks()),type?{mimeType:type}:undefined);onRecorder(recorder);
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>finish(Error('Thu thử thất bại.'));
   recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||type||''});finish(blob.size&&mediaAvailable(stream)?null:Error('Không nhận được dữ liệu âm thanh.'),blob);};
   recorder.start();stopTimer=setTimeout(()=>{try{if(recorder.state==='recording')recorder.stop();}catch(e){finish(e);}},durationMs);
   watchdog=setTimeout(()=>finish(Object.assign(Error('Thu thử không phản hồi.'),{name:'TimeoutError'})),durationMs+waitMs);
  }catch(error){finish(error);}
 });
}
