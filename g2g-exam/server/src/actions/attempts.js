import {query,withTx,getSettings,audit,uid,now,appError} from '../db.js';
import {examById,questionMap,scoreQuestion,resultFor,sectionMeta} from './shared.js';
import {getA1ListeningPart1Spec} from '../specs.js';

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
      ...meta,answers:{},audioSessions:{},publishedAt:null,
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

async function partAudioContext(client,attempt,sectionId){
  const exam=await examById(attempt.exam_id,client);
  const section=(exam.sections||[]).find(item=>item.id===sectionId);
  if(!section)throw appError(404,'Không tìm thấy Part audio.');
  if(attempt.public_data?.currentSectionId!==section.id)throw appError(409,'Part audio không thuộc phần thi hiện tại.');
  const spec=await getA1ListeningPart1Spec();
  if(section.templateType!==spec.template)throw appError(409,'Part này không dùng template audio hiện tại.');
  const policy=spec.audio||{};
  if(Number(policy.maxSessions)<1||Number(policy.segmentRepeat)<1)throw appError(500,'Specification audio không hợp lệ.');
  const allowed=new Set(attempt.public_data.currentQuestionIds||[]);
  const ids=(section.questionIds||[]).filter(id=>allowed.has(id));
  if(!ids.length)throw appError(409,'Part audio không có câu hỏi trong phần thi hiện tại.');
  const questionRows=await client.query(`SELECT id,data FROM questions WHERE id = ANY($1::text[])`,[ids]);
  const legacyGroupIds=[...new Set(questionRows.rows.map(row=>row.data?.groupId).filter(Boolean))];
  return {section,legacyGroupIds};
}

function hasStartedPartSession(sessions,sectionId,legacyGroupIds=[]){
  if(sessions?.[sectionId]?.startedAt)return true;
  return legacyGroupIds.some(id=>sessions?.[id]?.startedAt);
}

export async function startPartAudio(user,{attemptId,sectionId}){
  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền phát audio của lượt thi này.');
    const {section,legacyGroupIds}=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    if(hasStartedPartSession(sessions,section.id,legacyGroupIds))throw appError(409,'Audio của phần này đã được bắt đầu và không thể phát lại.');
    const startedAt=now();
    sessions[section.id]={startedAt,completedAt:null};
    const out={...publicData,audioSessions:sessions,updatedAt:startedAt};
    await client.query(`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(out)]);
    await audit(user,'start_part_audio','attempt',attemptId,{sectionId:section.id},client);
    return {ok:true,startedAt};
  });
}

export async function completePartAudio(user,{attemptId,sectionId}){
  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền cập nhật audio của lượt thi này.');
    const {section,legacyGroupIds}=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    const legacySession=legacyGroupIds.map(id=>sessions[id]).find(item=>item?.startedAt);
    const session=sessions[section.id]||legacySession;
    if(!session?.startedAt)throw appError(409,'Phiên audio chưa được bắt đầu.');
    if(session.completedAt)return {ok:true,completedAt:session.completedAt};
    const completedAt=now();
    sessions[section.id]={...session,completedAt};
    const out={...publicData,audioSessions:sessions,updatedAt:completedAt};
    await client.query(`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1`,[attemptId,JSON.stringify(out)]);
    await audit(user,'complete_part_audio','attempt',attemptId,{sectionId:section.id},client);
    return {ok:true,completedAt};
  });
}

async function legacySectionIdForGroup(user,attemptId,groupId){
  if(!attemptId||!groupId)throw appError(400,'Thiếu thông tin phiên audio cũ.');
  const attemptResult=await query(`SELECT * FROM attempts WHERE id=$1`,[attemptId]);
  if(!attemptResult.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
  const attempt=attemptResult.rows[0];
  if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền phát audio của lượt thi này.');
  const groupResult=await query(`SELECT data FROM question_groups WHERE id=$1`,[groupId]);
  if(!groupResult.rowCount)throw appError(404,'Không tìm thấy cụm audio cũ.');
  const ids=new Set(groupResult.rows[0].data?.questionIds||[]);
  const exam=await examById(attempt.exam_id);
  const section=(exam.sections||[]).find(item=>(item.questionIds||[]).some(id=>ids.has(id)));
  if(!section)throw appError(409,'Cụm audio cũ không còn gắn với Part hiện tại.');
  return section.id;
}

// Compatibility only for cached/legacy clients during Step 9A. New runtime uses sectionId.
export async function startAudioGroup(user,{attemptId,groupId}){
  return startPartAudio(user,{attemptId,sectionId:await legacySectionIdForGroup(user,attemptId,groupId)});
}
export async function completeAudioGroup(user,{attemptId,groupId}){
  return completePartAudio(user,{attemptId,sectionId:await legacySectionIdForGroup(user,attemptId,groupId)});
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
