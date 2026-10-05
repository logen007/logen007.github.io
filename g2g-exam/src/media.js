import { isFirebaseConfigured, APP_CONFIG } from './config.js';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function validateAudioFile(file){
  if(!file) throw new Error('Chưa chọn tệp âm thanh.');
  if(file.size > MAX_AUDIO_BYTES) throw new Error('Tệp âm thanh tối đa 25 MB.');
  if(file.type && !file.type.startsWith('audio/')) throw new Error('Tệp đã chọn không phải định dạng âm thanh.');
  return true;
}

export async function uploadQuestionAudio(file,userId='teacher',questionId='draft'){
  validateAudioFile(file);
  if(!isFirebaseConfigured()){
    if(file.size > 1.5 * 1024 * 1024) throw new Error('Chế độ thử nghiệm chỉ lưu được audio nhỏ hơn 1,5 MB. Khi dùng Firebase có thể tải tệp đến 25 MB.');
    return await asDataUrl(file);
  }
  const [{getApps,getApp,initializeApp},{getStorage,ref,uploadBytes,getDownloadURL}] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js')
  ]);
  const app=getApps().length?getApp():initializeApp(APP_CONFIG.firebaseConfig());
  const storage=getStorage(app);
  const safeName=(file.name||'audio').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-120);
  const path=`question-audio/${userId}/${questionId}/${Date.now()}-${safeName}`;
  const objectRef=ref(storage,path);
  await uploadBytes(objectRef,file,{contentType:file.type||'audio/mpeg',customMetadata:{questionId,StringUserId:String(userId)}});
  return await getDownloadURL(objectRef);
}

function asDataUrl(file){
  return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=()=>reject(new Error('Không đọc được tệp âm thanh.')); r.readAsDataURL(file); });
}
