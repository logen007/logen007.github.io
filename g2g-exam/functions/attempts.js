const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

function nowIso(){ return new Date().toISOString(); }
function requireAuth(request){ if(!request.auth) throw new HttpsError('unauthenticated','Bạn cần đăng nhập.'); return request.auth.uid; }
async function getUser(uid){ const snap=await db.collection('users').doc(uid).get(); if(!snap.exists) throw new HttpsError('permission-denied','Không tìm thấy tài khoản.'); return {id:uid,...snap.data()}; }
function sectionRuntime(sec,existingState=null){
  if(!sec) return {state:null,deadlineMs:0,questionIds:[]};
  if(existingState){
    return {
      state:existingState,
      deadlineMs:sec.showTimer===false?0:Math.max(0,Date.parse(existingState.deadlineAt||'')||0),
      questionIds:[...new Set(sec.questionIds||[])]
    };
  }
  const startedAt=nowIso();
  const deadlineMs=sec.showTimer===false?0:Date.now()+Math.max(1,Number(sec.timeMinutes||30))*60*1000;
  return {
    state:{startedAt,deadlineAt:deadlineMs?new Date(deadlineMs).toISOString():null},
    deadlineMs,
    questionIds:[...new Set(sec.questionIds||[])]
  };
}
function firstSectionState(exam){
  const sec=exam.sections?.[0]; if(!sec) return {sectionStates:{},currentSectionId:null,currentQuestionIds:[],currentDeadlineMs:0};
  const runtime=sectionRuntime(sec);
  return {sectionStates:{[sec.id]:runtime.state},currentSectionId:sec.id,currentQuestionIds:runtime.questionIds,currentDeadlineMs:runtime.deadlineMs};
}

exports.startAttemptSecure = onCall(async request => {
  const uid=requireAuth(request);
  const user=await getUser(uid);
  if(user.role!=='student' || user.active===false) throw new HttpsError('permission-denied','Tài khoản này không phải học viên đang hoạt động.');
  const {examId,restart=false}=request.data||{};
  if(!examId) throw new HttpsError('invalid-argument','Thiếu mã bài thi.');
  const examRef=db.collection('exams').doc(examId);
  const examSnap=await examRef.get();
  if(!examSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:examSnap.id,...examSnap.data()};
  if(exam.status!=='published') throw new HttpsError('failed-precondition','Bài thi chưa mở cho học viên.');

  const attemptsSnap=await db.collection('attempts').where('studentId','==',uid).get();
  const mine=attemptsSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.examId===examId);
  const current=mine.find(a=>a.status==='in_progress');
  if(current && !restart) return {attemptId:current.id,resumed:true};

  const batch=db.batch();
  if(current && restart){ batch.update(db.collection('attempts').doc(current.id),{status:'abandoned',abandonedAt:nowIso(),updatedAt:nowIso()}); }
  const attemptNo=1+Math.max(0,...mine.map(a=>Number(a.attemptNo||0)));
  const ref=db.collection('attempts').doc();
  const startedAt=nowIso();
  const runtime=firstSectionState(exam);
  const attempt={
    examId,
    examTitle:exam.title,
    examVersion:Number(exam.version||1),
    studentId:uid,
    studentName:user.name||'',
    studentEmail:user.email||'',
    attemptNo,
    status:'in_progress',
    startedAt,
    updatedAt:startedAt,
    currentSectionIndex:0,
    currentSectionId:runtime.currentSectionId,
    currentQuestionIds:runtime.currentQuestionIds,
    currentDeadlineMs:runtime.currentDeadlineMs,
    sectionStates:runtime.sectionStates,
    answers:{},
    publishedAt:null
  };
  batch.set(ref,attempt);
  if(!exam.locked) batch.set(examRef,{locked:true,lockedAt:startedAt},{merge:true});
  batch.set(db.collection('auditLog').doc(),{at:startedAt,userId:uid,userName:user.name||'',action:'start_attempt',entityType:'attempt',entityId:ref.id,detail:{examId,restart:Boolean(restart)}});
  await batch.commit();
  return {attemptId:ref.id,resumed:false};
});

exports.setAttemptSectionSecure = onCall(async request => {
  const uid=requireAuth(request);
  const {attemptId,index}=request.data||{};
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const ref=db.collection('attempts').doc(attemptId), snap=await ref.get();
  if(!snap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:snap.id,...snap.data()};
  if(attempt.studentId!==uid) throw new HttpsError('permission-denied','Không có quyền chuyển phần của lượt thi này.');
  if(attempt.status!=='in_progress') throw new HttpsError('failed-precondition','Lượt thi đã kết thúc.');
  const examSnap=await db.collection('exams').doc(attempt.examId).get();
  if(!examSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:examSnap.id,...examSnap.data()};
  const safe=Math.max(0,Math.min(Number(index)||0,Math.max(0,(exam.sections||[]).length-1)));
  const sec=exam.sections?.[safe];
  const existing=sec?attempt.sectionStates?.[sec.id]:null;
  const runtime=sectionRuntime(sec,existing);
  const updates={
    currentSectionIndex:safe,
    currentSectionId:sec?.id||null,
    currentQuestionIds:runtime.questionIds,
    currentDeadlineMs:runtime.deadlineMs,
    updatedAt:nowIso()
  };
  if(sec && !existing) updates[`sectionStates.${sec.id}`]=runtime.state;
  await ref.update(updates);
  return {attemptId,index:safe,currentSectionId:updates.currentSectionId,currentDeadlineMs:updates.currentDeadlineMs};
});

exports.abandonAttemptSecure = onCall(async request => {
  const uid=requireAuth(request);
  const attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const ref=db.collection('attempts').doc(attemptId), snap=await ref.get();
  if(!snap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const a=snap.data();
  if(a.studentId!==uid) throw new HttpsError('permission-denied','Không có quyền bỏ lượt thi này.');
  if(a.status!=='in_progress') return {status:a.status};
  await ref.update({status:'abandoned',abandonedAt:nowIso(),updatedAt:nowIso()});
  return {status:'abandoned'};
});
