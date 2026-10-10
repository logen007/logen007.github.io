import {query,withTx,getSettings,audit,uid,now,appError} from '../db.js';
import {examById,attemptExam,questionMap,scoreQuestion,resultFor,sectionMeta} from './shared.js';
import {codeHash,checkCodeRate} from './exam-access.js';
import {isAutomaticWritingForm,scoreWritingForm} from '../writing-form.js';

export async function startAttempt(user,{examId,restart=false,code}){
  if(user.role!=='student')throw appError(403,'Chỉ học viên được bắt đầu bài thi.');
  if(!user.canTestRoles&&!user.profileCompletedAt)throw appError(409,'Vui lòng hoàn tất họ tên và mã lớp trước khi thi.');
  const settings=await getSettings();
  if(code)await checkCodeRate(user);

  return withTx(async client=>{
    let access;
    if(code){
      access=(await client.query('SELECT * FROM exam_codes WHERE code_hash=$1 AND expires_at>now() FOR UPDATE',[codeHash(code)])).rows[0];
      if(!access||Date.parse(access.expires_at)<=Date.now()||(examId&&examId!==access.exam_id))throw appError(403,'Mã thi không hợp lệ hoặc đã hết hạn.');
      examId=access.exam_id;
    }
    await client.query('SELECT id FROM exams WHERE id=$1 FOR UPDATE',[examId]);
    const exam=await examById(examId,client);
    if(exam.status!=='published')throw appError(409,'Bài thi chưa mở cho học viên.');
    if(exam.hidden&&!access)throw appError(403,'Vui lòng nhập mã thi.');
    if(access&&(await client.query('SELECT 1 FROM exam_code_uses WHERE code_id=$1 AND student_id=$2',[access.id,user.id])).rowCount)throw appError(409,'Bạn đã sử dụng mã thi này.');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`${user.id}:${examId}`]);
    const rows=(await client.query(`SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2 ORDER BY attempt_no DESC FOR UPDATE`,[user.id,examId])).rows;
    const current=rows.find(row=>row.status==='in_progress');
    if(settings.operations.maintenanceMode)throw appError(409,settings.operations.maintenanceMessage);
    if(current)await client.query(`DELETE FROM attempts WHERE id=$1`,[current.id]);

    const attemptNo=Math.max(0,...rows.filter(row=>row.id!==current?.id&&!['in_progress','abandoned'].includes(row.status)).map(row=>Number(row.attempt_no||0)))+1;
    const id=uid('attempt');
    const startedAt=now();
    const meta=sectionMeta(exam,0,{});
    const data={
      examId,examTitle:exam.title,examVersion:Number(exam.version||1),
      studentId:user.id,studentName:user.name||'',studentEmail:user.email||'',attemptNo,
      status:'in_progress',startedAt,updatedAt:startedAt,currentSectionIndex:0,
      ...meta,answers:{},audioSessions:{},publishedAt:null,
    };
    const questions=await questionMap(exam);
    const examSnapshot={...exam,questionSnapshot:[...questions.values()],scoringPolicyVersion:1};
    await client.query(`INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data,private_data) VALUES($1,$2,$3,'in_progress',$4,$5::jsonb,$6::jsonb)`,[id,user.id,examId,attemptNo,JSON.stringify(data),JSON.stringify({examSnapshot})]);
    if(access)await client.query('INSERT INTO exam_code_uses(code_id,student_id,attempt_id) VALUES($1,$2,$3)',[access.id,user.id,id]);

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
  const exam=await attemptExam(attempt,client);
  const section=(exam.sections||[]).find(item=>item.id===sectionId);
  if(!section)throw appError(404,'Không tìm thấy Part audio.');
  if(attempt.public_data?.currentSectionId!==section.id)throw appError(409,'Part audio không thuộc phần thi hiện tại.');
  const policy=section.audioPolicy||{};
  const allowed=new Set(attempt.public_data.currentQuestionIds||[]);
  const ids=(section.questionIds||[]).filter(id=>allowed.has(id));
  const questionRows=exam.questionSnapshot?exam.questionSnapshot.filter(q=>ids.includes(q.id)).map(q=>({data:q})):ids.length?(await client.query(`SELECT data FROM questions WHERE id=ANY($1::text[])`,[ids])).rows:[];
  const hasQuestionAudio=questionRows.some(row=>String(row.data?.audioUrl||'').trim());
  const hasAudio=Boolean(String(section.instructionAudioUrl||'').trim())||hasQuestionAudio;
  if(!hasAudio)throw appError(409,'Part audio không có audio trong phần thi hiện tại.');
  if(policy.mode==='per_question_segment'&&(Number(policy.maxSessions)<1||Number(policy.segmentRepeat)<1))throw appError(500,'Specification audio không hợp lệ.');
  return section;
}

export async function startPartAudio(user,{attemptId,sectionId}){
  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0];
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền phát audio của lượt thi này.');
    const section=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    if(sessions?.[section.id]?.startedAt)throw appError(409,'Audio của phần này đã được bắt đầu và không thể phát lại.');
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
    const section=await partAudioContext(client,attempt,sectionId);
    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};
    const session=sessions[section.id];
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

export async function setAttemptSection(user,{attemptId,index}){
  return withTx(async client=>{
    const result=await client.query(`SELECT * FROM attempts WHERE id=$1 FOR UPDATE`,[attemptId]);
    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
    const attempt=result.rows[0],publicData=attempt.public_data;
    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền chuyển phần thi.');
    const exam=await attemptExam(attempt,client);
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
    await audit(user,'abandon_attempt','attempt',attemptId,{deleted:true},client);
    await client.query(`DELETE FROM attempts WHERE id=$1`,[attemptId]);
    return {status:'deleted'};
  });
}

export async function submitAttempt(user,{attemptId}){
  const result=await query(`SELECT * FROM attempts WHERE id=$1`,[attemptId]);
  if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');
  const attempt=result.rows[0];
  if(attempt.student_id!==user.id)throw appError(403,'Không có quyền nộp lượt thi này.');
  if(attempt.status!=='in_progress')return {status:attempt.status};

  const exam=await attemptExam(attempt);
  const questions=await questionMap(exam);
  const sectionScores={};
  let autoScore=0,hasManual=false;
  for(const section of exam.sections||[]){
    let subtotal=0;
    for(const id of section.questionIds||[]){
      const question=questions.get(id);
      if(!question)continue;
      if(question.example)continue;
      if(isAutomaticWritingForm(exam,section,question))subtotal+=scoreWritingForm(question.rubric,attempt.public_data.answers?.[id]);
      else if(question.autoGrade)subtotal+=scoreQuestion(question,attempt.public_data.answers?.[id]);
      else hasManual=true;
    }
    subtotal=Math.round(subtotal*100)/100;
    sectionScores[section.name]=subtotal;
    autoScore+=subtotal;
  }
  autoScore=Math.round(autoScore*100)/100;
  const status=hasManual?'grading':'ready';
  const totalScore=hasManual?null:autoScore;
  const resultText=hasManual?null:resultFor(exam,questions,sectionScores,{});
  const at=now();
  const publicData={...attempt.public_data,status,submittedAt:at,updatedAt:at};
  const privateData={...attempt.private_data,autoScore,sectionScores,scoringVersion:2,manualScores:{},totalScore,result:resultText,feedback:'',updatedAt:at};
  await query(`UPDATE attempts SET status=$2,public_data=$3::jsonb,private_data=$4::jsonb,updated_at=now() WHERE id=$1`,[attemptId,status,JSON.stringify(publicData),JSON.stringify(privateData)]);
  await audit(user,'submit_attempt','attempt',attemptId,{status});
  return {status};
}
