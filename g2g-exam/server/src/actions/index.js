import {appError} from '../db.js';
import {getAttemptReview} from './attempt-review.js';
import {r2Settings} from '../r2-settings.js';
import {submitFeedback} from './feedback.js';
import {copyExam,prepareExamForEditing} from './exam-copy.js';
import {emptyTrash} from '../trash-gc.js';
import {isTeacher} from './shared.js';
import {saveClass,saveStudentProfile,saveStudentName,saveAccountName} from './classes.js';
import {verifyClassCode,enrollInClass} from './class-enrollment.js';
import {saveOralScore} from './oral.js';
import {saveExamAccess,listExamCodes,createExamCode,acknowledgePromotion} from './exam-access.js';
import {startAttempt,saveAnswers,startPartAudio,completePartAudio,setAttemptSection,abandonAttempt,submitAttempt} from './attempts.js';
import {saveManualGrade,publishAttemptResult,deliverResultEmail} from './grading.js';
import {updateSystemSettings,updateSmtpSecret,testSmtp,getInfrastructureStatus,setUserRole,setTeacherByEmail} from './settings.js';

export async function handleAction(user,name,data={}){
  switch(name){
    case 'getR2Settings':
    case 'saveR2Settings':
    case 'testR2Settings': return r2Settings.action(user,name,data);
    case 'submitFeedback': return submitFeedback(user,data);
    case 'emptyTrash': return emptyTrash(user);
    case 'copyExam': return copyExam(user,data);
    case 'prepareExamForEditing': return prepareExamForEditing(user,data);
    case 'saveExamAccess': return saveExamAccess(user,data);
    case 'listExamCodes': return listExamCodes(user,data);
    case 'createExamCode': return createExamCode(user,data);
    case 'acknowledgePromotion': return acknowledgePromotion(user,data);
    case 'saveClass': return saveClass(user,data);
    case 'saveStudentProfile': return saveStudentProfile(user,data);
    case 'saveStudentName': return saveStudentName(user,data);
    case 'saveAccountName': return saveAccountName(user,data);
    case 'verifyClassCode': return verifyClassCode(user,data);
    case 'enrollInClass': return enrollInClass(user,data);
    case 'saveOralScore': return saveOralScore(user,data);
    case 'getAttemptReview': return getAttemptReview(user,data);
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
    case 'getInfrastructureStatus': return getInfrastructureStatus(user,data);
    case 'setUserRole': return setUserRole(user,data);
    case 'setTeacherByEmail': return setTeacherByEmail(user,data);
    default: throw appError(404,'Thao tác máy chủ không tồn tại.');
  }
}
