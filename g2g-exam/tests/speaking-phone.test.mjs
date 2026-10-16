// DOM-only check: no real browser, camera, microphone or external requests.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const dom=new JSDOM('<main id="speaking-app"></main>',{url:'https://g2g.test/speaking-lab.html?session=12345678-1234-1234-1234-123456789abc',pretendToBeVisual:true});
const globals=['window','document','location','navigator','fetch','MediaRecorder','MediaStream','localStorage'];
const previous=new Map(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
const set=(k,value)=>Object.defineProperty(globalThis,k,{configurable:true,writable:true,value});
for(const k of ['window','document','location','navigator','localStorage'])set(k,dom.window[k]);
Object.defineProperty(dom.window.navigator,'userAgent',{value:'Mozilla iPhone Safari'});
dom.window.HTMLMediaElement.prototype.play=async()=>{};
let stopCount=0,connected=false,latestRecorder,joinCalls=0,leaveCalls=0;
const tracks=[{kind:'audio',stop(){stopCount++;},addEventListener(){}},{kind:'video',stop(){stopCount++;},addEventListener(){}}];
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>tracks,getAudioTracks:()=>[tracks[0]]})}});
set('MediaStream',class{constructor(tracks){this.tracks=tracks;}});
set('MediaRecorder',class{constructor(){latestRecorder=this;this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['sample'])});this.onstop?.();}});
let state={id:'12345678-1234-1234-1234-123456789abc',title:'G2G trial',seat:'A',participant:true,state:'waiting',members:[{id:'a',seat:'A',name:'A',ready:false},{id:'b',seat:'B',name:'B',ready:false}],serverNow:Date.now(),stageCount:1};
set('fetch',async(url,options={})=>{
 let data;
 if(url==='/api/auth/me')data={user:{id:'a',email:'a@test.example',name:'A'}};
 else if(url==='/api/public-settings')data={theme:{primaryColor:'#175CD3'}};
 else if(url.endsWith('/join'))data={token:'app-token',name:'A'};
 else if(url.endsWith('/ready')){assert.equal(JSON.parse(options.body).consent,true);state.members[0].ready=true;data=state;}
 else if(url.endsWith('/next'))data={};
 else if(url.startsWith('/api/speaking-lab/sessions/'))data=state;
 else throw Error('Unexpected URL '+url);
 return {ok:true,json:async()=>structuredClone(data)};
});
const subscribers=[],store={subscribe(fn,selector){const entry={fn,selector};subscribers.push(entry);fn(selector());return ()=>{const i=subscribers.indexOf(entry);if(i>=0)subscribers.splice(i,1);};},getState:selector=>selector()};
const publish=()=>subscribers.forEach(x=>x.fn(x.selector()));
const actions={join:async()=>{joinCalls++;connected=true;publish();},leave:async()=>{leaveCalls++;connected=false;publish();},attachVideo:async()=>{},detachVideo:async()=>{},setLocalAudioEnabled:async()=>{},setLocalVideoEnabled:async()=>{}};
globalThis.__hmsMock={HMSReactiveStore:class{getActions(){return actions;}getStore(){return store;}triggerOnSubscribe(){}},selectPeers:()=>connected?[{id:'pa',customerUserId:'a',name:'A',isLocal:true,videoTrack:'va'},{id:'pb',customerUserId:'b',name:'B',videoTrack:'vb'}]:[],selectIsConnectedToRoom:()=>connected,selectIsLocalAudioEnabled:()=>true,selectIsLocalVideoEnabled:()=>true};
const hook=registerHooks({resolve(specifier,ctx,next){if(specifier==='@100mslive/hms-video-store')return {shortCircuit:true,url:'data:text/javascript,export const {HMSReactiveStore,selectPeers,selectIsConnectedToRoom,selectIsLocalAudioEnabled,selectIsLocalVideoEnabled}=globalThis.__hmsMock;'};return next(specifier,ctx);}});
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const el=s=>document.querySelector(s);
try{
 await import('../src/speaking/phone.js');await settle();
 assert.equal(el('[data-join]').disabled,true);
 el('[data-check]').click();await settle();assert.equal(el('[data-record]').disabled,false);
 el('[data-record]').click();latestRecorder.stop();await settle();assert.equal(el('[data-sample]').hidden,false);
 for(const s of ['[data-heard]','[data-consent]']){el(s).checked=true;el(s).dispatchEvent(new dom.window.Event('change'));}
 assert.equal(el('[data-join]').disabled,false);el('[data-join]').click();await settle();
 assert.equal(joinCalls,1);assert.equal(stopCount,2,'Local preflight tracks are stopped before joining SDK');
 assert.equal(el('[data-videos]').children.length,2);assert.equal(el('[data-preflight]').hidden,true);
 el('[data-ready]').click();await settle();assert.equal(el('[data-ready]').textContent,'Đã sẵn sàng');
 state={...state,state:'running',stageIndex:0,stage:{title:'Part one',instruction:'A starts',prompt:'PRIVATE A',seconds:60},deadline:Date.now()+60000};
 document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(el('[data-stage]').hidden,false);assert.equal(el('[data-prompt]').textContent,'PRIVATE A');
 el('[data-next]').click();await settle();assert.equal(el('[data-next]').disabled,true);assert.match(el('[data-vote]').textContent,/Chờ bạn thi/);
 state={...state,state:'processing',stage:null};document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(el('[data-finished]').hidden,false);assert.ok(leaveCalls>0);
 assert.equal(el('[data-error]').textContent,'');
 console.log('Speaking phone DOM: device preview, local audio test, consent gate, SDK join, video tiles, ready, private prompt, stage vote and media cleanup passed.');
}finally{dom.window.dispatchEvent(new dom.window.Event('pagehide'));hook.deregister();dom.window.close();for(const [k,d]of previous)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];delete globalThis.__hmsMock;}
