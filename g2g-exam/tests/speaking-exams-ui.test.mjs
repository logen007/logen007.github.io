// Synthetic DOM/provider tests only: no camera, microphone, 100ms, Drive or VPS.
import assert from 'node:assert/strict';
import {createSpeakingExamsController} from '../src/speaking/exams.js';
import {createSpeakingAutosave} from '../src/speaking/exam-autosave.js';
import {createSpeakingExamCall} from '../src/speaking/exam-call.js';
import {terminalHtml} from '../src/speaking/exam-views.js';
import {validateSpeakingReview} from '../src/speaking/exam-model.js';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/?view=speaking-exams',pretendToBeVisual:true});
const savedGlobals=new Map(['window','document','location','navigator'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
for(const name of savedGlobals.keys())Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name],writable:true});
dom.window.HTMLMediaElement.prototype.play=async()=>{};
const root=document.querySelector('#app'),el=selector=>root.querySelector(selector),clone=value=>structuredClone(value);
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
const click=async action=>{const button=el(`[data-sx-action="${action}"]`);assert.ok(button,'Missing action '+action);button.click();await settle();};
const input=(selector,value)=>{const target=el(selector);assert.ok(target,'Missing input '+selector);target.value=value;target.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
const part={id:'part-a',title:'Trao đổi',instruction:'Hướng dẫn chung',promptA:'ĐỀ RIÊNG A',promptB:'ĐỀ RIÊNG B',imageAUrl:'',imageBUrl:'',seconds:60,speakerSeat:'both',criteria:[{id:'criterion-a',label:'Tiêu chí do giáo viên đặt',maxScore:10}]};
const exam={id:'exam-a',title:'G2G synthetic <test>',kind:'speaking',provider:null,learningLevel:null,sections:[],level:'B1',status:'draft',version:2,speaking:{stages:[part]}};
const user={id:'a',name:'An',role:'student'},teacher={id:'teacher',name:'Cô Mai',role:'teacher'};
const members=[{id:'a',name:'An',seat:'A',ready:false},{id:'b',name:'Bình',seat:'B',ready:false}];
const sessionBase=()=>({id:'session-a',examId:exam.id,title:exam.title,state:'preparing',revision:1,serverNow:Date.now(),seat:'A',participant:true,members:clone(members),ready:{},prepDeadline:Date.now()+1200000,preparation:[{id:part.id,title:part.title,instruction:part.instruction,prompt:part.promptA,image:'',isSpeaker:true}],stageIndex:-1,stageCount:1,canJoin:false});
const media=()=>{const tracks=['audio','video'].map(kind=>({kind,readyState:'live',enabled:true,muted:false,stop(){this.readyState='ended';},addEventListener(){}}));return {getTracks:()=>tracks};};
let controller,contentEditors=[];
function fixture({request,phone=true,currentUser=user,createCall,drawQr,acquirePreview}={}){
 controller?.dispose();root.innerHTML='';contentEditors=[];const routes=[],events=[];
 controller=createSpeakingExamsController({root,context:()=>({user:currentUser}),layout:html=>html,navigate:route=>routes.push(route),notify:text=>events.push(text),afterRender:()=>events.push('paint'),services:{uploadImage:async()=>'/media/uploaded-test',bindContentEditor:(node,options)=>{const instance={node,...options,destroyed:false};contentEditors.push(instance);node.dataset.ready='true';return {capture:()=>({}),release:()=>{},selectedImage:()=>null,insertImages:urls=>options.onChange(urls.map((url,index)=>({id:'uploaded-'+index,type:'image',url,alt:'',align:'center',width:50}))),destroy:()=>{instance.destroyed=true;}};},request,isPhone:()=>phone,createCall,drawQr,acquirePreview:acquirePreview||(async()=>media())}});
 return {routes,events};
}
try{
 const learnerReceipt=terminalHtml({state:'completed',archiveState:'saved'});
 assert.match(learnerReceipt,/Video đã lưu an toàn/);assert.ok(!learnerReceipt.includes('Chưa có xác nhận lưu thành công'));
 assert.match(terminalHtml({state:'completed',archiveState:'queued'}),/Chưa có xác nhận lưu thành công/);
 assert.match(terminalHtml({state:'completed',driveArchive:{state:'saved'}}),/Video đã lưu an toàn/);
 // Changes typed while a save is in flight are drained in order with new versions.
 let content='one',releaseFirst,writes=[],accepted=[];
 const autosave=createSpeakingAutosave({version:1,delay:60000,read:()=>({content}),write:async(value,version)=>{writes.push({value,version});if(writes.length===1)await new Promise(resolve=>releaseFirst=resolve);return {version:version+1};},accept:result=>accepted.push(result.version)});
 autosave.changed();const saving=autosave.flush();await settle();content='two';autosave.changed();releaseFirst();await saving;
 assert.deepEqual(writes,[{value:{content:'one'},version:1},{value:{content:'two'},version:2}]);assert.deepEqual(accepted,[2,3]);assert.equal(autosave.dirty(),false);autosave.dispose();
 let fail=true,retries=[];content='uncertain';
 const retry=createSpeakingAutosave({version:7,delay:60000,read:()=>({content}),write:async(value,version)=>{retries.push({value,version});if(fail)throw Error('synthetic network failure');return {version:version+1};}});
 retry.changed();await assert.rejects(retry.flush(),/network/);content='new edit';retry.changed();fail=false;await retry.flush();
 assert.deepEqual(retries.slice(0,2),[{value:{content:'uncertain'},version:7},{value:{content:'uncertain'},version:7}]);assert.equal(retries[2].value.content,'new edit');assert.equal(retries[2].version,8);retry.dispose();
 let invalidWrites=[];content='';
 const validationSave=createSpeakingAutosave({version:3,delay:60000,read:()=>({content}),write:async(value,version)=>{invalidWrites.push({value,version});if(!value.content)throw Object.assign(Error('Title required'),{status:400});return {version:version+1};}});
 validationSave.changed();await assert.rejects(validationSave.flush(),/Title required/);assert.equal(validationSave.dirty(),true);content='Corrected title';validationSave.changed();await validationSave.flush();
 assert.deepEqual(invalidWrites,[{value:{content:''},version:3},{value:{content:'Corrected title'},version:3}]);assert.equal(validationSave.dirty(),false);validationSave.dispose();

 let authored=clone(exam),requests=[];
 fixture({currentUser:teacher,request:async(path,options={})=>{
  requests.push({path,...options});
  if(path==='/exam-a'&&options.method==='PUT'){assert.equal(options.body.version,authored.version);authored={...clone(options.body.exam),version:authored.version+1};return {exam:clone(authored)};}
  if(path.endsWith('/publish')||path.endsWith('/unpublish')){assert.equal(options.body.version,authored.version);authored.status=path.endsWith('/unpublish')?'draft':'published';authored.version++;return {exam:clone(authored)};}
  assert.equal(path,'/exam-a');return {exam:clone(authored)};
 }});
 await controller.mount({page:'edit',examId:exam.id});assert.equal(el('[data-sx-field="title"]').value,exam.title);assert.equal(root.querySelector('test'),null,'Author text is escaped');
 input('[data-sx-field="title"]','Tên đã sửa');await controller.beforeLeave();assert.equal(authored.title,'Tên đã sửa');assert.equal(authored.version,3);
 await click('publish');assert.equal(el('.sx-author-fields').disabled,true);assert.equal(authored.status,'published');
 await click('unpublish');assert.equal(el('.sx-author-fields').disabled,false);
 await click('criterion-add');const newMaximum=el('[data-sx-field="stages.0.criteria.1.maxScore"]');assert.equal(newMaximum.value,'','Teacher maxima are never invented');
 await click('publish');assert.equal(authored.status,'draft');assert.match(el('[data-sx-error]').textContent,/tiêu chí/);
 assert.ok(requests.every(r=>!r.path.includes('speaking-lab')));

 // A single speaking task uses the shared course editor without a left outline.
 let parityExam=clone(exam);const parityRequests=[];
 fixture({currentUser:teacher,request:async(path,options={})=>{parityRequests.push({path,...options});if(options.method==='PUT')parityExam={...clone(options.body.exam),version:parityExam.version+1};return {exam:clone(parityExam)};}});
 await controller.mount({page:'edit',examId:exam.id});await settle();
 assert.equal(el('.goethe-outline'),null);assert.equal(el('[data-sx-action="part-add"]'),null);
 assert.equal(root.querySelectorAll('[data-sx-part]').length,1);assert.equal(contentEditors.length,2);
 assert.equal(el('[data-sx-minutes]'),null);assert.equal(el('[data-sx-field="stages.0.instruction"]'),null);
 await click('settings');assert.equal(document.querySelector('#sx-level'),null);assert.equal(document.querySelector('#sx-provider'),null);
 const callMinutes=document.querySelector('#sx-call-minutes'),prepMinutes=document.querySelector('#sx-prep-minutes');assert.equal(callMinutes.value,'1');assert.equal(prepMinutes.value,'20');
 callMinutes.value='2.5';callMinutes.dispatchEvent(new dom.window.Event('input',{bubbles:true}));prepMinutes.value='3';prepMinutes.dispatchEvent(new dom.window.Event('input',{bubbles:true}));document.querySelector('[data-dismiss]').click();
 const richA=[{id:'text-a',type:'text',text:'**Updated first A**',align:'center'},{id:'image-a',type:'image',url:'/media/synthetic-a',alt:'A image',align:'right',width:50}];
 contentEditors[0].onChange(richA);await controller.beforeLeave();
 assert.equal(parityExam.speaking.stages[0].seconds,150);assert.deepEqual(parityExam.speaking.stages[0].promptABlocks,richA);
 await click('preview');
 const preview=document.querySelector('[data-editor-preview]');assert.match(preview.textContent,/Updated first A/);assert.equal(preview.querySelector('img').getAttribute('src'),'/media/synthetic-a');
 document.querySelector('[data-preview-seat="B"]').click();assert.match(preview.textContent,/ĐỀ RIÊNG B/);assert.doesNotMatch(preview.textContent,/Updated first A/);assert.equal(preview.querySelector('img'),null);
 document.querySelector('[data-dismiss]').click();
 await click('settings');assert.equal(document.querySelector('#sx-prep-minutes').value,'3');document.querySelector('[data-dismiss]').click();
 await controller.beforeLeave();assert.equal(parityExam.speaking.preparationSeconds,180);assert.equal(parityExam.level,'B1');assert.deepEqual(parityExam.speaking.stages[0].promptABlocks,richA);
 assert.ok(parityRequests.every(item=>item.path==='/exam-a'),'Author preview never starts a real session');
 await settle();contentEditors.at(-2).onFiles([{type:'image/png'},{type:'image/jpeg'}],{point:{}});await settle();await controller.beforeLeave();
 assert.equal(parityExam.speaking.stages[0].promptABlocks.length,2);assert.ok(parityExam.speaking.stages[0].promptABlocks.every(block=>block.url==='/media/uploaded-test'));
 controller.dispose();assert.ok(contentEditors.every(editor=>editor.destroyed),'Shared editor bindings are cleaned up');
 assert.equal(document.querySelector('[role="dialog"]'),null);
 // Old multi-part drafts remain intact, while empty drafts open one task automatically.
 fixture({currentUser:teacher,request:async()=>({exam:{...clone(exam),speaking:{stages:[]}}})});
 await controller.mount({page:'edit',examId:exam.id});assert.equal(root.querySelectorAll('[data-sx-part]').length,1);
 assert.equal(el('[data-sx-action="part-add"]'),null);assert.equal(el('[data-sx-minutes]'),null);
 const legacy={...clone(exam),speaking:{stages:[clone(part),{...clone(part),id:'legacy-b'}]}};
 fixture({currentUser:teacher,request:async()=>({exam:legacy})});await controller.mount({page:'edit',examId:exam.id});assert.equal(root.querySelectorAll('[data-sx-part]').length,2);assert.equal(el('.goethe-outline'),null);

 // An aborted/late old route read cannot replace the current editor's model.
 let resolveOld,oldWritePaths=[];
 fixture({currentUser:teacher,request:async(path,options={})=>{
  if(options.method==='PUT'){oldWritePaths.push(path);return {exam:{...options.body.exam,version:options.body.version+1}};}
  if(path==='/old')return new Promise(resolve=>resolveOld=resolve);
  assert.equal(path,'/new');return {exam:{...clone(exam),id:'new'}};
 }});
 const oldLoad=controller.mount({page:'edit',examId:'old'});await settle();await controller.mount({page:'edit',examId:'new'});resolveOld({exam:{...clone(exam),id:'old'}});await oldLoad;
 input('[data-sx-field="title"]','Current editor');await controller.beforeLeave();assert.deepEqual(oldWritePaths,['/new']);

 // Desktop delivery only offers QR and does not enter queue or acquire devices.
 let qrCount=0;fixture({phone:false,request:()=>{throw Error('Desktop must not enter queue');},drawQr:async(canvas,url)=>{assert.ok(canvas);assert.match(url,/localhost/);qrCount++;},acquirePreview:()=>{throw Error('No desktop camera');}});
 await controller.mount({page:'queue',examId:exam.id});await settle();assert.equal(qrCount,1);assert.equal(el('[data-sx-action="queue-start"]'),null);

 // A cancellation racing a match also leaves that newly paired preparation.
 let queued=null,leaveRace=0;
 fixture({request:async(path,options={})=>{
  if(path==='/queue')return {queue:queued,session:null};
  if(path==='/exam-a/queue'){queued={examId:exam.id,joinedAt:Date.now()-61000,serverNow:Date.now()};return {queue:queued,session:null};}
  if(path==='/queue/cancel')return {queue:null,session:sessionBase()};
  if(path==='/sessions/session-a/leave'){leaveRace++;return {...sessionBase(),state:'cancelled'};}
  throw Error('Unexpected queue request '+path);
 }});
 await controller.mount({page:'queue',examId:exam.id});assert.equal(el('[data-sx-action="queue-start"]').disabled,true);
 await click('devices');await click('queue-start');assert.equal(el('[data-sx-queue-wait]').hidden,false);assert.match(el('[data-sx-queue-policy]').textContent,/ngoài lớp/);
 await click('queue-cancel');assert.equal(leaveRace,1);assert.equal(el('[data-sx-queue-wait]').hidden,true);

 // Private preparation, both-ready transition and recording-gated call.
 let state=sessionBase(),joins=0,connected=0,left=0,adapter,videoNodes=[],sessionRequests=[];
 const f=fixture({request:async(path,options={})=>{
  sessionRequests.push({path,...options});
  if(path.endsWith('/ready')){assert.equal(options.body.revision,state.revision);state={...state,state:'joining',revision:2,canJoin:true,preparation:[],ready:{a:true,b:true}};return clone(state);}
  if(path.endsWith('/join')){assert.notEqual(state.state,'preparing');joins++;return {token:'synthetic-only',name:'An'};}
  if(path.endsWith('/connected')){connected++;assert.equal(options.body.consent,true);if(connected===1)throw Object.assign(Error('media presence pending'),{status:409});state={...state,state:'starting',revision:3};return clone(state);}
  if(path.endsWith('/next')){assert.equal(options.body.stageIndex,0);state={...state,finished:true,revision:state.revision+1};return clone(state);}
  if(path.endsWith('/leave')){state={...state,state:'cancelled',revision:state.revision+1};return clone(state);}
  assert.equal(path,'/sessions/session-a');state.serverNow=Date.now();return clone(state);
 },createCall:options=>{
  let joined=false;
  adapter={isJoined:()=>joined,isJoining:()=>false,render:()=>{const area=el('[data-sx-videos]');if(!area.children.length){area.innerHTML='<figure><video></video><figcaption>An</figcaption></figure><figure><video></video><figcaption>Bình</figcaption></figure>';videoNodes=[...area.querySelectorAll('video')];}},join:async()=>{await options.credentials();joined=true;options.onChange();await options.onConnected();},leave:async()=>{left++;joined=false;},dispose:async()=>{joined=false;}};
  return adapter;
 }});
 await controller.mount({page:'session',id:state.id});assert.equal(joins,0);assert.match(el('[data-sx-prep-prompts]').textContent,/ĐỀ RIÊNG A/);assert.ok(!root.textContent.includes('ĐỀ RIÊNG B'));
 assert.equal(el('[data-sx-match]').hidden,false);assert.equal(el('[data-sx-call]').hidden,true);
 await click('ready');assert.equal(el('[data-sx-preparing]').hidden,true);assert.equal(el('[data-sx-action="join"]').disabled,true);
 await click('devices');await click('join');assert.equal(joins,1);assert.equal(adapter.isJoined(),true,'Presence lag must not tear down a healthy room');assert.equal(el('[data-sx-call]').hidden,false);assert.equal(el('[data-sx-stage]').textContent,'');assert.equal(el('[data-sx-clock]').textContent,'');
 document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(connected,2);assert.match(el('[data-sx-call-status]').textContent,/Đang bật ghi hình/);assert.equal(el('[data-sx-clock]').textContent,'');
 state={...state,state:'running',revision:4,stageIndex:0,stage:{...state.preparation?.[0],...part,prompt:part.promptA,image:'',isSpeaker:true},deadline:Date.now()+60000};
 document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.match(el('[data-sx-stage]').textContent,/ĐỀ RIÊNG A/);assert.match(el('[data-sx-clock]').textContent,/1:00|0:59/);
 await controller.mount({page:'session',id:state.id});assert.deepEqual([...el('[data-sx-videos]').querySelectorAll('video')],videoNodes,'Same-route render preserves live video elements');
 await click('next');assert.equal(el('[data-sx-action="next"]').disabled,true);
 state={...state,state:'paused',revision:6,recoveryDeadline:Date.now()+120000,remaining:30,stage:{...state.stage,isSpeaker:false,prompt:'',image:'',speakerName:'Bình'}};
 document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.match(el('[data-sx-clock]').textContent,/Kết nối lại/);assert.match(el('[data-sx-stage]').textContent,/Bình đang nói/);assert.ok(!el('[data-sx-stage]').textContent.includes('ĐỀ RIÊNG A'));
 state={...state,state:'running',revision:7,finished:false,deadline:Date.now()+30000};document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(el('[data-sx-action="next"]').textContent.trim(),'Sẵn sàng chuyển phần');
 const leaving=controller.beforeLeave();await settle();document.querySelector('[data-confirm-cancel]').click();assert.equal(await leaving,false);assert.equal(adapter.isJoined(),true);
 const leave=controller.beforeLeave();await settle();document.querySelector('[data-confirm-accept]').click();assert.equal(await leave,true);assert.ok(left>0);assert.equal(f.routes.length,0);

 // Archiving changes independently from the completed call state and has no URLs.
 let receipt={...sessionBase(),state:'completed',preparation:[],archiveState:'queued'};
 fixture({request:async path=>{assert.equal(path,'/sessions/session-a');return clone(receipt);}});
 await controller.mount({page:'session',id:receipt.id});assert.match(el('[data-sx-terminal]').textContent,/Chưa có xác nhận lưu thành công/);
 receipt={...receipt,archiveState:'saved',revision:receipt.revision+1};document.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();
 assert.match(el('[data-sx-terminal]').textContent,/Video đã lưu an toàn/);assert.ok(!el('[data-sx-terminal]').textContent.includes('Chưa có xác nhận lưu thành công'));

 // Candidate grades save separately and playback survives switching/publication.
 let grade={...sessionBase(),state:'completed',hasRecording:true,archiveState:'saved',driveArchive:{state:'saved'},examSnapshot:clone(exam),reviews:{},markers:[],recordingStartedAt:Date.now()},gradeWrites=[];
 fixture({currentUser:teacher,request:async(path,options={})=>{
  if(path.endsWith('/grading'))return clone(grade);
  const match=path.match(/\/review\/([ab])(\/publish)?$/);assert.ok(match,path);const id=match[1],previous=grade.reviews[id]||{version:0};assert.equal(options.body.version,previous.version);
  if(match[2])grade.reviews[id]={...previous,publishedAt:Date.now(),version:previous.version+1};
  else{gradeWrites.push(id);grade.reviews[id]={...validateSpeakingReview(exam.speaking,options.body.review),version:previous.version+1,publishedAt:null};}
  return {review:clone(grade.reviews[id])};
 }});
 await controller.mount({page:'grade',id:grade.id});const recording=el('[data-sx-recording]');recording.currentTime=12;
 await click('publish-review');assert.match(el('[data-sx-error]').textContent,/đủ tất cả/);assert.equal(grade.reviews.a,undefined);
 input('[data-sx-score="criterion-a"]','0');input('[data-sx-feedback]','Nhận xét riêng A');
 el('[data-student="b"]').click();await settle();assert.equal(grade.reviews.a.total,0,'A real zero score remains valid');assert.deepEqual(gradeWrites,['a']);assert.equal(el('[data-sx-recording]'),recording);assert.equal(recording.currentTime,12);
 input('[data-sx-score="criterion-a"]','9');input('[data-sx-feedback]','Nhận xét riêng B');await click('publish-review');assert.equal(grade.reviews.b.total,9);assert.ok(grade.reviews.b.publishedAt);assert.equal(el('[data-sx-review-fields]').disabled,true);assert.equal(grade.reviews.a.publishedAt,null);
 assert.equal(el('[data-sx-recording]'),recording);el('[data-student="a"]').click();await settle();assert.equal(el('[data-sx-score="criterion-a"]').value,'0');assert.equal(el('[data-sx-review-fields]').disabled,false);

 // Results pagination accepts sessionId identity, not a nonexistent generic id.
 fixture({request:async path=>path==='/results'?{results:[{sessionId:'one',title:'Đề một',total:8,maxScore:10,publishedAt:Date.now(),feedback:'Riêng bạn'}],nextOffset:100}:{results:[{sessionId:'one',title:'Trùng',total:8,maxScore:10},{sessionId:'two',title:'Đề hai',total:7,maxScore:10}],nextOffset:null}});
 await controller.mount({page:'results'});await click('more');assert.equal(root.querySelectorAll('.sx-results>article').length,2);assert.ok(root.textContent.includes('Đề hai'));assert.equal(el('[data-sx-action="more"]'),null);assert.equal(root.querySelector('video'),null);

 // Actual adapter uses a fake SDK; it cannot obtain any token during preparation.
 controller.dispose();root.innerHTML='<div data-sx-videos></div>';let sdkLoads=0,tokenRequests=0,sdkJoined=false,notification,attached=0,audioResumed=0;
 let callState=sessionBase();const subscriptions=[];
 const fakeActions={join:async()=>{sdkJoined=true;subscriptions.forEach(entry=>entry.fn(entry.selector()));},leave:async()=>{sdkJoined=false;},attachVideo:async()=>{attached++;},detachVideo:async()=>{},unblockAudio:async()=>{audioResumed++;}};
 const fakeSdk={HMSReactiveStore:class{getActions(){return fakeActions;}getStore(){return {subscribe(fn,selector){const item={fn,selector};subscriptions.push(item);fn(selector());return ()=>subscriptions.splice(subscriptions.indexOf(item),1);}};}triggerOnSubscribe(){}getNotifications(){return {onNotification(fn){notification=fn;return ()=>{notification=null;};}};}},selectPeers:()=>sdkJoined?[{customerUserId:'a',isLocal:true,videoTrack:'track-a'},{customerUserId:'b',videoTrack:'track-b'}]:[],selectIsConnectedToRoom:()=>sdkJoined};
 const call=createSpeakingExamCall({root,getSession:()=>callState,getUser:()=>user,credentials:async()=>{tokenRequests++;return {token:'fake',name:'An'};},onConnected:async()=>{},onChange:()=>{},onError:problem=>{throw problem;},loadSdk:async()=>{sdkLoads++;return fakeSdk;}});
 await assert.rejects(call.join(),/kết thúc chuẩn bị/);assert.equal(tokenRequests,0);assert.equal(sdkLoads,0);
 callState={...callState,state:'joining',canJoin:false};await assert.rejects(call.join(),/chưa sẵn sàng/);assert.equal(tokenRequests,0);
 callState={...callState,state:'joining',canJoin:true};await call.join();assert.equal(tokenRequests,1);assert.equal(root.querySelectorAll('video').length,2);assert.equal(attached,2);
 const stable=[...root.querySelectorAll('video')];call.render();assert.deepEqual([...root.querySelectorAll('video')],stable);
 notification({type:'ERROR',data:{name:'AutoplayBlocked'}});assert.equal(call.isAudioBlocked(),true);await call.unblockAudio();assert.equal(audioResumed,1);assert.equal(call.isAudioBlocked(),false);
 notification({type:'RECONNECTING'});assert.equal(call.isJoining(),true);notification({type:'RECONNECTED'});assert.equal(call.isJoining(),false);
 await call.dispose();assert.equal(root.querySelectorAll('video').length,0);assert.equal(subscriptions.length,0);assert.equal(notification,null);
 console.log('Speaking exam UI: ordered/retry autosave, publication locks, private prep, media checks, recording gate, consent lag, stable call/reconnect/audio recovery, cancellation races, separate grades and paginated own results passed. Synthetic DOM/SDK only.');
}finally{
 controller?.dispose();dom.window.close();for(const [name,descriptor]of savedGlobals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
}
