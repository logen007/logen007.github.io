import {hasApiBackend} from './config.js';

const MAX_AUDIO_BYTES=25*1024*1024;
const MAX_LOCAL_AUDIO_BYTES=1.5*1024*1024;

export function validateAudioFile(file){
  if(!file)throw new Error('Chưa chọn tệp âm thanh.');
  if(file.size>MAX_AUDIO_BYTES)throw new Error('Tệp âm thanh tối đa 25 MB.');
  if(file.type&&!file.type.startsWith('audio/'))throw new Error('Tệp đã chọn không phải định dạng âm thanh.');
  return true;
}

export async function uploadQuestionAudio(file){
  validateAudioFile(file);
  if(!hasApiBackend()){
    if(file.size>MAX_LOCAL_AUDIO_BYTES)throw new Error('Bản demo cục bộ chỉ lưu được audio nhỏ hơn 1,5 MB.');
    return asDataUrl(file);
  }
  const form=new FormData();
  form.append('file',file,file.name||'audio');
  const res=await fetch('/api/media/audio',{method:'POST',body:form,credentials:'include'});
  let data={};
  try{data=await res.json();}catch{}
  if(!res.ok)throw new Error(data?.error||'Không tải được tệp âm thanh.');
  return data.url;
}

function asDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Không đọc được tệp âm thanh.'));
    reader.readAsDataURL(file);
  });
}
