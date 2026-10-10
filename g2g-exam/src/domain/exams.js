import {APP_CONFIG} from '../config.js';
import {
  clone,uid,nowIso,byId,isTeacher,isMaster,audit,canEditExam
} from './base.js';
import {getQuestionChoiceError} from './questions.js';
import {imageMaxWidth,isPrefilledQuestion} from './question-display.js';
import {configuredPartErrors} from './configured-part-validation.js';

function normalizeSection(input={},index=0){
  return {
    id:input.id||uid('sec'),
    name:String(input.name||`Phần ${index+1}`).trim(),
    skill:String(input.skill||''),
    skillKey:String(input.skillKey||''),
    templateType:String(input.templateType||'GENERIC'),
    questionProfile:clone(input.questionProfile||null),
    audioPolicy:clone(input.audioPolicy||null),
    instruction:String(input.instruction||''),
    instructionImageUrl:String(input.instructionImageUrl||''),
    instructionImageMaxWidth:imageMaxWidth(input.instructionImageMaxWidth),
    tableHeading:String(input.tableHeading??'Person'),
    questionLimit:Math.max(0,Number(input.questionLimit||0)),
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
  if(!canEditExam(user,exam))throw new Error('Bạn không có quyền chỉnh sửa bài thi này.');
}

export function createExam(state,user,input={}){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo bài thi.');
  const exam={
    id:uid('exam'),
    title:String(input.title||'Bài thi thử mới').trim(),
    level:input.level||'B1',
    learningLevel:input.learningLevel||input.level||'B1',
    hidden:Boolean(input.hidden),
    provider:['GOETHE','TELC'].includes(String(input.provider||'').toUpperCase())?String(input.provider).toUpperCase():null,
    settings:{defaultQuestionScore:Math.max(0,Number(input.settings?.defaultQuestionScore??1)),totalTimeMinutes:Math.max(1,Number(input.settings?.totalTimeMinutes??60)),skillTimes:{...(input.settings?.skillTimes||{})},skillSettings:clone(input.settings?.skillSettings||{})},
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

export function duplicateExam(state,user,sourceId){
  if(!isTeacher(user))throw new Error('Chỉ giáo viên hoặc quản trị viên được nhân bản bài thi.');
  const source=byId(state.exams,sourceId);
  if(!source||source.status==='trash')throw new Error('Không tìm thấy bài thi để nhân bản.');
  let copyNo=1;
  while(state.exams.some(exam=>exam.title===`${source.title} - Copy ${copyNo}`))copyNo++;
  const questionIds=new Map();
  for(const section of source.sections||[])for(const id of section.questionIds||[]){
    if(questionIds.has(id))continue;
    const original=byId(state.questions,id);
    if(!original)throw new Error('Bài thi có câu hỏi không còn tồn tại.');
    const copy={...clone(original),id:uid('q'),code:`${original.code||'Q'}-COPY-${copyNo}`,ownerId:user.id,ownerName:user.name,locked:false,usedCount:0,correctRate:null,status:'active',createdAt:nowIso(),updatedAt:nowIso()};
    delete copy.lockedAt;
    state.questions.push(copy);
    questionIds.set(id,copy.id);
  }
  const sections=(source.sections||[]).map(section=>({...clone(section),id:uid('sec'),questionIds:(section.questionIds||[]).map(id=>questionIds.get(id))}));
  const exam=createExam(state,user,{title:`${source.title} - Copy ${copyNo}`,provider:source.provider,level:source.level,settings:source.settings,hidden:source.hidden,learningLevel:source.learningLevel,passScore:source.passScore,sections});
  exam.copiedFrom=sourceId;
  audit(state,user,'duplicate','exam',exam.id,{sourceId});
  return exam;
}

// Older drafts may still reference a published question. Fork the question,
// never unlock or mutate the original used by an exam or an attempt.
export function detachLockedDraftQuestions(state,user,examId){
  const exam=byId(state.exams,examId);
  if(!exam||exam.status==='trash'||!canEditExam(user,exam))return false;
  const copies=new Map();
  for(const section of exam.sections||[])for(const id of section.questionIds||[]){
    const original=byId(state.questions,id);
    if(!original||copies.has(id)||(!original.locked&&original.ownerId===exam.ownerId))continue;
    const copy={...clone(original),id:uid('q'),ownerId:exam.ownerId,ownerName:exam.ownerName||state.users?.find(u=>u.id===exam.ownerId)?.name||'',locked:false,usedCount:0,correctRate:null,status:'active',createdAt:nowIso(),updatedAt:nowIso()};
    delete copy.lockedAt;
    state.questions.push(copy);copies.set(id,copy.id);
  }
  if(!copies.size)return false;
  for(const section of exam.sections||[])section.questionIds=(section.questionIds||[]).map(id=>copies.get(id)||id);
  exam.updatedAt=nowIso();
  audit(state,user,'detach_draft_questions','exam',examId,{count:copies.size});
  return true;
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
  if('settings' in patch)exam.settings={...exam.settings,...clone(patch.settings)};
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
  if(exam.status!=='trash')throw new Error('Chỉ xóa vĩnh viễn đề trong Thùng rác.');
  const removed=new Set((state.attempts||[]).filter(a=>a.examId===id).map(a=>a.id));
  state.attempts=(state.attempts||[]).filter(a=>a.examId!==id);
  state.notifications=(state.notifications||[]).filter(n=>!removed.has(n.attemptId));
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
  delete section.instructionAudioUrl;delete section.instructionAudioName;
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

export function validateExamForPublish(state,exam){
  const errors=[];
  if(!exam?.title?.trim())errors.push('Bài thi chưa có tên.');
  if(!exam?.sections?.length)errors.push('Bài thi chưa có phần nào.');
  const seen=new Set();
  for(const [index,section] of (exam?.sections||[]).entries()){
    errors.push(...configuredPartErrors(section,state.questions));
    if(!section.name?.trim())errors.push(`Phần ${index+1} chưa có tên.`);
    const realQuestionIds=(section.questionIds||[]).filter(questionId=>!isPrefilledQuestion(byId(state.questions,questionId)));
    if(!realQuestionIds.length)errors.push(`Phần ${index+1} chưa có câu hỏi tính điểm.`);
    if(!Number.isFinite(Number(section.timeMinutes))||Number(section.timeMinutes)<=0)errors.push(`Phần ${index+1} có thời gian không hợp lệ.`);
    for(const questionId of section.questionIds||[]){
      const question=byId(state.questions,questionId);
      if(!question||question.status==='trash')errors.push(`Phần ${index+1} chứa câu hỏi không còn hợp lệ.`);
      else{
        const choiceError=getQuestionChoiceError(question);
        if(choiceError)errors.push(`Câu ${question.code||questionId}: ${choiceError}`);
      }
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
  // Publishing does not remove the owner's edit rights. Attempts use snapshots.
  audit(state,user,'publish','exam',examId);
  return exam;
}

export function summarizeExam(exam,state){
  let questions=0,manual=0,max=0;
  for(const section of exam?.sections||[]){
    for(const id of section.questionIds||[]){
      const question=byId(state.questions,id);
      if(question&&!isPrefilledQuestion(question)){
        questions++;
        max+=Number(question.maxScore||0);
        if(!question.autoGrade)manual++;
      }
    }
  }
  return {questions,manual,maxScore:max,sections:exam?.sections?.length||0};
}
