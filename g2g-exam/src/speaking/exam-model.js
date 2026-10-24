import {normalizeKnowledgeBlocks} from '../domain/course-knowledge.js';

// Custom G2G paired speaking policy; independent of official exam and trial rules.
export const SPEAKING_PREP_SECONDS=1200;
export const SPEAKING_DEFAULT_CALL_SECONDS=900;
export const SPEAKING_CLASS_PRIORITY_SECONDS=60;
export const SPEAKING_RECOVERY_SECONDS=120;
export const SPEAKING_STAGE_MIN_SECONDS=30;
export const SPEAKING_STAGE_MAX_SECONDS=1200;
export const SPEAKING_MAX_STAGES=20;
export const SPEAKING_MAX_SECONDS=2400;
export const SPEAKING_TERMINAL_STATES=Object.freeze(['completed','cancelled','interrupted']);
export const SPEAKING_STATES=Object.freeze({preparing:'Chuẩn bị',joining:'Kiểm tra hình và tiếng',starting:'Đang bật ghi hình',running:'Đang thi',paused:'Đang kết nối lại',finishing:'Đang đóng phòng',processing:'Đang lưu bản ghi',completed:'Chờ chấm điểm',cancelled:'Đã huỷ',interrupted:'Gián đoạn'});

const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=value=>String(value??'').trim();
const validId=value=>typeof value==='string'&&/^[\w-]{1,100}$/.test(value);
const number=value=>value==null||value===''?null:typeof value==='boolean'?NaN:Number(value);
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
const RECORDING_STATUSES=new Set(['requested','starting','running','recording','paused','stopping','stopped','post_processing','completed','failed']);

export const isSpeakingExam=exam=>exam?.kind==='speaking';

function imageUrl(value){
 const url=text(value);
 if(!url)return '';
 if(url.length>2000||!/^\/(?:uploads|media|api\/media)\//.test(url)||/[\\\s\u0000-\u001f]/.test(url))fail('Ảnh đề nói phải được tải lên thư viện của hệ thống.');
 let decoded;try{decoded=decodeURIComponent(url.split(/[?#]/)[0]);}catch{fail('Địa chỉ ảnh đề nói không hợp lệ.');}
 if(decoded.split('/').some(part=>part==='.'||part==='..')||decoded.includes('\\'))fail('Địa chỉ ảnh đề nói không hợp lệ.');
 return url;
}

export function speakingPromptContent(stage,seat){
 return {id:stage.id+'-'+seat,body:stage['prompt'+seat]||'',imageUrl:stage['image'+seat+'Url']||'',...(Array.isArray(stage['prompt'+seat+'Blocks'])?{blocks:stage['prompt'+seat+'Blocks']}:{})};
}

export function speakingPreparationSeconds(config){return config?.preparationSeconds??SPEAKING_PREP_SECONDS;}

export function normalizeSpeakingConfig(input={}){
 if(!object(input)||input.stages!=null&&!Array.isArray(input.stages))fail('Cấu trúc đề nói không hợp lệ.');
 const stages=input.stages||[];
 if(stages.length>SPEAKING_MAX_STAGES)fail('Đề nói có tối đa 20 phần.');
 const preparationSeconds=input.preparationSeconds===undefined?undefined:number(input.preparationSeconds);
 if(preparationSeconds!==undefined&&(!Number.isInteger(preparationSeconds)||preparationSeconds<30||preparationSeconds>SPEAKING_PREP_SECONDS))fail('Thời gian xem đề phải từ 0,5 đến 20 phút.');
 return {...(preparationSeconds!==undefined?{preparationSeconds}:{}),stages:stages.map(stage=>{
  if(!object(stage)||stage.criteria!=null&&!Array.isArray(stage.criteria))fail('Cấu trúc phần thi hoặc tiêu chí không hợp lệ.');
  const seconds=number(stage.seconds);
  if(seconds!==null&&!Number.isFinite(seconds))fail('Thời lượng phần thi không hợp lệ.');
  const rich={};for(const seat of ['A','B'])if(stage['prompt'+seat+'Blocks']!==undefined){
   const content=normalizeKnowledgeBlocks(stage['prompt'+seat+'Blocks'],imageUrl);rich['prompt'+seat+'Blocks']=content.blocks;rich['prompt'+seat]=content.body;
  }
  return {id:text(stage.id),title:text(stage.title),instruction:text(stage.instruction),promptA:text(stage.promptA),promptB:text(stage.promptB),imageAUrl:imageUrl(stage.imageAUrl),imageBUrl:imageUrl(stage.imageBUrl),seconds,speakerSeat:text(stage.speakerSeat)||'both',...rich,criteria:(stage.criteria||[]).map(criterion=>{
   if(!object(criterion))fail('Cấu trúc tiêu chí không hợp lệ.');
   const maxScore=number(criterion.maxScore);
   if(maxScore!==null&&!Number.isFinite(maxScore))fail('Điểm tối đa của tiêu chí không hợp lệ.');
   return {id:text(criterion.id),label:text(criterion.label),maxScore};
  })};
 })};
}

function configErrors(config){
 const errors=[],stageIds=new Set(),criterionIds=new Set();
 if(!config.stages.length)errors.push('Đề nói cần ít nhất một phần thi.');
 for(const [index,stage] of config.stages.entries()){
  const label='Phần '+(index+1);
  if(!validId(stage.id)||stageIds.has(stage.id))errors.push(label+': mã phần thi không hợp lệ hoặc bị trùng.');
  stageIds.add(stage.id);
  if(!stage.title||stage.title.length>100)errors.push(label+': cần tiêu đề từ 1 đến 100 ký tự.');
  if(stage.instruction.length>3000)errors.push(label+': hướng dẫn tối đa 3.000 ký tự.');
  if(!['A','B'].every(seat=>stage['prompt'+seat]||stage['prompt'+seat+'Blocks']?.some(block=>block.type==='image'))||stage.promptA.length>10000||stage.promptB.length>10000)errors.push(label+': cần đề A và B, mỗi đề tối đa 10.000 ký tự.');
  if(!Number.isInteger(stage.seconds)||stage.seconds<SPEAKING_STAGE_MIN_SECONDS||stage.seconds>SPEAKING_STAGE_MAX_SECONDS)errors.push(label+': thời lượng phải từ 0,5 đến 20 phút.');
  if(!['both','A','B'].includes(stage.speakerSeat))errors.push(label+': lượt nói không hợp lệ.');
  for(const criterion of stage.criteria){
   if(!validId(criterion.id)||criterionIds.has(criterion.id))errors.push(label+': mã tiêu chí không hợp lệ hoặc bị trùng.');
   criterionIds.add(criterion.id);
   if(!criterion.label||criterion.label.length>300)errors.push(label+': cần tên tiêu chí tối đa 300 ký tự.');
   if(!Number.isFinite(criterion.maxScore)||criterion.maxScore<=0)errors.push(label+': điểm tối đa của tiêu chí phải lớn hơn 0.');
  }
 }
 if(config.stages.reduce((total,stage)=>total+(stage.seconds||0),0)>SPEAKING_MAX_SECONDS)errors.push('Tổng thời lượng đề nói không được vượt quá 40 phút.');
 const maxScore=speakingMaxScore(config);
 if(!Number.isFinite(maxScore))errors.push('Tổng điểm tối đa không hợp lệ.');
 return errors;
}

export function speakingExamErrors(exam){
 if(!isSpeakingExam(exam))return ['Đây không phải đề nói.'];
 const errors=[];
 if(!text(exam.title))errors.push('Vui lòng đặt tên đề nói.');
 if(!['A1','A2','B1','B2','C1','C2'].includes(exam.level))errors.push('Trình độ đề nói không hợp lệ.');
 // Provider and audience level are metadata, not written-exam structure.
 if(exam.provider!=null&&!['GOETHE','TELC','FID'].includes(exam.provider))errors.push('Loại đề không hợp lệ.');
 if(exam.sections!=null&&(!Array.isArray(exam.sections)||exam.sections.length))errors.push('Đề nói không dùng các phần của đề viết.');
 try{errors.push(...configErrors(normalizeSpeakingConfig(exam.speaking)));}catch(error){errors.push(error.message);}
 return errors;
}

export function speakingMaxScore(config){
 return (config?.stages||[]).reduce((total,stage)=>total+(stage.criteria||[]).reduce((sum,criterion)=>sum+(typeof criterion.maxScore==='number'&&Number.isFinite(criterion.maxScore)&&criterion.maxScore>0?criterion.maxScore:0),0),0);
}

export function validateSpeakingReview(config,review,{complete=false}={}){
 const normalized=normalizeSpeakingConfig(config),errors=configErrors(normalized);
 if(errors.length)fail('Đề nói chưa có cấu trúc chấm điểm hợp lệ. '+errors[0]);
 return reviewForCriteria(normalized.stages.flatMap(stage=>stage.criteria),review,{complete});
}

function reviewForCriteria(rubric,review,{complete=false}={}){
 if(!object(review)||review.scores!=null&&!object(review.scores))fail('Điểm chấm không hợp lệ.');
 const criteria=new Map(),scores={};
 for(const criterion of rubric){
  if(!object(criterion)||!validId(criterion.id)||criteria.has(criterion.id)||!Number.isFinite(criterion.maxScore)||criterion.maxScore<=0)fail('Cấu trúc tiêu chí chấm điểm không hợp lệ.');
  criteria.set(criterion.id,criterion);
 }
 for(const [id,score] of Object.entries(review.scores||{})){
  const criterion=criteria.get(id);
  if(!criterion)fail('Tiêu chí chấm điểm không thuộc phiên bản đề thi này.');
  if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>criterion.maxScore)fail('Điểm của '+(criterion.label||criterion.id)+' phải từ 0 đến '+criterion.maxScore+'.');
  Object.defineProperty(scores,id,{value:score,enumerable:true,writable:true,configurable:true});
 }
 const feedback=text(review.feedback),finished=Object.keys(scores).length===criteria.size;
 if(feedback.length>10000)fail('Nhận xét tối đa 10.000 ký tự.');
 if(complete&&!finished)fail('Cần chấm đủ tất cả tiêu chí trước khi công bố.');
 const total=Object.values(scores).reduce((sum,score)=>sum+score,0),maxScore=[...criteria.values()].reduce((sum,criterion)=>sum+criterion.maxScore,0);
 if(!Number.isFinite(total)||!Number.isFinite(maxScore))fail('Tổng điểm không hợp lệ.');
 return {scores,feedback,total,maxScore,complete:finished};
}

function memberPresence(data,id){
 const value=Array.isArray(data.presence)?data.presence.find(item=>item.id===id):data.presence?.[id];
 if(!value)return null;
 return {connected:Boolean(value.connected),devices:Number.isSafeInteger(value.devices)&&value.devices>0?value.devices:0,audio:Boolean(value.audio),video:Boolean(value.video)};
}

function privateStage(stage,seat,members,preparing=false){
 if(!stage)return null;
 const speaker=stage.speakerSeat==='A'||stage.speakerSeat==='B'?members.find(member=>member.seat===stage.speakerSeat):null;
 const isSpeaker=Boolean(seat)&&(!speaker||speaker.seat===seat);
 const visible=Boolean(seat)&&(preparing||isSpeaker);
 return {id:stage.id,title:stage.title,instruction:stage.instruction,prompt:visible?stage[seat==='A'?'promptA':'promptB']||'':'',image:visible?stage[seat==='A'?'imageAUrl':'imageBUrl']||'':'',...(visible&&Array.isArray(stage['prompt'+seat+'Blocks'])?{blocks:copy(stage['prompt'+seat+'Blocks'])}:{}),seconds:stage.seconds,speakerSeat:stage.speakerSeat,isSpeaker,speakerName:speaker?.name||''};
}

// Result-list SQL needs only the rubric; never fetch A/B prompts to validate marks.
export function speakingPublishedResult(config,review){
 if(!review?.publishedAt)return null;
 try{
  if(!Array.isArray(config?.stages)||!config.stages.length||config.stages.length>SPEAKING_MAX_STAGES||config.stages.some(stage=>!Array.isArray(stage?.criteria)))return null;
  const normalized=reviewForCriteria(config.stages.flatMap(stage=>stage.criteria),review,{complete:true});
  return {...normalized,publishedAt:review.publishedAt};
 }catch{return null;}
}

export function speakingSessionView(row,user,now=Date.now()){
 const data=row?.data||{},exam=data.examSnapshot||{},members=Array.isArray(data.members)?data.members:[];
 const staff=Boolean(user?.id)&&(user.role==='master'||user.role==='teacher'&&row.owner_id===user.id);
 const member=user?.id?members.find(item=>item.id===user.id):null;
 if(!staff&&!member)throw Object.assign(new Error('Bạn không có quyền xem ca thi này.'),{statusCode:403});
 const stages=exam.speaking?.stages||[],seat=member?.seat||null;
 const active=['running','paused'].includes(data.state),archive=data.driveArchive;
 const view={id:row.id,examId:data.examId,publicationVersion:data.publicationVersion,publicationLabel:exam.publicationLabel||'',title:exam.title||'',level:exam.level||'',state:data.state,revision:data.revision||0,serverNow:now,manage:staff,participant:Boolean(member),seat,
  members:members.map(item=>({id:item.id,name:item.name,seat:item.seat,ready:Boolean(data.ready?.[item.id]),presence:memberPresence(data,item.id)})),
  canJoin:Boolean(member)&&['joining','starting','running','paused'].includes(data.state)&&Boolean(data.roomReady??data.roomId),prepDeadline:data.prepDeadline||null,preparationSeconds:speakingPreparationSeconds(exam.speaking),
  ready:Object.fromEntries(members.map(item=>[item.id,Boolean(data.ready?.[item.id])])),
  preparation:member&&data.state==='preparing'?stages.map(stage=>privateStage(stage,seat,members,true)):[],
  stageIndex:data.stageIndex??null,stageCount:stages.length,stage:active?privateStage(stages[data.stageIndex],seat,members):null,
  deadline:data.deadline||null,remaining:data.remaining??null,recoveryDeadline:data.recoveryDeadline||null,
  finished:Boolean(data.votes?.[user.id]),partnerFinished:members.some(item=>item.id!==user.id&&data.votes?.[item.id]),
  error:data.error||'',recordingStatus:RECORDING_STATUSES.has(data.recordingStatus)?data.recordingStatus:null,archiveState:archive?.state||null,result:member?speakingPublishedResult(exam.speaking,data.reviews?.[user.id]):null};
 if(staff)Object.assign(view,{examSnapshot:copy(exam),reviews:copy(data.reviews||{}),markers:copy(data.markers||[]),hasRecording:Boolean(data.assetId)&&archive?.state==='saved',
  driveArchive:archive?{state:archive.state||'queued',error:archive.error||'',savedAt:archive.savedAt||null}:null,recordingStartedAt:data.recordingStartedAt||null});
 return view;
}
