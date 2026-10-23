// Synthetic codec/transport fixtures; not browser image-decoding evidence.
import assert from 'node:assert/strict';
import {uploadCourseImage,uploadQuestionImage} from '../src/media.js';
import {COURSE_IMAGE_MAX_BYTES as limit} from '../src/domain/media-limits.js';
const names=['Image','document','XMLHttpRequest','G2G_API_BASE','G2G_DEMO_BYPASS'],previous=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
let encodedSize=limit,decoded=0;const sent=[];
try{
  globalThis.G2G_API_BASE='/api';globalThis.G2G_DEMO_BYPASS=false;
  globalThis.Image=class{naturalWidth=640;naturalHeight=480;set src(value){decoded++;queueMicrotask(()=>this.onload());}};
  globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return {getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob([new Uint8Array(encodedSize)],{type:'image/jpeg'}))};}};
  globalThis.XMLHttpRequest=class{
    upload={};open(method,url){assert.equal(method,'POST');this.url=url;}
    send(form){sent.push({url:this.url,file:form.get('file')});this.status=200;this.responseText=JSON.stringify({url:'/uploads/fixture.jpg'});queueMicrotask(()=>this.onload());}
  };
  const image=size=>new File([new Uint8Array(size)],'fixture.png',{type:'image/png'});
  await assert.rejects(uploadCourseImage(image(limit+1)),/1 MB/);assert.equal(decoded,0,'Original limit is enforced before decoding');assert.equal(sent.length,0);
  assert.equal(await uploadCourseImage(image(limit)),'/uploads/fixture.jpg');assert.equal(sent.at(-1).url,'/api/media/course-image');assert.equal(sent.at(-1).file.size,limit);
  encodedSize=limit+1;await assert.rejects(uploadCourseImage(image(100)),/sau tối ưu vượt 1 MB/);assert.equal(sent.length,1,'Oversized encoded output never reaches upload');
  await uploadQuestionImage(image(limit+1));assert.equal(sent.at(-1).url,'/api/media/image');assert.equal(sent.at(-1).file.size,limit+1,'Exam limit is not reduced');
}finally{for(const [name,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
console.log('Course image limits: original/encoded 1 MB boundary, course endpoint and unchanged exam uploads passed.');
