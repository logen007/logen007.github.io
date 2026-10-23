import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual app helpers without booting accounts or requesting media.
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function readAudioDuration('),source.indexOf('function queueAnswer('));
const timers=new Map(),frames=new Map();let sequence=0;
const context=vm.createContext({
 setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},
 clearTimeout:id=>timers.delete(id),
 requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},
 cancelAnimationFrame:id=>frames.delete(id),
});
vm.runInContext(helpers,context);
class Audio extends EventTarget{
 duration=NaN;currentTime=0;ended=false;paused=true;loads=0;plays=0;
 load(){this.loads++;}
 play(){this.plays++;this.paused=false;this.ended=false;return Promise.resolve();}
}
const runTimers=()=>{const pending=[...timers.values()];timers.clear();for(const item of pending)item.fn();};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const finish=audio=>{audio.paused=true;audio.ended=true;audio.onended();};

const stalled=new Audio(),waiting=context.readAudioDuration(stalled);
assert.equal(timers.size,1,'Missing metadata must have a bounded wait');
assert.equal([...timers.values()][0].ms,15000);
runTimers();await assert.rejects(waiting,/Audiodauer/);
stalled.duration=2;stalled.dispatchEvent(new Event('loadedmetadata'));
assert.equal(timers.size,0,'Late metadata cannot keep a retry timer alive');

const ready=new Audio(),loading=context.readAudioDuration(ready);
ready.duration=2;ready.dispatchEvent(new Event('loadedmetadata'));
assert.equal(await loading,2);assert.equal(timers.size,0);
assert.equal(await context.readAudioDuration(ready),2);assert.equal(ready.loads,1);
const broken=new Audio(),failed=context.readAudioDuration(broken);
broken.dispatchEvent(new Event('error'));await assert.rejects(failed,/Audiodauer/);
assert.equal(timers.size,0);
const throwing=new Audio();throwing.load=()=>{throw Error('load failed');};
await assert.rejects(context.readAudioDuration(throwing));assert.equal(timers.size,0);

const resumed=new Audio();resumed.duration=2;
resumed.play=()=>++resumed.plays===1?Promise.resolve():Promise.reject(Error('resume blocked'));
const playback=context.playSectionSegment(resumed,()=>{});await settle();
assert.equal(frames.size,1);resumed.onpause();runTimers();
await assert.rejects(playback,/resume blocked/);
assert.equal(frames.size,0,'Resume rejection must cancel the animation frame');
for(const hook of ['onpause','onended','onerror'])assert.equal(resumed[hook],null);

const finished=new Audio();finished.duration=2;
const complete=context.playSectionSegment(finished,()=>{});await settle();
finished.onpause();finished.ended=true;finished.onended();await complete;
runTimers();assert.equal(finished.plays,1,'Queued resume cannot replay a completed segment');
assert.equal(frames.size,0);
// Exercise the caller too: timeout must restore the real pre-lock UI path,
// without consuming the server-owned audio session.
const notices=[],requests=[],button={disabled:false},status={textContent:''};
const classes=new Set(),progress={hidden:true,querySelector:()=>({style:{}}),setAttribute(){}};
let segment=new Audio();segment.dataset={repeat:'2',label:'Aufgabe 1'};
const root={dataset:{sectionAudio:'section',storageKey:'fixture'},
 classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
 querySelector:selector=>({'.section-audio-play':button,'.section-audio-status':status,'.section-audio-progress':progress})[selector],
 querySelectorAll:()=>[segment]};
let audioRoots=[root];
const allAudios=()=>audioRoots.flatMap(item=>item.querySelectorAll('.section-audio-segment'));
Object.assign(context,{app:{
 querySelector:selector=>selector==='[data-audio-busy="true"]'?[...audioRoots,...allAudios()].find(item=>item.dataset.audioBusy==='true'):audioRoots[0],
 querySelectorAll:selector=>selector==='audio'?allAudios():selector==='[data-section-audio]'?audioRoots:[]
},notify:message=>notices.push(message),
 sessionStorage:{setItem(){},removeItem(){}},templateRequest:async url=>{requests.push(url);return {ok:true};}});
vm.runInContext(source.slice(source.indexOf('function examAudioPlaying('),source.indexOf('function readAudioDuration(')),context);
context.bindSectionAudio({id:'attempt'},{preview:false});
const timeoutClick=button.onclick();assert.equal(root.dataset.audioBusy,'true');
runTimers();await timeoutClick;
assert.equal(button.disabled,false);assert.equal(root.dataset.audioBusy,undefined);
assert.equal(progress.hidden,true);assert.equal(requests.length,0);
assert.match(notices.at(-1),/Audiodauer/);

segment.duration=1;
const successClick=button.onclick();await settle();
assert.equal(segment.plays,1);finish(segment);await settle();
assert.equal(segment.plays,2,'Configured repeat count is preserved');finish(segment);await successClick;
assert.deepEqual(requests,['/actions/startPartAudio','/actions/completePartAudio']);
assert.equal(button.disabled,true);assert.equal(root.dataset.audioBusy,undefined);
assert.equal(classes.has('is-playing'),false);assert.equal(frames.size,0);
// Claim the whole part before metadata or server awaits, not just the current segment.
const makeSection=(id,duration)=>{
 const audio=new Audio();audio.duration=duration;audio.dataset={repeat:'1',label:id};
 const button={disabled:false},status={textContent:''},progress={hidden:true,querySelector:()=>({style:{}}),setAttribute(){}};
 const root={dataset:{sectionAudio:id,storageKey:id},classList:{add(){},remove(){}},
  querySelector:selector=>({'.section-audio-play':button,'.section-audio-status':status,'.section-audio-progress':progress})[selector],querySelectorAll:()=>[audio]};
 return {root,audio,button,status};
};
for(const preview of [false,true]){
 const first=makeSection('first',NaN),second=makeSection('second',1);
 audioRoots=[first.root,second.root];context.bindSectionAudio({id:'attempt'},{preview});
 const requestCount=requests.length,pending=first.button.onclick();
 await second.button.onclick();
 assert.equal(second.audio.plays,0,'A second part cannot start while the first waits for metadata');
 assert.equal(second.button.disabled,false,'Blocked playback does not consume or disable the other part');
 assert.equal(second.root.dataset.audioBusy,undefined);assert.equal(requests.length,requestCount);
 first.audio.duration=1;first.audio.dispatchEvent(new Event('loadedmetadata'));await settle();
 assert.equal(first.audio.plays,1);
 await second.button.onclick();
 assert.equal(second.audio.plays,0,'A second part cannot overlap active playback in live or preview');
 assert.equal(requests.length,requestCount+(preview?0:1),'Blocked playback never starts a server-owned session');
 finish(first.audio);await pending;
 const next=second.button.onclick();await settle();
 assert.equal(second.audio.plays,1,'Another part is available after the current part completes');
 finish(second.audio);await next;
 assert.equal(timers.size,0);assert.equal(frames.size,0);
 assert.equal(first.root.dataset.audioBusy,undefined);assert.equal(second.root.dataset.audioBusy,undefined);
 assert.match(notices.at(-1),/một audio/);
 // Legacy per-question audio uses the same reservation and actual playing-state guard.
 assert.equal(context.claimAudioPlayback(first.audio),true);
 assert.equal(context.claimAudioPlayback(second.audio),false);
 delete first.audio.dataset.audioBusy;first.audio.paused=false;first.audio.ended=false;
 assert.equal(context.claimAudioPlayback(second.audio),false);
 first.audio.paused=true;
 assert.equal(context.claimAudioPlayback(second.audio),true);delete second.audio.dataset.audioBusy;
}
assert.equal((source.match(/if\(!claimAudioPlayback\(audio\)\)return;/g)||[]).length,2,'Both live and preview legacy audio buttons use the shared playback guard');
const practice=makeSection('practice',1);audioRoots=[practice.root];
const beforePractice=requests.length;context.bindSectionAudio({id:'course-practice'},{preview:true,repeatable:true});
for(let turn=0;turn<2;turn++){
 const playing=practice.button.onclick();await settle();assert.equal(practice.audio.plays,turn+1);
 finish(practice.audio);await playing;assert.equal(practice.button.disabled,false,'Course practice can listen again without consuming an exam session');
 assert.equal(practice.status.textContent,'Audio erneut abspielen');
}
assert.equal(requests.length,beforePractice);
console.log('Audio runtime: bounded metadata, success/error cleanup, resume rejection and no late replay passed.');
