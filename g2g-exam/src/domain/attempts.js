import {
  ATTEMPT_STATUS,clone,uid,nowIso,byId,isStudent,audit,
  canGradeExam,canPublishExamResult
} from './base.js';
import {isAutomaticWritingForm,scoreWritingForm} from './writing-form.js';
import {skillScores,examResult} from './gradebook.js';
import {examDeadlineMs,submissionTiming} from './exam-clock.js';

function questionScore(question,answer){
  if(!question?.autoGrade||question.example)return 0;
  if(['single','truefalse','cloze'].includes(question.type)){
    return Number(answer)===Number(question.correctAnswer)?Number(question.maxScore||0):0;
  }
  if(question.type==='matching'){
    if(!Array.isArray(answer)||!Array.isArray(question.pairs)||!question.pairs.length)return 0;
    let correct=0;
    question.pairs.forEach((pair,index)=>{if(answer[index]===pair[1])correct++;});
    return Math.round((correct/question.pairs.length)*Number(question.maxScore||0)*100)/100;
  }
  return 0;
}

function startSectionClock(attempt,exam,index){
  const section=exam.sections?.[index];
  if(!section)return;
  attempt.sectionStates||={};
  if(!attempt.sectionStates[section.id]){
    const startedAt=nowIso();
    attempt.examDeadlineMs=examDeadlineMs(attempt,exam);
    attempt.sectionStates[section.id]={startedAt,deadlineAt:new Date(attempt.examDeadlineMs).toISOString()};
  }
}

export function getSectionRemainingSeconds(attempt,exam,index=attempt?.currentSectionIndex||0){
  return Math.max(0,Math.ceil((examDeadlineMs(attempt,exam)-Date.now())/1000));
}

export function startAttempt(state,user,examId,{restart=false}={}){
  if(!isStudent(user))throw new Error('Chỉ học viên mới được bắt đầu bài thi.');
  const exam=byId(state.exams,examId);
  if(!exam||exam.status!=='published')throw new Error('Bài thi chưa mở cho học viên.');
  const current=(state.attempts||[]).find(attempt=>attempt.examId===examId&&attempt.studentId===user.id&&attempt.status===ATTEMPT_STATUS.IN_PROGRESS);
  if(current)state.attempts.splice(state.attempts.indexOf(current),1);
  const attemptNo=1+Math.max(0,...(state.attempts||[]).filter(attempt=>attempt.examId===examId&&attempt.studentId===user.id&&!([ATTEMPT_STATUS.IN_PROGRESS,ATTEMPT_STATUS.ABANDONED].includes(attempt.status))).map(attempt=>Number(attempt.attemptNo||0)));
  exam.locked=true;
  exam.lockedAt||=nowIso();
  const attempt={
    id:uid('att'),examId,examTitle:exam.title,examVersion:exam.version||1,
    studentId:user.id,studentName:user.name,studentEmail:user.email,attemptNo,
    status:ATTEMPT_STATUS.IN_PROGRESS,startedAt:nowIso(),updatedAt:nowIso(),
    currentSectionIndex:0,sectionStates:{},answers:{},autoScore:0,manualScores:{},
    sectionScores:{},totalScore:null,result:null,reviewerId:null,reviewerName:null,
    feedback:'',publishedAt:null,
  };
  startSectionClock(attempt,exam,0);
  state.attempts.push(attempt);
  audit(state,user,'start_attempt','attempt',attempt.id,{examId,restart});
  return attempt;
}

export function saveAnswer(state,user,attemptId,questionId,answer){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt)throw new Error('Không tìm thấy lượt thi.');
  if(attempt.studentId!==user.id||!isStudent(user))throw new Error('Bạn không có quyền sửa lượt thi này.');
  if(attempt.status!==ATTEMPT_STATUS.IN_PROGRESS)throw new Error('Lượt thi này đã được nộp.');
  const exam=byId(state.exams,attempt.examId);
  const sectionIndex=(exam?.sections||[]).findIndex(section=>(section.questionIds||[]).includes(questionId));
  if(sectionIndex>=0&&exam.sections[sectionIndex].autoSubmit!==false&&getSectionRemainingSeconds(attempt,exam,sectionIndex)<=0){
    throw new Error('Phần thi này đã hết thời gian.');
  }
  attempt.answers[questionId]=clone(answer);
  attempt.updatedAt=nowIso();
  return attempt;
}

export function setAttemptSection(state,user,attemptId,index){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt||attempt.studentId!==user.id||!isStudent(user))throw new Error('Không tìm thấy lượt thi.');
  if(attempt.status!==ATTEMPT_STATUS.IN_PROGRESS)throw new Error('Lượt thi này đã được nộp.');
  const exam=byId(state.exams,attempt.examId);
  const safe=Math.min(Math.max(0,Number(index)||0),Math.max(0,(exam?.sections?.length||1)-1));
  attempt.currentSectionIndex=safe;
  startSectionClock(attempt,exam,safe);
  attempt.updatedAt=nowIso();
  return attempt;
}

export function abandonAttempt(state,user,attemptId){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt)throw new Error('Không tìm thấy lượt thi.');
  if(!isStudent(user)||attempt.studentId!==user.id)throw new Error('Bạn không có quyền kết thúc lượt thi này.');
  audit(state,user,'abandon_attempt','attempt',attempt.id);
  if(attempt.status===ATTEMPT_STATUS.IN_PROGRESS)state.attempts.splice(state.attempts.indexOf(attempt),1);
  return {id:attempt.id,status:ATTEMPT_STATUS.ABANDONED,deleted:true};
}

export function resultBySkill(state,exam,sectionScores={},manualScores={}){
  return examResult(exam,skillScores(exam,state.questions,{sectionScores,manualScores,scoringVersion:2}));
}

export function calculateAutomaticScores(state,attempt){
  const exam=byId(state.exams,attempt.examId);
  if(!exam)throw new Error('Không tìm thấy bài thi.');
  const sectionScores={};
  let total=0;
  for(const section of exam.sections||[]){
    let sectionScore=0;
    for(const questionId of section.questionIds||[]){
      const question=byId(state.questions,questionId);
      if(question?.example)continue;
      if(isAutomaticWritingForm(exam,section,question))sectionScore+=scoreWritingForm(question.rubric,attempt.answers?.[questionId]);
      else if(question?.autoGrade)sectionScore+=questionScore(question,attempt.answers?.[questionId]);
    }
    sectionScores[section.name]=Math.round(sectionScore*100)/100;
    total+=sectionScore;
  }
  return {autoScore:Math.round(total*100)/100,sectionScores};
}

export function hasManualQuestions(state,exam){
  return (exam.sections||[]).some(section=>(section.questionIds||[]).some(questionId=>{const question=byId(state.questions,questionId);return question&&!question.example&&!question.autoGrade&&!isAutomaticWritingForm(exam,section,question);}));
}

export function submitAttempt(state,user,attemptId){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt)throw new Error('Không tìm thấy lượt thi.');
  if(!isStudent(user)||attempt.studentId!==user.id)throw new Error('Bạn không có quyền nộp lượt thi này.');
  if(attempt.status!==ATTEMPT_STATUS.IN_PROGRESS)return attempt;
  const exam=byId(state.exams,attempt.examId);
  const score=calculateAutomaticScores(state,attempt);
  attempt.autoScore=score.autoScore;
  attempt.sectionScores=score.sectionScores;
  attempt.scoringVersion=2;
  attempt.status=hasManualQuestions(state,exam)?ATTEMPT_STATUS.GRADING:ATTEMPT_STATUS.READY;
  attempt.submittedAt=nowIso();
  Object.assign(attempt,submissionTiming(attempt,exam));
  attempt.updatedAt=nowIso();
  if(attempt.status===ATTEMPT_STATUS.READY){
    attempt.totalScore=attempt.autoScore;
    attempt.result=resultBySkill(state,exam,attempt.sectionScores,attempt.manualScores);
  }
  audit(state,user,'submit_attempt','attempt',attempt.id);
  return attempt;
}

function manualLimits(state,exam){
  const limits={};
  for(const section of exam.sections||[])for(const id of section.questionIds||[]){
    const question=byId(state.questions,id);
    if(question&&!question.example&&!question.autoGrade&&!isAutomaticWritingForm(exam,section,question))limits[question.skill]=(limits[question.skill]||0)+Number(question.maxScore||0);
  }
  return limits;
}

export function saveManualScore(state,user,attemptId,payload={}){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt)throw new Error('Không tìm thấy lượt thi.');
  const exam=attempt.examSnapshot||byId(state.exams,attempt.examId);
  if(exam.questionSnapshot)state={...state,questions:exam.questionSnapshot};
  if(!canGradeExam(state,user,exam))throw new Error('Bạn chưa có quyền chấm bài thi này.');
  if(![ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(attempt.status))throw new Error('Bài này không ở trạng thái chấm.');
  if(!attempt.scoringVersion){
    attempt.sectionScores||={};
    for(const section of exam.sections||[])for(const id of section.questionIds||[]){
      const question=byId(state.questions,id);
      if(!isAutomaticWritingForm(exam,section,question))continue;
      const score=scoreWritingForm(question.rubric,attempt.answers?.[id]);
      attempt.sectionScores[section.name]=Number((Number(attempt.sectionScores[section.name]||0)+score).toFixed(2));
      attempt.autoScore=Number((Number(attempt.autoScore||0)+score).toFixed(2));
    }
    attempt.scoringVersion=2;
  }
  const limits=manualLimits(state,exam),next={...attempt.manualScores};
  for(const [skill,value] of Object.entries(payload.scores||{})){
    if(!(skill in limits))continue;
    const score=Number(value);
    if(!Number.isFinite(score)||score<0||score>limits[skill])throw new Error(`Điểm ${skill} phải nằm trong khoảng 0–${limits[skill]}.`);
    next[skill]=score;
  }
  attempt.manualScores=next;
  if(payload.rubrics)attempt.rubrics={...(attempt.rubrics||{}),...clone(payload.rubrics)};
  if('feedback' in payload)attempt.feedback=String(payload.feedback||'');
  attempt.reviewerId=user.id;
  attempt.reviewerName=user.name;
  attempt.updatedAt=nowIso();
  const complete=Object.keys(limits).every(skill=>Number.isFinite(Number(attempt.manualScores[skill])));
  if(complete){
    attempt.totalScore=Number(attempt.autoScore||0)+Object.values(attempt.manualScores).reduce((sum,n)=>sum+(Number(n)||0),0);
    attempt.result=resultBySkill(state,exam,attempt.sectionScores,attempt.manualScores);
    attempt.status=ATTEMPT_STATUS.READY;
  }else{
    attempt.totalScore=null;
    attempt.result=null;
    attempt.status=ATTEMPT_STATUS.GRADING;
  }
  audit(state,user,'save_grade','attempt',attemptId,{complete});
  return attempt;
}

export function publishAttempt(state,user,attemptId){
  const attempt=byId(state.attempts,attemptId);
  if(!attempt)throw new Error('Không tìm thấy lượt thi.');
  const exam=byId(state.exams,attempt.examId);
  if(!canPublishExamResult(user,exam))throw new Error('Bạn không có quyền công bố kết quả.');
  if(attempt.status!==ATTEMPT_STATUS.READY)throw new Error('Bài thi chưa được chấm đủ để công bố.');
  attempt.status=ATTEMPT_STATUS.PUBLISHED;
  attempt.publishedAt=nowIso();
  attempt.updatedAt=nowIso();
  attempt.reviewerId=user.id;
  attempt.reviewerName=user.name;
  const notification={
    id:uid('notify'),type:'result_published',status:'queued',to:attempt.studentEmail,
    studentId:attempt.studentId,attemptId:attempt.id,
    subject:`G2G – Đã có kết quả ${attempt.examTitle}`,
    body:'Kết quả của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.',
    createdAt:nowIso(),
  };
  state.notifications.push(notification);
  audit(state,user,'publish_result','attempt',attemptId,{notificationId:notification.id});
  return attempt;
}

export function getStudentAttempts(state,studentId){
  return (state.attempts||[]).filter(attempt=>attempt.studentId===studentId&&attempt.status!==ATTEMPT_STATUS.ABANDONED).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
}

export function visibleStudentAttempt(attempt){
  return attempt.status===ATTEMPT_STATUS.PUBLISHED
    ? clone(attempt)
    : {...clone(attempt),autoScore:null,totalScore:null,result:null,sectionScores:{},manualScores:{},reviewerId:null,reviewerName:null,feedback:'',rubrics:{}};
}

export function getStudentResults(state,studentId){
  return getStudentAttempts(state,studentId).filter(attempt=>attempt.status!==ATTEMPT_STATUS.IN_PROGRESS).map(visibleStudentAttempt);
}

export function getLatestPublishedAttempt(state,studentId){
  return getStudentAttempts(state,studentId).find(attempt=>attempt.status===ATTEMPT_STATUS.PUBLISHED)||null;
}

export function getBestPublishedAttempt(state,studentId){
  return getStudentAttempts(state,studentId)
    .filter(attempt=>attempt.status===ATTEMPT_STATUS.PUBLISHED)
    .sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0]||null;
}

export function gradebookRows(state,mode='best'){
  const students=(state.users||[]).filter(user=>user.role==='student'&&user.active!==false),rows=[];
  for(const student of students){
    const attempts=getStudentAttempts(state,student.id),published=attempts.filter(attempt=>attempt.status===ATTEMPT_STATUS.PUBLISHED);
    let chosen=null;
    if(mode==='latest')chosen=published[0]||null;
    else chosen=[...published].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0]||null;
    rows.push({user:student,attempt:chosen,attempts});
  }
  return rows;
}

export function pendingGradingAttempts(state,user){
  return (state.attempts||[])
    .filter(attempt=>[ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(attempt.status))
    .filter(attempt=>canGradeExam(state,user,byId(state.exams,attempt.examId)));
}
