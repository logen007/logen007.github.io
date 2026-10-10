import {appError,query} from '../db.js';
import {copyExam} from './exam-copy.js';
import {emptyTrash} from '../trash-gc.js';
import {isTeacher} from './shared.js';
import {saveClass,saveStudentProfile,saveStudentName} from './classes.js';
import {verifyClassCode,enrollInClass} from './class-enrollment.js';
import {saveOralScore} from './oral.js';
import {saveExamAccess,listExamCodes,createExamCode,acknowledgePromotion} from './exam-access.js';
import {startAttempt,saveAnswers,startPartAudio,completePartAudio,setAttemptSection,abandonAttempt,submitAttempt} from './attempts.js';
import {saveManualGrade,publishAttemptResult,deliverResultEmail} from './grading.js';
import {updateSystemSettings,updateSmtpSecret,testSmtp,getInfrastructureStatus,setUserRole,setTeacherByEmail} from './settings.js';

export async function handleAction(user,name,data={}){
  switch(name){
    case 'emptyTrash': return emptyTrash(user);
    case 'copyExam': return copyExam(user,data);
    case 'saveExamAccess': return saveExamAccess(user,data);
    case 'listExamCodes': return listExamCodes(user,data);
    case 'createExamCode': return createExamCode(user,data);
    case 'acknowledgePromotion': return acknowledgePromotion(user,data);
    case 'saveClass': return saveClass(user,data);
    case 'saveStudentProfile': return saveStudentProfile(user,data);
    case 'saveStudentName': return saveStudentName(user,data);
    case 'verifyClassCode': return verifyClassCode(user,data);
    case 'enrollInClass': return enrollInClass(user,data);
    case 'saveOralScore': return saveOralScore(user,data);
    case 'getAttemptReview': {
      const found=await query(`SELECT public_data,private_data,status,student_id,exam_id FROM attempts WHERE id=$1`,[data.attemptId]);
      if(!found.rowCount||found.rows[0].student_id!==user.id)throw appError(404,'Không tìm thấy bài làm.');
      const row=found.rows[0];
      const exam=await query(`SELECT data FROM exams WHERE id=$1`,[row.exam_id]);
      const examData=row.private_data?.examSnapshot||exam.rows[0]?.data||{};
      const ids=[...new Set((examData.sections||[]).flatMap(section=>section.questionIds||[]))];
      const questions=examData.questionSnapshot?{rows:examData.questionSnapshot.map(q=>({id:q.id,data:q}))}:ids.length?await query(`SELECT id,data FROM questions WHERE id=ANY($1::text[])`,[ids]):{rows:[]};
      const published=row.status==='published';
      return {attempt:row.public_data,sections:(examData.sections||[]).map(section=>({name:section.name,questions:(section.questionIds||[]).map(id=>{
        const question=questions.rows.find(q=>q.id===id);
        if(!question)return null;
        const q=question.data||{};
        return {id,title:q.title||q.prompt||'',type:q.type||'',answer:row.public_data.answers?.[id],correct:published?(q.writingFormVersion===1?null:q.correctAnswer):null,choices:(q.choices||[]).map(choice=>({text:typeof choice==='object'?String(choice.text||''):String(choice||'')})),fields:q.writingFormVersion===1?(q.rubric||[]).map((field,index)=>({index,label:field.label||'',type:field.type||'text',expected:published?field.answers||field.options?.[field.correctIndex]||'':null})):[]};
      }).filter(Boolean)})),score:published?{summary:row.private_data.resultSummary,promotion:row.private_data.promotion,total:row.private_data.totalScore,sections:row.private_data.sectionScores,feedback:row.private_data.feedback,result:row.private_data.result,reviewerName:row.public_data.reviewerName}:null};
    }
    case 'startAttemptSecure': return startAttempt(user,data);
    case 'saveAnswers': return saveAnswers(user,data);
    case 'startPartAudio': return startPartAudio(user,data);
    case 'completePartAudio': return completePartAudio(user,data);
    case 'setAttemptSectionSecure': return setAttemptSection(user,data);
    case 'abandonAttemptSecure': return abandonAttempt(user,data);
    case 'submitAttempt': return submitAttempt(user,data);
    case 'saveManualGrade': return saveManualGrade(user,data);
    case 'publishAttemptResult': return publishAttemptResult(user,data);
    case 'retryResultEmail':
      if(!isTeacher(user))throw appError(403,'Không có quyền gửi lại email.');
      return deliverResultEmail(data.attemptId);
    case 'updateSystemSettings': return updateSystemSettings(user,data);
    case 'updateSmtpSecret': return updateSmtpSecret(user,data);
    case 'testSmtp': return testSmtp(user,data);
    case 'getInfrastructureStatus': return getInfrastructureStatus(user);
    case 'setUserRole': return setUserRole(user,data);
    case 'setTeacherByEmail': return setTeacherByEmail(user,data);
    default: throw appError(404,'Thao tác máy chủ không tồn tại.');
  }
}
