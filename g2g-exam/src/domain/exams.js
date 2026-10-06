import {APP_CONFIG} from '../config.js';
import {
  clone,uid,nowIso,byId,isTeacher,isMaster,audit,canEditExam
} from './base.js';

function normalizeSection(input={},index=0){
  return {
    id:input.id||uid('sec'),
    name:String(input.name||`Phần ${index+1}`).trim(),
    timeMinutes:Math.max(1,Number(input.timeMinutes||30)),
    maxScore:Math.max(0,Number(input.maxScore||0)),
    showTimer:input.showTimer!==false,
    autoSubmit:input.autoSubmit!==false,
    shuffle:Boolean(input.shuffle),
    questionIds:[...new Set(clone(input.questionIds||[]))],
  };
}

function structuralAttemptExists(state,examId){
  return (state.attempts||[]).some(attempt=>attempt.examId===examId);
}

function assertExamStructureEditable(state,user,exam){
  if(isMaster(user))return;
  if(exam.locked||structuralAttemptExists(state,exam.id)){
    throw new Error('Bài thi đã có học viên bắt đầu làm nên cấu trúc đã được khóa. Hãy tạo bài/phiên bản mới để thay đổi.');
  }
}

export function createExam(state,user,input={}){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo bài thi.');
  const exam={
    id:uid('exam'),
    title:String(input.title||'Bài thi thử mới').trim(),
    level:input.level||'B1',
    provider:['GOETHE','TELC'].includes(String(input.provider||'').toUpperCase())?String(input.provider).toUpperCase():null,
    ownerId:user.id,
    ownerName:user.name,
    status:'draft',
    version:Number(input.version||1),
    passScore:Number(input.passScore||APP_CONFIG.defaultPassScore),
    sections:(input.sections||[]).map(normalizeSection),
    locked:false,
    createdAt:nowIso(),
    updatedAt:nowIso(),
  };
  state.exams.push(exam);
  audit(state,user,'create','exam',exam.id,{title:exam.title});
  return exam;
}

export function updateExam(state,user,id,patch){
  const exam=byId(state.exams,id);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  const structural=['level','provider','passScore','sections','status'].some(key=>key in patch&&patch[key]!==exam[key]);
  if(structural)assertExamStructureEditable(state,user,exam);
  if('title' in patch)exam.title=String(patch.title||'').trim();
  if('level' in patch)exam.level=patch.level;
  if('provider' in patch)exam.provider=['GOETHE','TELC'].includes(String(patch.provider||'').toUpperCase())?String(patch.provider).toUpperCase():null;
  if('passScore' in patch)exam.passScore=Number(patch.passScore||0);
  if('sections' in patch)exam.sections=(patch.sections||[]).map(normalizeSection);
  if('status' in patch)exam.status=patch.status;
  exam.updatedAt=nowIso();
  audit(state,user,'update','exam',id);
  return exam;
}

export function softDeleteExam(state,user,id){
  const exam=byId(state.exams,id);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền xóa bài thi này.');
  exam.status='trash';
  exam.deletedAt=nowIso();
  exam.updatedAt=nowIso();
  audit(state,user,'trash','exam',id);
  return exam;
}

export function restoreExam(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ quản trị cấp cao được khôi phục bài thi.');
  const exam=byId(state.exams,id);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  exam.status='draft';
  delete exam.deletedAt;
  exam.updatedAt=nowIso();
  audit(state,user,'restore','exam',id);
  return exam;
}

export function permanentlyDeleteExam(state,user,id){
  if(!isMaster(user))throw new Error('Chỉ quản trị cấp cao được xóa vĩnh viễn.');
  const exam=byId(state.exams,id);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if((state.attempts||[]).some(attempt=>attempt.examId===id)){
    throw new Error('Bài thi đã có lịch sử làm bài nên không thể xóa vĩnh viễn. Có thể giữ trong Thùng rác để bảo toàn bảng điểm.');
  }
  state.exams=state.exams.filter(x=>x.id!==id);
  audit(state,user,'delete_forever','exam',id);
}

export function addSection(state,user,examId,input={}){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const section=normalizeSection(input,exam.sections.length);
  exam.sections.push(section);
  exam.updatedAt=nowIso();
  audit(state,user,'add_section','exam',examId,{sectionId:section.id});
  return section;
}

export function removeSection(state,user,examId,sectionId){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  if(exam.sections.length<=1)throw new Error('Bài thi phải còn ít nhất một phần.');
  exam.sections=exam.sections.filter(section=>section.id!==sectionId);
  exam.updatedAt=nowIso();
  audit(state,user,'remove_section','exam',examId,{sectionId});
}

export function moveSection(state,user,examId,sectionId,direction){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const index=exam.sections.findIndex(section=>section.id===sectionId);
  if(index<0)throw new Error('Không tìm thấy phần thi.');
  const next=index+(direction==='up'?-1:1);
  if(next<0||next>=exam.sections.length)return exam.sections;
  [exam.sections[index],exam.sections[next]]=[exam.sections[next],exam.sections[index]];
  exam.updatedAt=nowIso();
  audit(state,user,'move_section','exam',examId,{sectionId,direction});
  return exam.sections;
}

export function updateSection(state,user,examId,sectionId,patch){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const section=exam.sections.find(item=>item.id===sectionId);
  if(!section)throw new Error('Không tìm thấy phần thi.');
  const merged=normalizeSection({...section,...patch});
  Object.assign(section,merged,{id:section.id});
  exam.updatedAt=nowIso();
  audit(state,user,'update_section','exam',examId,{sectionId});
  return section;
}

export function addQuestionsToSection(state,user,examId,sectionId,questionIds){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const section=exam.sections.find(item=>item.id===sectionId);
  if(!section)throw new Error('Không tìm thấy phần thi.');
  const valid=new Set((state.questions||[]).filter(q=>q.status!=='trash').map(q=>q.id));
  const merged=[...(section.questionIds||[])];
  for(const id of questionIds||[])if(valid.has(id)&&!merged.includes(id))merged.push(id);
  section.questionIds=merged;
  exam.updatedAt=nowIso();
  audit(state,user,'add_questions','exam',examId,{sectionId,count:(questionIds||[]).length});
  return section;
}

export function removeQuestionFromSection(state,user,examId,sectionId,questionId){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const section=exam.sections.find(item=>item.id===sectionId);
  if(!section)throw new Error('Không tìm thấy phần thi.');
  section.questionIds=(section.questionIds||[]).filter(id=>id!==questionId);
  exam.updatedAt=nowIso();
  audit(state,user,'remove_question','exam',examId,{sectionId,questionId});
}

export function moveQuestion(state,user,examId,sectionId,questionId,direction){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const section=exam.sections.find(item=>item.id===sectionId);
  const index=section?.questionIds.indexOf(questionId)??-1;
  if(index<0)return;
  const next=index+(direction==='up'?-1:1);
  if(next<0||next>=section.questionIds.length)return;
  [section.questionIds[index],section.questionIds[next]]=[section.questionIds[next],section.questionIds[index]];
  exam.updatedAt=nowIso();
  audit(state,user,'move_question','exam',examId,{sectionId,questionId,direction});
}

export function requestGrading(state,user,examId){
  if(!isTeacher(user)||isMaster(user))throw new Error('Chỉ giáo viên mới cần gửi yêu cầu xin chấm.');
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(exam.ownerId===user.id)throw new Error('Bạn là người tạo bài thi nên đã có quyền chấm.');
  let request=(state.gradingRequests||[]).find(item=>item.examId===examId&&item.requesterId===user.id&&item.status==='pending');
  if(request)return request;
  request={
    id:uid('gr'),examId,examTitle:exam.title,ownerId:exam.ownerId,
    requesterId:user.id,requesterName:user.name,status:'pending',
    createdAt:nowIso(),updatedAt:nowIso(),
  };
  state.gradingRequests.push(request);
  audit(state,user,'request_grading','exam',examId);
  return request;
}

export function resolveGradingRequest(state,user,requestId,status){
  const request=byId(state.gradingRequests,requestId);
  if(!request)throw new Error('Không tìm thấy yêu cầu.');
  const exam=byId(state.exams,request.examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!(isMaster(user)||exam.ownerId===user.id))throw new Error('Chỉ giáo viên tạo bài hoặc quản trị cấp cao được duyệt.');
  if(!['approved','rejected'].includes(status))throw new Error('Trạng thái không hợp lệ.');
  request.status=status;
  request.resolvedBy=user.id;
  request.resolvedAt=nowIso();
  request.updatedAt=nowIso();
  audit(state,user,'resolve_grading','request',requestId,{status});
  return request;
}

export function validateExamForPublish(state,exam){
  const errors=[];
  if(!exam?.title?.trim())errors.push('Bài thi chưa có tên.');
  if(!exam?.sections?.length)errors.push('Bài thi chưa có phần nào.');
  const seen=new Set();
  for(const [index,section] of (exam?.sections||[]).entries()){
    if(!section.name?.trim())errors.push(`Phần ${index+1} chưa có tên.`);
    if(!section.questionIds?.length)errors.push(`Phần ${index+1} chưa có câu hỏi.`);
    if(!Number.isFinite(Number(section.timeMinutes))||Number(section.timeMinutes)<=0)errors.push(`Phần ${index+1} có thời gian không hợp lệ.`);
    for(const questionId of section.questionIds||[]){
      const question=byId(state.questions,questionId);
      if(!question||question.status==='trash')errors.push(`Phần ${index+1} chứa câu hỏi không còn hợp lệ.`);
      if(seen.has(questionId))errors.push(`Câu ${question?.code||questionId} đang bị lặp trong cùng bài thi.`);
      seen.add(questionId);
    }
  }
  return [...new Set(errors)];
}

export function publishExam(state,user,examId){
  const exam=byId(state.exams,examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền xuất bản bài thi này.');
  assertExamStructureEditable(state,user,exam);
  const errors=validateExamForPublish(state,exam);
  if(errors.length)throw new Error(errors.join(' '));
  exam.status='published';
  exam.updatedAt=nowIso();
  for(const section of exam.sections||[])for(const questionId of section.questionIds||[]){
    const question=byId(state.questions,questionId);
    if(question){question.locked=true;question.lockedAt||=nowIso();}
  }
  audit(state,user,'publish','exam',examId);
  return exam;
}

export function summarizeExam(exam,state){
  let questions=0,manual=0,max=0;
  for(const section of exam?.sections||[]){
    questions+=section.questionIds?.length||0;
    for(const id of section.questionIds||[]){
      const question=byId(state.questions,id);
      if(question){
        max+=Number(question.maxScore||0);
        if(!question.autoGrade)manual++;
      }
    }
  }
  return {questions,manual,maxScore:max,sections:exam?.sections?.length||0};
}
