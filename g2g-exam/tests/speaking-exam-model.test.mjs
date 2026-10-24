import assert from 'node:assert/strict';
import {
 isSpeakingExam,normalizeSpeakingConfig,speakingExamErrors,speakingMaxScore,
 validateSpeakingReview,speakingPublishedResult,speakingSessionView,SPEAKING_PREP_SECONDS,
 SPEAKING_CLASS_PRIORITY_SECONDS,SPEAKING_RECOVERY_SECONDS,SPEAKING_MAX_SECONDS,
} from '../src/speaking/exam-model.js';

const clone=value=>structuredClone(value);
const stage=(id='part-1',overrides={})=>({id,title:'Trao đổi',instruction:'Hướng dẫn chung',promptA:'ONLY_A_PRIVATE_PROMPT',promptB:'ONLY_B_PRIVATE_PROMPT',imageAUrl:'/media/private-a-image',imageBUrl:'/api/media/private-b-image',seconds:120,speakerSeat:'both',criteria:[{id:id+'-fluency',label:'Tiêu chí giáo viên đặt',maxScore:8.5},{id:id+'-interaction',label:'Tiêu chí khác',maxScore:11.5}],...overrides});
const config={stages:[stage(),stage('part-2',{speakerSeat:'A'})]};
const exam={id:'exam-1',kind:'speaking',title:'G2G nói',level:'B2',provider:null,learningLevel:null,sections:[],ownerId:'owner',publicationLabel:'v1',speaking:config};
assert.equal(isSpeakingExam(exam),true);
for(const ordinary of [{provider:'TELC'},{kind:'ordinary'},null])assert.equal(isSpeakingExam(ordinary),false);
assert.deepEqual(speakingExamErrors(exam),[]);
assert.deepEqual(normalizeSpeakingConfig({}),{stages:[]});
assert.deepEqual(normalizeSpeakingConfig({stages:[{criteria:[{label:'Chưa có điểm'}]}]}),{stages:[{id:'',title:'',instruction:'',promptA:'',promptB:'',imageAUrl:'',imageBUrl:'',seconds:null,speakerSeat:'both',criteria:[{id:'',label:'Chưa có điểm',maxScore:null}]}]});
assert.equal(normalizeSpeakingConfig({stages:[stage('n',{seconds:'120',criteria:[{id:'n-score',label:'Điểm',maxScore:'0.5'}]})]}).stages[0].criteria[0].maxScore,0.5);
assert.equal(speakingMaxScore(config),40);
assert.equal(speakingMaxScore({stages:[{criteria:[{maxScore:null}]}]}),0,'Blank draft rubric never acquires an invented score');
assert.equal(SPEAKING_PREP_SECONDS,20*60);
assert.equal(SPEAKING_CLASS_PRIORITY_SECONDS,60);
assert.equal(SPEAKING_RECOVERY_SECONDS,120);
assert.equal(SPEAKING_MAX_SECONDS,40*60);

const invalidExam=mutate=>{const value=clone(exam);mutate(value);assert.ok(speakingExamErrors(value).length);};
for(const mutate of [
 e=>e.title='',e=>e.level='A0',e=>e.provider='GOETHE',e=>e.learningLevel='B2',
 e=>e.sections=[{skillKey:'speaking'}],e=>e.sections={},e=>e.speaking.stages=[],
 e=>e.speaking.stages[0].promptA='',e=>e.speaking.stages[0].promptB='',
 e=>e.speaking.stages[0].instruction='',e=>e.speaking.stages[0].speakerSeat='C',
 e=>e.speaking.stages[0].seconds=29,e=>e.speaking.stages[0].seconds=1201,
 e=>e.speaking.stages[0].seconds=30.5,e=>e.speaking.stages[0].criteria=[],
 e=>e.speaking.stages[0].criteria[0].maxScore=0,
 e=>e.speaking.stages[0].criteria[0].maxScore=-1,
 e=>e.speaking.stages[0].criteria[0].maxScore=Infinity,
 e=>e.speaking.stages[1].id=e.speaking.stages[0].id,
 e=>e.speaking.stages[1].criteria[0].id=e.speaking.stages[0].criteria[0].id,
 e=>e.speaking.stages=Array.from({length:21},(_,i)=>stage('part-'+i,{seconds:30})),
 e=>e.speaking.stages=[stage('a',{seconds:1200}),stage('b',{seconds:1200}),stage('c',{seconds:30})],
])invalidExam(mutate);
assert.deepEqual(speakingExamErrors({...exam,speaking:{stages:[stage('a',{seconds:1200}),stage('b',{seconds:1200})]}}),[],'Exactly 40 minutes is allowed');
for(const image of ['https://external.example/private.jpg','javascript:alert(1)','data:image/png;base64,x','//evil.example/x','/media/../secret','/media/%2e%2e/secret','/media/a\\b','/media/a%5cb'])assert.throws(()=>normalizeSpeakingConfig({stages:[stage('x',{imageAUrl:image})]}),error=>error.statusCode===400);
for(const input of [{stages:{}},{stages:[null]},{stages:[{criteria:{}}]}])assert.throws(()=>normalizeSpeakingConfig(input));
const before=clone(config);normalizeSpeakingConfig(config);assert.deepEqual(config,before,'Normalization must not mutate pinned config');

const fullScores=Object.fromEntries(config.stages.flatMap(part=>part.criteria.map(criterion=>[criterion.id,criterion.maxScore])));
const review=validateSpeakingReview(config,{scores:fullScores,feedback:'  Nội dung riêng của A  '},{complete:true});
assert.deepEqual(review,{scores:fullScores,feedback:'Nội dung riêng của A',total:40,maxScore:40,complete:true});
const partial=validateSpeakingReview(config,{scores:{'part-1-fluency':0},feedback:''});
assert.deepEqual(partial,{scores:{'part-1-fluency':0},feedback:'',total:0,maxScore:40,complete:false});
assert.ok(!Object.hasOwn(partial.scores,'part-1-interaction'),'An ungraded criterion stays absent, not zero');
assert.throws(()=>validateSpeakingReview(config,partial,{complete:true}),/đủ tất cả/);
for(const scores of [{'unknown':3},{'part-1-fluency':-1},{'part-1-fluency':8.6},{'part-1-fluency':Infinity},{'part-1-fluency':NaN},{'part-1-fluency':'1'},{'part-1-fluency':null},[]])assert.throws(()=>validateSpeakingReview(config,{scores}),error=>error.statusCode===400);
assert.throws(()=>validateSpeakingReview(config,{scores:{},feedback:'x'.repeat(10001)}),/10.000/);
assert.throws(()=>validateSpeakingReview({stages:[]},{scores:{}}),/cấu trúc chấm điểm/);
const trickyConfig={stages:[stage('x',{criteria:[{id:'__proto__',label:'Điểm',maxScore:1}]})]};
const trickyScores=JSON.parse('{"__proto__":1}');
assert.equal(validateSpeakingReview(trickyConfig,{scores:trickyScores},{complete:true}).total,1,'Criterion IDs cannot invoke object prototype setters');
assert.equal(Object.prototype.polluted,undefined);
const rubricOnly={stages:config.stages.map(part=>({criteria:part.criteria.map(({id,maxScore})=>({id,maxScore}))}))};
assert.equal(speakingPublishedResult(rubricOnly,{...review,publishedAt:1700000000000}).total,40,'Published marks can be validated from SQL-projected criteria without loading A/B prompts');
assert.equal(speakingPublishedResult(rubricOnly,{...review,publishedAt:null}),null);
assert.equal(speakingPublishedResult(rubricOnly,{...partial,publishedAt:1700000000000}),null);
assert.equal(speakingPublishedResult({stages:[{criteria:[{id:'duplicate',maxScore:1},{id:'duplicate',maxScore:2}]}]},{scores:{duplicate:1},publishedAt:1700000000000}),null);
assert.equal(speakingPublishedResult({stages:[{criteria:[{id:'score',maxScore:Infinity}]}]},{scores:{score:1},publishedAt:1700000000000}),null);
assert.equal(speakingPublishedResult({stages:[{criteria:[{maxScore:1}]}]},{scores:{undefined:1},publishedAt:1700000000000}),null);
assert.equal(speakingPublishedResult(rubricOnly,{...review,scores:{...review.scores,'part-1-fluency':9},publishedAt:1700000000000}),null);
assert.throws(()=>validateSpeakingReview(rubricOnly,review),/cấu trúc chấm điểm/,'Draft grading still requires the complete valid pinned exam');

const userA={id:'a',role:'student'},userB={id:'b',role:'student'},owner={id:'owner',role:'teacher'},master={id:'master',role:'master'};
const row={id:'session-1',owner_id:'owner',data:{examId:'exam-1',publicationVersion:1,examSnapshot:clone(exam),state:'preparing',revision:3,prepDeadline:1700001200000,stageIndex:0,members:[{id:'a',name:'An',seat:'A',classId:'class-secret-a'},{id:'b',name:'Bình',seat:'B',classId:'class-secret-b'}],ready:{a:true},votes:{},presence:[{id:'a',connected:true,devices:1,audio:true,video:true,providerPeerId:'secret-provider-peer'}],roomId:'secret-room-id',recordingId:'secret-recording-id',assetId:'secret-asset-id',recordingStatus:'running',driveArchive:{state:'saved',fileId:'secret-drive-file',checksum:'secret-checksum',lease:'secret-lease',savedAt:1700000000000},markers:[{note:'staff marker'}],reviews:{a:{...clone(review),version:2,publishedAt:null,reviewerId:'owner',reviewerName:'Teacher',updatedAt:1700000000000},b:{...clone(review),feedback:'ONLY_B_PRIVATE_FEEDBACK',version:1,publishedAt:1700000000010}},deadline:1700000005000,remaining:50}};
const now=1700000000000;
for(const stranger of [null,{id:'other',role:'student'},{id:'other',role:'teacher'},{id:'owner',role:'student'}])assert.throws(()=>speakingSessionView(row,stranger,now),error=>error.statusCode===403);
const a=speakingSessionView(row,userA,now),b=speakingSessionView(row,userB,now);
assert.equal(a.serverNow,now);assert.equal(a.revision,3);assert.equal(a.prepDeadline,row.data.prepDeadline);
assert.equal(a.canJoin,false,'A pre-existing room ID cannot bypass preparation');
assert.equal(a.preparation[0].prompt,'ONLY_A_PRIVATE_PROMPT');
assert.equal(b.preparation[1].prompt,'ONLY_B_PRIVATE_PROMPT','All own parts remain available during preparation, including passive turns');
assert.deepEqual(a.ready,{a:true,b:false});
assert.deepEqual(a.members[0].presence,{connected:true,devices:1,audio:true,video:true});
assert.equal(a.result,null,'Own draft points are private');
assert.equal(a.archiveState,'saved','A safe status confirms archival without sharing recording identifiers');
assert.equal(b.result.feedback,'ONLY_B_PRIVATE_FEEDBACK','Published candidate B points are visible to B independently');
assert.equal(b.result.total,40);
for(const [view,privateSeat] of [[a,'B'],[b,'A']]){
 const serialized=JSON.stringify(view);
 assert.ok(!serialized.includes('ONLY_'+privateSeat+'_PRIVATE_PROMPT'));
 assert.ok(!serialized.includes('private-'+privateSeat.toLowerCase()+'-image'));
 for(const secret of ['secret-room-id','secret-recording-id','secret-asset-id','secret-drive-file','secret-checksum','secret-lease','secret-provider-peer','class-secret-','staff marker'])assert.ok(!serialized.includes(secret));
 for(const key of ['examSnapshot','reviews','markers','driveArchive','hasRecording','roomId','recordingId','assetId'])assert.equal(view[key],undefined);
}
assert.ok(!JSON.stringify(a).includes('ONLY_B_PRIVATE_FEEDBACK'));

for(const staff of [owner,master]){
 const view=speakingSessionView(row,staff,now);
 assert.equal(view.manage,true);assert.equal(view.participant,false);assert.equal(view.canJoin,false);
 assert.deepEqual(view.examSnapshot,row.data.examSnapshot);assert.equal(view.reviews.a.version,2);
 assert.equal(view.hasRecording,true);assert.deepEqual(view.driveArchive,{state:'saved',error:'',savedAt:1700000000000});
 view.examSnapshot.speaking.stages[0].promptA='mutation';view.reviews.a.feedback='mutation';view.markers[0].note='mutation';
 assert.equal(row.data.examSnapshot.speaking.stages[0].promptA,'ONLY_A_PRIVATE_PROMPT');
 assert.equal(row.data.reviews.a.feedback,'Nội dung riêng của A');assert.equal(row.data.markers[0].note,'staff marker');
}
const transfer={...row,owner_id:'new-owner'};
assert.throws(()=>speakingSessionView(transfer,owner,now),error=>error.statusCode===403,'An old snapshot owner cannot override session ownership');

row.data.state='running';row.data.stageIndex=1;row.data.votes={a:true};
assert.equal(speakingSessionView(row,userA,now).stage.prompt,'ONLY_A_PRIVATE_PROMPT');
const passive=speakingSessionView(row,userB,now);
assert.equal(passive.stage.prompt,'');assert.equal(passive.stage.image,'');assert.equal(passive.stage.isSpeaker,false);assert.equal(passive.stage.speakerName,'An');
assert.equal(passive.partnerFinished,true);assert.equal(passive.finished,false);
assert.equal(passive.canJoin,true);assert.deepEqual(passive.preparation,[]);
row.data.roomReady=false;assert.equal(speakingSessionView(row,userA,now).canJoin,false);delete row.data.roomReady;
for(const state of ['preparing','joining','starting','running','paused','finishing','processing','completed','cancelled','interrupted']){
 row.data.state=state;
 const view=speakingSessionView(row,userA,now);
 assert.equal(Boolean(view.stage),['running','paused'].includes(state));
 assert.equal(view.canJoin,['joining','starting','running','paused'].includes(state));
 assert.ok(!JSON.stringify(view).includes('ONLY_B_PRIVATE_PROMPT'));
}
row.data.reviews.a.publishedAt=now;
assert.equal(speakingSessionView(row,userA,now).result.total,40);
row.data.reviews.a.scores={};
assert.equal(speakingSessionView(row,userA,now).result,null,'An invalid/incomplete publication never leaks partial marks');
row.data.recordingStatus='https://private-provider.example/token';
assert.equal(speakingSessionView(row,userA,now).recordingStatus,null);
row.data.driveArchive.state='uploading';assert.equal(speakingSessionView(row,owner,now).hasRecording,false,'Call completion cannot masquerade as verified archive completion');
console.log('Speaking exam model: custom policy, publication bounds, rubric validation, owner access and private per-candidate projections passed.');
