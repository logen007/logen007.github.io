import {hasApiBackend} from './config.js';

const MAX_AUDIO_BYTES=25*1024*1024;
const MAX_IMAGE_BYTES=8*1024*1024;

export function validateAudioFile(file){
  if(!file)throw new Error('Chưa chọn tệp âm thanh.');
  if(file.size>MAX_AUDIO_BYTES)throw new Error('Tệp âm thanh tối đa 25 MB.');
  if(file.type&&!file.type.startsWith('audio/'))throw new Error('Tệp đã chọn không phải định dạng âm thanh.');
  return true;
}

export async function uploadQuestionAudio(file){
  validateAudioFile(file);
  if(globalThis.G2G_DEMO_BYPASS)return postAudio('/api/demo/media/audio',file);
  if(!hasApiBackend())throw new Error('Không thể tải audio khi máy chủ chưa chạy.');
  return postAudio('/api/media/audio',file);
}

export async function uploadQuestionImage(file){
  if(!file)throw new Error('Chưa chọn hình ảnh.');
  if(file.size>MAX_IMAGE_BYTES)throw new Error('Hình ảnh tối đa 8 MB.');
  if(file.type&&!file.type.startsWith('image/'))throw new Error('Tệp đã chọn không phải hình ảnh.');
  if(globalThis.G2G_DEMO_BYPASS)return postMedia('/api/demo/media/image',file);
  if(!hasApiBackend())throw new Error('Không thể tải hình ảnh khi máy chủ chưa chạy.');
  return postMedia('/api/media/image',file);
}

async function postAudio(url,file){return postMedia(url,file);}

async function postMedia(url,file){
  const form=new FormData();
  form.append('file',file,file.name||'audio');
  const res=await fetch(url,{method:'POST',body:form,credentials:'include'});
  let data={};
  try{data=await res.json();}catch{}
  if(!res.ok)throw new Error(data?.error||'Không tải được tệp âm thanh.');
  return data.url;
}
