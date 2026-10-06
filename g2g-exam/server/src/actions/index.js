import {appError} from '../db.js';
import {isTeacher} from './shared.js';
import {startAttempt,saveAnswers,setAttemptSection,abandonAttempt,submitAttempt} from './attempts.js';
import {saveManualGrade,publishAttemptResult,deliverResultEmail} from './grading.js';
import {updateSystemSettings,updateSmtpSecret,testSmtp,getInfrastructureStatus,setUserRole} from './settings.js';

export async function handleAction(user,name,data={}){
  switch(name){
    case 'startAttemptSecure': return startAttempt(user,data);
    case 'saveAnswers': return saveAnswers(user,data);
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
    default: throw appError(404,'Thao tác máy chủ không tồn tại.');
  }
}
