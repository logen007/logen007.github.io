import {clone,uid,nowIso,isTeacher,isMaster,audit} from './base.js';

function numberInRange(value,min,max,label){
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} phải nằm trong khoảng ${min}–${max}.`);return n;
}

export function validateQuestionGroup(group,state=null){
  if(!group)throw new Error('Thiếu dữ liệu cụm câu hỏi.');
  if(!String(group.level||'').trim())throw new Error('Cụm câu hỏi chưa có trình độ.');
  if(!String(group.skill||'').trim())throw new Error('Cụm câu hỏi chưa có kỹ năng.');
  numberInRange(group.partOrder,1,99,'Thứ tự phần');
  const ids=[...new Set(group.questionIds||[])];if(ids.length<1)throw new Error('Cụm phải có ít nhất 1 câu.');
  numberInRange(group.defaultScore??1,0,1000,'Điểm mặc định');
  if(state){const byId=new Map((state.questions||[]).map(q=>[q.id,q]));for(const id of ids)if(!byId.has(id))throw new Error(`Không tìm thấy câu ${id} của cụm.`);}
  return true;
}

export function createQuestionGroup(state,user,input={}){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo cụm câu hỏi.');
  const group={id:input.id||uid('qg'),level:input.level||'',skill:input.skill||'',skillKey:input.skillKey||'',part:input.part||'',partOrder:Number(input.partOrder||1),title:String(input.title||'').trim(),instruction:String(input.instruction||'').trim(),structureType:input.structureType||'GENERIC',audioPolicy:clone(input.audioPolicy||{}),defaultScore:Number(input.defaultScore??1),questionIds:[...new Set(input.questionIds||[])],ownerId:user.id,ownerName:user.name||'',status:input.status||'active',version:Number(input.version||1),createdAt:nowIso(),updatedAt:nowIso()};
  validateQuestionGroup(group,state);state.questionGroups||=[];state.questionGroups.push(group);audit(state,user,'create','question_group',group.id,{title:group.title});return group;
}

export function updateQuestionGroup(state,user,id,patch={}){
  const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  if(!(isMaster(user)||group.ownerId===user.id))throw new Error('Bạn không có quyền sửa cụm câu hỏi này.');
  if(group.locked&&!isMaster(user))throw new Error('Cụm câu hỏi đã được khóa vì đang dùng trong đề.');
  const allowed=['level','skill','skillKey','part','partOrder','title','instruction','structureType','audioPolicy','defaultScore','questionIds','status','version'];for(const key of allowed)if(key in patch)group[key]=clone(patch[key]);
  group.updatedAt=nowIso();validateQuestionGroup(group,state);audit(state,user,'update','question_group',id);return group;
}

export function softDeleteQuestionGroup(state,user,id){
  const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  if(!(isMaster(user)||group.ownerId===user.id))throw new Error('Bạn không có quyền xóa cụm câu hỏi này.');if(group.locked&&!isMaster(user))throw new Error('Cụm câu hỏi đã khóa nên không thể xóa.');
  group.status='trash';group.deletedAt=nowIso();group.updatedAt=nowIso();for(const q of state.questions||[])if(group.questionIds.includes(q.id)&&q.status!=='trash'){q.status='trash';q.deletedAt=nowIso();q.deletedByGroupId=id;q.updatedAt=nowIso();}audit(state,user,'trash','question_group',id);return group;
}

export function restoreQuestionGroup(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ Quản trị cấp cao được khôi phục cụm câu hỏi.');const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');
  group.status='active';delete group.deletedAt;group.updatedAt=nowIso();for(const q of state.questions||[])if(q.deletedByGroupId===id){q.status='active';delete q.deletedAt;delete q.deletedByGroupId;q.updatedAt=nowIso();}audit(state,user,'restore','question_group',id);return group;
}

export function permanentlyDeleteQuestionGroup(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ Quản trị cấp cao được xóa vĩnh viễn cụm câu hỏi.');const group=(state.questionGroups||[]).find(x=>x.id===id);if(!group)throw new Error('Không tìm thấy cụm câu hỏi.');if(group.status!=='trash')throw new Error('Hãy đưa cụm câu hỏi vào Thùng rác trước khi xóa vĩnh viễn.');
  const ids=new Set(group.questionIds||[]);const refs=(state.exams||[]).filter(exam=>(exam.sections||[]).some(section=>(section.questionIds||[]).some(questionId=>ids.has(questionId))));if(refs.length)throw new Error('Cụm vẫn có câu hỏi đang được dùng trong bài thi. Hãy gỡ khỏi bài thi trước khi xóa vĩnh viễn.');
  state.questionGroups=(state.questionGroups||[]).filter(x=>x.id!==id);state.questions=(state.questions||[]).filter(q=>!ids.has(q.id));audit(state,user,'delete_forever','question_group',id,{questionCount:ids.size});
}

export function groupTotalScore(group,state){const ids=new Set(group?.questionIds||[]);return (state?.questions||[]).filter(q=>ids.has(q.id)&&q.status!=='trash').reduce((sum,q)=>sum+Number(q.maxScore||0),0);}
