import {
  clone,uid,nowIso,byId,isTeacher,isMaster,audit,canEditQuestion,canDeleteQuestion
} from './base.js';

function choiceText(choice){
  if(choice&&typeof choice==='object')return String(choice.text||'').trim();
  return String(choice||'').trim();
}

export function getQuestionMaxScore(question,defaultScore=0){
  const score=Number(question?.maxScore);
  return Number.isFinite(score)&&score>=0?score:Math.max(0,Number(defaultScore)||0);
}

function validateQuestionInput(input,existing=null){
  const type=input.type??existing?.type??'single';
  const title=String(input.title??existing?.title??'').trim();
  if(!title)throw new Error('Câu hỏi cần có tiêu đề nội bộ.');
  const maxScore=Number(input.maxScore??existing?.maxScore??1);
  if(!Number.isFinite(maxScore)||maxScore<0)throw new Error('Điểm tối đa không hợp lệ.');
  if(['single','truefalse','cloze'].includes(type)){
    const choices=clone(input.choices??existing?.choices??[]);
    if(choices.length<2||choices.some(x=>!choiceText(x)))throw new Error('Câu tự chấm cần ít nhất 2 lựa chọn hợp lệ.');
    const correct=Number(input.correctAnswer??existing?.correctAnswer);
    if(!Number.isInteger(correct)||correct<0||correct>=choices.length)throw new Error('Đáp án đúng không hợp lệ.');
  }
  if(type==='matching'){
    const pairs=clone(input.pairs??existing?.pairs??[]);
    if(!pairs.length||pairs.some(x=>!Array.isArray(x)||x.length<2||!String(x[0]||'').trim()||!String(x[1]||'').trim()))throw new Error('Câu ghép nội dung cần có các cặp hợp lệ.');
  }
}

export function createQuestion(state,user,input={}){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo câu hỏi.');
  validateQuestionInput(input);
  const type=input.type||'single';
  const question={
    id:uid('q'),
    code:input.code||`Q-${String((state.questions||[]).length+1).padStart(4,'0')}`,
    level:input.level||'B1',skill:input.skill||'Đọc hiểu',part:input.part||'Phần 1',type,
    title:String(input.title||'').trim(),instruction:input.instruction||'',prompt:input.prompt||'',
    choices:clone(input.choices||[]),correctAnswer:input.correctAnswer??null,pairs:clone(input.pairs||[]),
    maxScore:Number(input.maxScore??1),autoGrade:input.autoGrade??!['writing','speaking'].includes(type),
    rubric:clone(input.rubric||[]),audioUrl:input.audioUrl||'',audioName:input.audioName||'',instructionImageUrl:input.instructionImageUrl||'',instructionBlocks:clone(input.instructionBlocks||[]),ownerId:user.id,ownerName:user.name,
    groupId:input.groupId||null,groupType:input.groupType||null,groupOrder:Number(input.groupOrder||0)||null,
    groupInstruction:input.groupInstruction||'',groupAudioPolicy:clone(input.groupAudioPolicy||null),
    status:'active',locked:false,usedCount:0,correctRate:null,createdAt:nowIso(),updatedAt:nowIso(),
  };
  state.questions.push(question);
  audit(state,user,'create','question',question.id,{title:question.title});
  return question;
}

export function updateQuestion(state,user,id,patch){
  const question=byId(state.questions,id);
  if(!question)throw new Error('Không tìm thấy câu hỏi.');
  if(!canEditQuestion(user,question))throw new Error(question.locked?'Câu hỏi đã được dùng trong đề đã xuất bản nên không thể chỉnh sửa. Hãy tạo câu hỏi mới.':'Bạn không có quyền sửa câu hỏi này.');
  validateQuestionInput(patch,question);
  const allowed=['code','level','skill','part','type','title','instruction','prompt','choices','correctAnswer','pairs','maxScore','autoGrade','rubric','audioUrl','audioName','instructionImageUrl','instructionBlocks','groupId','groupType','groupOrder','groupInstruction','groupAudioPolicy'];
  for(const key of allowed)if(key in patch)question[key]=clone(patch[key]);
  question.updatedAt=nowIso();
  audit(state,user,'update','question',question.id);
  return question;
}

export function softDeleteQuestion(state,user,id){
  const question=byId(state.questions,id);
  if(!question)throw new Error('Không tìm thấy câu hỏi.');
  if(!canDeleteQuestion(user,question))throw new Error(question.locked?'Câu hỏi đã được dùng trong đề đã xuất bản nên không thể xóa.':'Bạn không có quyền xóa câu hỏi này.');
  question.status='trash';
  question.deletedAt=nowIso();
  question.updatedAt=nowIso();
  audit(state,user,'trash','question',id);
  return question;
}

export function restoreQuestion(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ quản trị cấp cao được khôi phục từ thùng rác.');
  const question=byId(state.questions,id);
  if(!question)throw new Error('Không tìm thấy câu hỏi.');
  question.status='active';
  delete question.deletedAt;
  question.updatedAt=nowIso();
  audit(state,user,'restore','question',id);
  return question;
}

export function permanentlyDeleteQuestion(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ quản trị cấp cao được xóa vĩnh viễn.');
  const question=byId(state.questions,id);
  if(!question)throw new Error('Không tìm thấy câu hỏi.');
  const refs=(state.exams||[]).filter(exam=>(exam.sections||[]).some(section=>(section.questionIds||[]).includes(id)));
  if(refs.length)throw new Error('Câu hỏi vẫn đang được dùng trong bài thi. Hãy gỡ câu khỏi các bài thi trước khi xóa vĩnh viễn.');
  state.questions=state.questions.filter(x=>x.id!==id);
  audit(state,user,'delete_forever','question',id);
}
