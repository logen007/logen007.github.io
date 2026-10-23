import {hasApiBackend} from './config.js';
import {optimizeExamImage} from './ui/image-optimize.js';
import {COURSE_IMAGE_MAX_BYTES} from './domain/media-limits.js';

const MAX_AUDIO_BYTES=25*1024*1024;
const MAX_IMAGE_BYTES=8*1024*1024;

export function validateAudioFile(file){
  if(!file)throw new Error('Chưa chọn tệp âm thanh.');
  if(file.size>MAX_AUDIO_BYTES)throw new Error('Tệp âm thanh tối đa 25 MB.');
  if(file.type&&!file.type.startsWith('audio/'))throw new Error('Tệp đã chọn không phải định dạng âm thanh.');
  return true;
}

export async function uploadQuestionAudio(file,{onProgress}={}){
  validateAudioFile(file);
  if(globalThis.G2G_DEMO_BYPASS)return postAudio('/api/demo/media/audio',file,{onProgress});
  if(!hasApiBackend())throw new Error('Không thể tải audio khi máy chủ chưa chạy.');
  return postAudio('/api/media/audio',file,{onProgress});
}

export function validateImageFile(file,limit=MAX_IMAGE_BYTES){
  if(!file)throw new Error('Chưa chọn hình ảnh.');
  if(file.size>limit)throw new Error(`Hình ảnh tối đa ${limit/1024/1024} MB.`);
  if(file.type&&!file.type.startsWith('image/'))throw new Error('Tệp đã chọn không phải hình ảnh.');
  return true;
}
export async function uploadQuestionImage(file,position={}){
  const course=position.scope==='course',limit=course?COURSE_IMAGE_MAX_BYTES:MAX_IMAGE_BYTES;
  validateImageFile(file,limit);
  file=await optimizeExamImage(file,position,{maxBytes:limit});
  const endpoint=course?'course-image':'image';
  if(globalThis.G2G_DEMO_BYPASS)return postMedia('/api/demo/media/'+endpoint,file);
  if(!hasApiBackend())throw new Error('Không thể tải hình ảnh khi máy chủ chưa chạy.');
  return postMedia('/api/media/'+endpoint,file);
}

export const uploadCourseImage=(file,position={})=>uploadQuestionImage(file,{...position,scope:'course'});

async function postAudio(url,file,{onProgress}={}){return postMedia(url,file,{onProgress});}

async function postMedia(url,file,{onProgress}={}){
  const form=new FormData();
  form.append('file',file,file.name||'audio');
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    request.open('POST',url);
    request.withCredentials=true;
    request.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(Math.round(event.loaded/event.total*100));};
    request.onerror=()=>reject(new Error('Không thể kết nối để tải tệp.'));
    request.onload=()=>{
      let data={};try{data=JSON.parse(request.responseText||'{}');}catch{}
      if(request.status<200||request.status>=300){reject(new Error(data?.error||'Không tải được tệp.'));return;}
      resolve(data.url);
    };
    request.send(form);
  });
}
