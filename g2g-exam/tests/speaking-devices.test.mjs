import assert from 'node:assert/strict';
import {acquirePreview,mediaAvailable,mediaErrorText,recordSample} from '../src/speaking/devices.js';
const never=()=>new Promise(()=>{}),stream=()=>{const tracks=['audio','video'].map(kind=>({kind,readyState:'live',enabled:true,muted:false,stop(){this.readyState='ended';}}));return {getTracks:()=>tracks,getAudioTracks:()=>[tracks[0]]};};
const video=play=>({play,srcObject:null});
await assert.rejects(acquirePreview(video(never),{mediaDevices:{}}),e=>e.name==='NotSupportedError');
for(const name of ['NotAllowedError','PermissionDeniedError','NotFoundError','NotReadableError']){
 const denied=Object.assign(Error('synthetic device rejection'),{name}),target=video(()=>{throw Error('Must not play after permission failure');});
 await assert.rejects(acquirePreview(target,{mediaDevices:{getUserMedia:async()=>{throw denied;}}}),e=>e===denied);
 assert.equal(target.srcObject,null);
 assert.match(mediaErrorText(denied),name==='NotFoundError'?/Không tìm thấy/:name==='NotReadableError'?/ứng dụng đang dùng/:/cấp quyền/);
}
for(const kind of ['audio','video'])for(const property of ['enabled','muted','readyState']){
 const interrupted=stream(),target=video(async()=>{});
 interrupted.getTracks().find(track=>track.kind===kind)[property]=property==='enabled'?false:property==='muted'?true:'ended';
 assert.equal(mediaAvailable(interrupted),false);
 await assert.rejects(acquirePreview(target,{mediaDevices:{getUserMedia:async()=>interrupted}}),e=>e.name==='DeviceInterruptedError');
 assert.equal(target.srcObject,null);assert.ok(interrupted.getTracks().every(track=>track.readyState==='ended'));
}
const rejectedStream=stream(),rejectedVideo=video(async()=>{throw Error('preview playback denied');});
await assert.rejects(acquirePreview(rejectedVideo,{mediaDevices:{getUserMedia:async()=>rejectedStream}}),/preview playback denied/);
assert.equal(rejectedVideo.srcObject,null);assert.ok(rejectedStream.getTracks().every(track=>track.readyState==='ended'));
assert.equal(mediaAvailable({getTracks:()=>[]}),false);
assert.equal(mediaAvailable({getTracks:()=>[{kind:'audio',readyState:'live'}]}),false);
await assert.rejects(acquirePreview(video(never),{mediaDevices:{getUserMedia:never},permissionMs:5}),e=>e.name==='TimeoutError');
let resolveLate;const late=stream();
await assert.rejects(acquirePreview(video(never),{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolveLate=resolve;})},permissionMs:5}));
resolveLate(late);await new Promise(resolve=>setImmediate(resolve));assert.ok(late.getTracks().every(t=>t.readyState==='ended'),'Timed-out requests must release streams that resolve late');
const pending=stream(),v=video(never);await assert.rejects(acquirePreview(v,{mediaDevices:{getUserMedia:async()=>pending},playMs:5}));assert.equal(v.srcObject,null);assert.ok(pending.getTracks().every(t=>t.readyState==='ended'));
const muted=stream();muted.getAudioTracks()[0].muted=true;assert.equal(mediaAvailable(muted),false);await assert.rejects(acquirePreview(video(async()=>{}),{mediaDevices:{getUserMedia:async()=>muted}}),e=>e.name==='DeviceInterruptedError');
const live=stream(),preview=video(async()=>{});assert.equal(await acquirePreview(preview,{mediaDevices:{getUserMedia:async()=>live}}),live);assert.equal(preview.muted,true);assert.equal(preview.playsInline,true);
assert.match(mediaErrorText({name:'TimeoutError'}),/kết thúc cuộc gọi/);assert.match(mediaErrorText({name:'NotAllowedError'}),/cấp quyền/);
const original=globalThis.MediaStream;globalThis.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
try{
 class Recorder{static isTypeSupported(t){return t==='audio/mp4';}constructor(_,options){assert.equal(options.mimeType,'audio/mp4');this.state='inactive';this.mimeType=options.mimeType;}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['sound'])});this.onstop?.();}}
 const blob=await recordSample(live,{Recorder,durationMs:5,waitMs:10});assert.equal(blob.type,'audio/mp4');assert.ok(blob.size);
 class Broken{constructor(){throw Error('busy');}}await assert.rejects(recordSample(live,{Recorder:Broken}),/busy/);
 class Stalled{constructor(){this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';}}
 await assert.rejects(recordSample(live,{Recorder:Stalled,durationMs:5,waitMs:5}),e=>e.name==='TimeoutError');
 class Empty extends Recorder{stop(){this.state='inactive';this.onstop?.();}}await assert.rejects(recordSample(live,{Recorder:Empty,durationMs:5}),/Không nhận được dữ liệu/);
 const ended=stream();
 class Interrupted extends Recorder{stop(){ended.getAudioTracks()[0].readyState='ended';super.stop();}}
 await assert.rejects(recordSample(ended,{Recorder:Interrupted,durationMs:5}),/Không nhận được dữ liệu/);
 let faulty;
 class Faulty extends Recorder{constructor(...args){super(...args);faulty=this;}start(){super.start();queueMicrotask(()=>this.onerror?.());}}
 await assert.rejects(recordSample(live,{Recorder:Faulty,durationMs:1000}),/Thu thử thất bại/);
 assert.equal(faulty.state,'inactive');
 for(const handler of ['ondataavailable','onstop','onerror'])assert.equal(faulty[handler],null);
}finally{if(original===undefined)delete globalThis.MediaStream;else globalThis.MediaStream=original;}
console.log('Speaking devices: bounded permission/play waits, late stream cleanup, muted input, inline preview, MP4 samples, constructor failure, stalled recorder and empty recording passed.');
console.log('Device negatives: denied/missing/busy devices, disabled/muted/ended tracks, rejected preview, interrupted sample and recorder cleanup passed.');
