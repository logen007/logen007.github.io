import {query,withTx,getSettings,audit,now,appError} from '../db.js';
import {sendConfiguredMail,renderTemplate} from '../mail.js';
import {isTeacher,examById,canGrade,questionMap,resultFor} from './shared.js';
import {isAutomaticWritingForm,scoreWritingForm} from '../writing-form.js';

export async function saveManualGrade(user,{attemptId,scores={},feedback=''}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được chấm bài.');
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    const exam=await examById(attempt.exam_id,client);
    if(!(await canGrade(user,exam)))throw appError(403,'Bạn chưa được cấp quyền chấm bài này.');
    if(!['grading','ready'].includes(attempt.status))throw appError(409,'Bài không ở trạng thái chấm.');

    const questions=await questionMap(exam),limits={};
    for(const section of exam.sections||[])for(const id of section.questionIds||[]){
      const question=questions.get(id);
      if(question&&!question.example&&!question.autoGrade&&!isAutomaticWritingForm(exam,section,question))limits[question.skill]=(limits[question.skill]||0)+Number(question.maxScore||0);
    }
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
    const manualTotal=Object.values(clean).reduce((sum,n)=>sum+(Number(n)||0),0);
    const totalScore=complete?autoScore+manualTotal:null;
    const resultText=complete?resultFor(exam,totalScore):null;
    const status=complete?'ready':'grading';
    const at=now();
    const privateData={
      ...previous,autoScore,sectionScores,scoringVersion:2,manualScores:clean,feedback:String(feedback||''),
      reviewerId:user.id,reviewerName:user.name||'',totalScore,result:resultText,updatedAt:at,
    };
    const publicData={...attempt.public_data,status,updatedAt:at};
    await client.query(`UPDATE attempts SET status=$2,public_data=$3::jsonb,private_data=$4::jsonb,updated_at=now() WHERE id=$1`,[attemptId,status,JSON.stringify(publicData),JSON.stringify(privateData)]);
    await audit(user,'save_grade','attempt',attemptId,{complete,status},client);
    return {status,totalScore};
  });
}

export async function deliverResultEmail(attemptId){
  const id=`result-${attemptId}`;
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
  const settings=await getSettings();
  const out=await withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    const exam=await examById(attempt.exam_id,client);
    if(!(await canGrade(user,exam)))throw appError(403,'Không có quyền công bố kết quả.');
    if(attempt.status==='published')return {alreadyPublished:true};
    if(attempt.status!=='ready')throw appError(409,'Bài chưa được chấm đủ.');

    const privateData=attempt.private_data||{};
    if(!Number.isFinite(Number(privateData.totalScore)))throw appError(409,'Bài chưa có tổng điểm hợp lệ.');
    const at=now();
    const vars={
      exam:attempt.public_data.examTitle||exam.title,
      student:attempt.public_data.studentName||'học viên',
      score:String(privateData.totalScore),
      result:String(privateData.result||''),
      url:settings.general.publicUrl,
    };
    const publicData={
      ...attempt.public_data,status:'published',publishedAt:at,updatedAt:at,
      autoScore:Number(privateData.autoScore||0),manualScores:privateData.manualScores||{},
      sectionScores:privateData.sectionScores||{},totalScore:Number(privateData.totalScore),
      result:privateData.result||'',reviewerId:user.id,
      reviewerName:user.name||'',feedback:privateData.feedback||'',
    };
    const emailOn=Boolean(settings.email.enabled&&settings.smtp.enabled);
    const to=attempt.public_data.studentEmail||'';
    const notificationStatus=!emailOn?'email_disabled':to?'queued':'no_email';
    const notificationData={
      type:'result_published',to,studentId:attempt.student_id,attemptId,
      subject:renderTemplate(settings.email.resultSubject,vars,false),
      text:renderTemplate(settings.email.resultText,vars,false),
      html:renderTemplate(settings.email.resultHtml,vars,true),createdAt:at,
    };
    await client.query(`UPDATE attempts SET status='published',public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(publicData)]);
    await client.query(`INSERT INTO notifications(id,student_id,attempt_id,status,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`,[`result-${attemptId}`,attempt.student_id,attemptId,notificationStatus,JSON.stringify(notificationData)]);
    await audit(user,'publish_result','attempt',attemptId,{studentId:attempt.student_id,notificationStatus},client);
    return {alreadyPublished:false,notificationStatus};
  });

  const email=await deliverResultEmail(attemptId);
  return {status:'published',...out,email};
}
