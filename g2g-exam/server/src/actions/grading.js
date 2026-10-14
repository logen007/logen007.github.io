import {query,withTx,audit,now,uid,appError} from '../db.js';
import {sendConfiguredMail} from '../mail.js';
import {isTeacher,attemptExam,canGrade,questionMap} from './shared.js';
import {isAutomaticWritingForm,scoreWritingForm} from '../writing-form.js';
import {finalizeOutcome} from '../result-outcome.js';
import {resultSummary} from '../../../src/domain/result-summary.js';
import {manualGroups} from '../../../src/domain/manual-grading.js';
import {queueWritingAiJobs,wakeWritingAiWorker} from '../writing-ai-queue.js';
import {createJobPump} from '../job-pump.js';

export async function saveManualGrade(user,{attemptId,scores={},feedback=''}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được chấm bài.');
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    const exam=await attemptExam(attempt,client);
    if(!(await canGrade(user,exam)))throw appError(403,'Bạn chưa được cấp quyền chấm bài này.');
    if(!['grading','ready','published'].includes(attempt.status))throw appError(409,'Bài không ở trạng thái chấm.');

    const questions=await questionMap(exam),limits=Object.fromEntries(manualGroups(exam,questions).map(group=>[group.key,group.max]));
    const previous=attempt.private_data||{},clean={...(previous.manualScores||{})};
    const sectionScores={...(previous.sectionScores||{})};
    let autoScore=Number(previous.autoScore||0);
    if(!previous.scoringVersion){
      for(const section of exam.sections||[])for(const id of section.questionIds||[]){
        const question=questions.get(id);
        if(question?.example)continue;
        if(!isAutomaticWritingForm(exam,section,question))continue;
        const score=scoreWritingForm(question.rubric,attempt.public_data.answers?.[id]);
        sectionScores[section.name]=Number((Number(sectionScores[section.name]||0)+score).toFixed(2));
        autoScore=Number((autoScore+score).toFixed(2));
      }
    }
    for(const [skill,value] of Object.entries(scores||{})){
      if(!(skill in limits))continue;
      const score=Number(value);
      if(!Number.isFinite(score)||score<0||score>limits[skill])throw appError(400,`Điểm ${skill} phải nằm trong khoảng 0–${limits[skill]}.`);
      clean[skill]=score;
    }

    const complete=Object.keys(limits).every(skill=>Number.isFinite(Number(clean[skill])));
    const aiWritingAccuracy={};
    const suggestions=previous.aiWritingSuggestions||{};
    for(const group of manualGroups(exam,questions)){
      if(group.questions.length!==1)continue;
      const question=group.questions[0],suggestion=suggestions[question.id],teacherScore=Number(clean[group.key]);
      if(suggestion?.status!=='completed'||!Number.isFinite(Number(suggestion.suggestedScore))||!Number.isFinite(teacherScore))continue;
      const suggestedScore=Number(suggestion.suggestedScore);
      aiWritingAccuracy[question.id]={questionId:question.id,part:group.key,provider:String(suggestion.model||'unknown'),suggestedScore,teacherScore,accurate:Math.abs(suggestedScore-teacherScore)<0.000001,comparedAt:now()};
    }
    const summary=resultSummary(exam,questions,{...previous,sectionScores,manualScores:clean,scoringVersion:2});
    const totalScore=complete?summary.total:null;
    const resultText=complete?summary.result:null;
    const status=attempt.status==='published'?'published':complete?'ready':'grading';
    const at=now();
    const privateData={
      ...previous,autoScore,sectionScores,scoringVersion:2,manualScores:clean,aiWritingAccuracy,feedback:String(feedback||''),
      reviewerId:user.id,reviewerName:user.name||'',totalScore,result:resultText,updatedAt:at,
    };
    const publicData={...attempt.public_data,status,updatedAt:at,...(status==='published'?{totalScore,manualScores:clean,sectionScores,result:resultText,feedback:String(feedback||'')}:{})};
    await client.query(`UPDATE attempts SET status=$2,public_data=$3::jsonb,private_data=$4::jsonb,updated_at=now() WHERE id=$1`,[attemptId,status,JSON.stringify(publicData),JSON.stringify(privateData)]);
    await audit(user,'save_grade','attempt',attemptId,{complete,status},client);
    return {status,totalScore};
  });
}

export async function suggestWritingGradeForAttempt(user,{attemptId,questionId}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được dùng gợi ý chấm AI.');
  const result=await query(`SELECT * FROM attempts WHERE id=$1`,[attemptId]);
  if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
  const attempt=result.rows[0],exam=await attemptExam(attempt);
  if(!(await canGrade(user,exam)))throw appError(403,'Bạn chưa được cấp quyền chấm bài này.');
  if(!['grading','ready'].includes(attempt.status))throw appError(409,'Bài không ở trạng thái chấm.');
  const question=(await questionMap(exam)).get(questionId);
  if(!question||(question.type!=='writing')||question.writingFormVersion===1)throw appError(400,'Chỉ hỗ trợ gợi ý cho bài viết tự do.');
  if(!String(question.aiGradingRules||'').trim())throw appError(409,'Bài này chưa có quy tắc chấm AI.');
  if(!String(attempt.public_data?.answers?.[questionId]||'').trim())throw appError(409,'Học viên chưa có bài viết để AI xem.');
  const suggestion=attempt.private_data?.aiWritingSuggestions?.[questionId];
  if(suggestion?.status==='completed')return suggestion;
  await withTx(client=>queueWritingAiJobs(client,attempt,{sections:[{questionIds:[questionId]}]},new Map([[questionId,question]])));
  wakeWritingAiWorker();
  return {status:'queued'};
}

export async function deliverResultEmail(attemptId,id=`result-${attemptId}`){
  const claim=await withTx(async client=>{
    const result=await client.query(`SELECT * FROM notifications WHERE id=$1 FOR UPDATE`,[id]);
    if(!result.rowCount)return null;
    const notification=result.rows[0];
    if(['sent','email_disabled','no_email'].includes(notification.status))return null;
    if(notification.status==='sending'&&Date.now()-Date.parse(notification.updated_at)<120000)return null;
    await client.query(`UPDATE notifications SET status='sending',updated_at=now() WHERE id=$1`,[id]);
    return notification.data;
  });
  if(!claim)return {status:'skipped'};

  try{
    const sent=await sendConfiguredMail({to:claim.to,subject:claim.subject,text:claim.text,html:claim.html});
    await query(`UPDATE notifications SET status='sent',data=data||$2::jsonb,updated_at=now() WHERE id=$1`,[id,JSON.stringify({messageId:sent.messageId,sentAt:now()})]);
    return {status:'sent'};
  }catch(error){
    await query(`UPDATE notifications SET status='failed',data=data||$2::jsonb,updated_at=now() WHERE id=$1`,[id,JSON.stringify({lastError:String(error.message).slice(0,500),failedAt:now()})]);
    return {status:'failed',error:error.message};
  }
}

export async function publishAttemptResult(user,{attemptId}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được công bố kết quả.');
  const out=await withTx(async client=>{
    const result=await client.query('SELECT * FROM attempts WHERE id=$1 FOR UPDATE',[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0],exam=await attemptExam(attempt,client);
    if(!(await canGrade(user,exam)))throw appError(403,'Không có quyền công bố kết quả.');
    const republished=attempt.status==='published';
    if(!['ready','published'].includes(attempt.status))throw appError(409,'Bài chưa được chấm đủ.');
    const marks=attempt.private_data||{};
    if(marks.totalScore==null||!Number.isFinite(Number(marks.totalScore)))throw appError(409,'Bài chưa có tổng điểm hợp lệ.');
    const {patch,notificationStatus}=await finalizeOutcome(client,attempt,exam,marks,user,republished?{notificationId:uid('result')}:{});
    const publicData={...attempt.public_data,status:'published',publishedAt:now(),updatedAt:now(),
      autoScore:Number(marks.autoScore||0),manualScores:marks.manualScores||{},scoringVersion:marks.scoringVersion,
      sectionScores:marks.sectionScores||{},oralScore:marks.oralScore,oralMax:marks.oralMax,
      reviewerId:user.id,reviewerName:user.name||'',feedback:marks.feedback||'',...patch};
    await client.query('UPDATE attempts SET status=\'published\',public_data=$2::jsonb,private_data=private_data||$3::jsonb,updated_at=now() WHERE id=$1',[attemptId,JSON.stringify(publicData),JSON.stringify(patch)]);
    await audit(user,'publish_result','attempt',attemptId,{studentId:attempt.student_id,notificationStatus,republished},client);
    return {alreadyPublished:false,republished,notificationStatus};
  });
  // The publication transaction is durable. SMTP latency must not block the
  // teacher; failures stay recorded on the notification for retry/inspection.
  return {status:'published',...out,email:{status:'queued'}};
}

export function startResultEmailWorker(logger){
  const pump=createJobPump({concurrency:1,claim:async()=>{
    return (await query(`SELECT id,attempt_id FROM notifications
      WHERE status='queued' OR (status='sending' AND updated_at<now()-interval '2 minutes')
        OR (status='failed' AND updated_at<now()-interval '15 minutes')
      ORDER BY created_at LIMIT 1`)).rows[0];
  },processJob:job=>deliverResultEmail(job.attempt_id,job.id),onError:error=>logger?.error?.({err:error},'Result email worker failed')});
  const timer=setInterval(()=>void pump.tick(),5000);timer.unref();void pump.tick();
  return ()=>{pump.stop();clearInterval(timer);};
}
