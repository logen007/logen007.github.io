import {query,withTx,getSettings,audit,uid,now,appError} from '../db.js';
import {examById,questionMap,scoreQuestion,resultFor,sectionMeta} from './shared.js';

export async function startAttempt(user,{examId,restart=false}){
  if(user.role!=='student')throw appError(403,'Chỉ học viên được bắt đầu bài thi.');
  const settings=await getSettings();
  const exam=await examById(examId);
  if(exam.status!=='published')throw appError(409,'Bài thi chưa mở cho học viên.');

  return withTx(async client=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${user.id}:${examId}`]);
    const rows=(await client.query(`SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2 ORDER BY attempt_no DESC FOR UPDATE`,[user.id,examId])).rows;
    const current=rows.find(row=>row.status==='in_progress');
    if(current&&!restart)return {attemptId:current.id,resumed:true};
    if(settings.operations.maintenanceMode)throw appError(409,settings.operations.maintenanceMessage);
    if(restart&&!settings.exam.allowRestart)throw appError(409,'Hệ thống hiện không cho phép làm lại lượt đang dở.');
    if(rows.length&&!current&&!settings.exam.allowRetake)throw appError(409,'Bài thi này hiện không cho phép thi lại.');

    if(current&&restart){
      const publicData={...current.public_data,status:'abandoned',abandonedAt:now(),updatedAt:now()};
      await client.query(`UPDATE attempts SET status='abandoned',public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[current.id,JSON.stringify(publicData)]);
    }

    const attemptNo=Math.max(0,...rows.map(row=>Number(row.attempt_no||0)))+1;
    const id=uid('attempt');
    const startedAt=now();
    const meta=sectionMeta(exam,0,{});
    const data={
      examId,examTitle:exam.title,examVersion:Number(exam.version||1),
      studentId:user.id,studentName:user.name||'',studentEmail:user.email||'',attemptNo,
      status:'in_progress',startedAt,updatedAt:startedAt,currentSectionIndex:0,
      ...meta,answers:{},publishedAt:null,
    };
    await client.query(`INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data) VALUES($1,$2,$3,'in_progress',$4,$5::jsonb)`,[id,user.id,examId,attemptNo,JSON.stringify(data)]);

    if(!exam.locked){
      const examData={...exam,locked:true,lockedAt:startedAt};
      delete examData.id;
      delete examData.ownerId;
      delete examData.status;
      await client.query(`UPDATE exams SET locked=true,data=$2::jsonb,updated_at=now() WHERE id=$1`,[examId,JSON.stringify(examData)]);
    }
    await audit(user,'start_attempt','attempt',id,{examId,restart:Boolean(restart)},client);
    return {attemptId:id,resumed:false};
  });
}

export async function saveAnswers(user,{attemptId,answers={}}){
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0],publicData=attempt.public_data;
    if(attempt.student_id!==user.id)throw appError(403,'Không có quyền lưu lượt thi này.');
    if(attempt.status!=='in_progress')throw appError(409,'Lượt thi đã kết thúc.');
    if(Number(publicData.currentDeadlineMs||0)&&Date.now()>Number(publicData.currentDeadlineMs))throw appError(409,'Phần thi đã hết thời gian.');
    const allowed=new Set(publicData.currentQuestionIds||[]),next={...(publicData.answers||{})};
    for(const [key,value] of Object.entries(answers||{}))if(allowed.has(key))next[key]=value;
    const out={...publicData,answers:next,updatedAt:now()};
    await client.query(`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(out)]);
    return {ok:true};
  });
}

export async function setAttemptSection(user,{attemptId,index}){
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0],publicData=attempt.public_data;
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền chuyển phần thi.');
    const exam=await examById(attempt.exam_id,client);
    const safe=Math.max(0,Math.min(Number(index)||0,Math.max(0,(exam.sections||[]).length-1)));
    const meta=sectionMeta(exam,safe,publicData.sectionStates||{});
    const out={...publicData,currentSectionIndex:safe,...meta,updatedAt:now()};
    await client.query(`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(out)]);
    return {attemptId,index:safe};
  });
}

export async function abandonAttempt(user,{attemptId}){
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id)throw appError(403,'Không có quyền bỏ lượt thi này.');
    if(attempt.status!=='in_progress')return {status:attempt.status};
    const publicData={...attempt.public_data,status:'abandoned',abandonedAt:now(),updatedAt:now()};
    await client.query(`UPDATE attempts SET status='abandoned',public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(publicData)]);
    return {status:'abandoned'};
  });
}

export async function submitAttempt(user,{attemptId}){
  const result=await query(`SELECT * FROM attempts WHERE id=$1`,[attemptId]);
  if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
  const attempt=result.rows[0];
  if(attempt.student_id!==user.id)throw appError(403,'Không có quyền nộp lượt thi này.');
  if(attempt.status!=='in_progress')return {status:attempt.status};

  const exam=await examById(attempt.exam_id);
  const questions=await questionMap(exam);
  const sectionScores={};
  let autoScore=0,hasManual=false;
  for(const section of exam.sections||[]){
    let subtotal=0;
    for(const id of section.questionIds||[]){
      const question=questions.get(id);
      if(!question)continue;
      if(question.autoGrade)subtotal+=scoreQuestion(question,attempt.public_data.answers?.[id]);
      else hasManual=true;
    }
    subtotal=Math.round(subtotal*100)/100;
    sectionScores[section.name]=subtotal;
    autoScore+=subtotal;
  }
  autoScore=Math.round(autoScore*100)/100;
  const status=hasManual?'grading':'ready';
  const totalScore=hasManual?null:autoScore;
  const resultText=hasManual?null:resultFor(exam,totalScore);
  const at=now();
  const publicData={...attempt.public_data,status,submittedAt:at,updatedAt:at};
  const privateData={autoScore,sectionScores,manualScores:{},totalScore,result:resultText,feedback:'',updatedAt:at};
  await query(`UPDATE attempts SET status=$2,public_data=$3::jsonb,private_data=$4::jsonb,updated_at=now() WHERE id=$1`,[attemptId,status,JSON.stringify(publicData),JSON.stringify(privateData)]);
  await audit(user,'submit_attempt','attempt',attemptId,{status});
  return {status};
}
