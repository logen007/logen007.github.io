const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function getUser(uid){
  const snap=await db.collection('users').doc(uid).get();
  if(!snap.exists) throw new HttpsError('permission-denied','Không tìm thấy tài khoản.');
  return {id:uid,...snap.data()};
}
function requireAuth(request){ if(!request.auth) throw new HttpsError('unauthenticated','Bạn cần đăng nhập.'); return request.auth.uid; }
function isTeacher(user){ return user.role==='teacher'||user.role==='master'; }
function now(){ return new Date().toISOString(); }

async function canGrade(user,exam){
  if(user.role==='master'||exam.ownerId===user.id) return true;
  if(user.role!=='teacher') return false;
  const snap=await db.collection('gradingRequests').where('examId','==',exam.id).get();
  return snap.docs.some(d=>{const x=d.data(); return x.requesterId===user.id&&x.status==='approved';});
}

function publicQuestion(data){
  if(!data) return null;
  const copy={...data};
  delete copy.correctAnswer; delete copy.rubric;
  if(Array.isArray(copy.pairs)){
    const rights=copy.pairs.map(x=>x[1]);
    for(let i=rights.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [rights[i],rights[j]]=[rights[j],rights[i]]; }
    copy.pairs=copy.pairs.map((x,i)=>[x[0],rights[i]]);
  }
  return copy;
}

exports.syncQuestionPublic = onDocumentWritten('questions/{questionId}', async event => {
  const id=event.params.questionId, after=event.data.after;
  const ref=db.collection('questionPublic').doc(id);
  if(!after.exists){ await ref.delete().catch(()=>{}); return; }
  await ref.set(publicQuestion(after.data()),{merge:false});
});

function scoreQuestion(q,answer){
  if(!q?.autoGrade) return 0;
  if(['single','truefalse','cloze'].includes(q.type)) return Number(answer)===Number(q.correctAnswer)?Number(q.maxScore||0):0;
  if(q.type==='matching'){
    if(!Array.isArray(answer)||!Array.isArray(q.pairs)||!q.pairs.length) return 0;
    let correct=0; q.pairs.forEach((pair,i)=>{ if(answer[i]===pair[1]) correct++; });
    return Math.round((correct/q.pairs.length)*Number(q.maxScore||0)*100)/100;
  }
  return 0;
}

exports.submitAttempt = onCall(async request => {
  const uid=requireAuth(request), attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const attemptRef=db.collection('attempts').doc(attemptId), attemptSnap=await attemptRef.get();
  if(!attemptSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:attemptId,...attemptSnap.data()};
  if(attempt.studentId!==uid) throw new HttpsError('permission-denied','Không có quyền nộp lượt thi này.');
  if(attempt.status!=='in_progress') return {status:attempt.status};
  const examSnap=await db.collection('exams').doc(attempt.examId).get(); if(!examSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:examSnap.id,...examSnap.data()};
  const qids=[...new Set((exam.sections||[]).flatMap(s=>s.questionIds||[]))];
  const qSnaps=await Promise.all(qids.map(id=>db.collection('questions').doc(id).get()));
  const qmap=new Map(qSnaps.filter(s=>s.exists).map(s=>[s.id,{id:s.id,...s.data()}]));
  const sectionScores={}; let autoScore=0, hasManual=false;
  for(const sec of exam.sections||[]){ let subtotal=0; for(const id of sec.questionIds||[]){ const q=qmap.get(id); if(!q) continue; if(q.autoGrade) subtotal+=scoreQuestion(q,attempt.answers?.[id]); else hasManual=true; } subtotal=Math.round(subtotal*100)/100; sectionScores[sec.name]=subtotal; autoScore+=subtotal; }
  autoScore=Math.round(autoScore*100)/100;
  const status=hasManual?'grading':'ready', totalScore=hasManual?null:autoScore, result=hasManual?null:(autoScore>=Number(exam.passScore||180)?'Đạt':'Chưa đạt');
  await attemptRef.update({autoScore,sectionScores,status,totalScore,result,submittedAt:now(),updatedAt:now()});
  return {status,autoScore};
});

exports.saveManualGrade = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid); if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được chấm bài.');
  const {attemptId,scores={},feedback=''}=request.data||{}; if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId), aSnap=await aRef.get(); if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()}, eSnap=await db.collection('exams').doc(attempt.examId).get(); if(!eSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:eSnap.id,...eSnap.data()}; if(!(await canGrade(user,exam))) throw new HttpsError('permission-denied','Bạn chưa được cấp quyền chấm bài này.');
  if(!['grading','ready'].includes(attempt.status)) throw new HttpsError('failed-precondition','Bài không ở trạng thái chấm.');
  const qids=[...new Set((exam.sections||[]).flatMap(s=>s.questionIds||[]))]; const qSnaps=await Promise.all(qids.map(id=>db.collection('questions').doc(id).get())); const manual=qSnaps.filter(s=>s.exists&&!s.data().autoGrade).map(s=>({id:s.id,...s.data()}));
  const maxBySkill={}; for(const q of manual) maxBySkill[q.skill]=(maxBySkill[q.skill]||0)+Number(q.maxScore||0);
  const clean={...(attempt.manualScores||{})}; for(const [skill,value] of Object.entries(scores||{})){ if(!(skill in maxBySkill)) continue; const n=Number(value); if(!Number.isFinite(n)||n<0||n>maxBySkill[skill]) throw new HttpsError('invalid-argument',`Điểm ${skill} không hợp lệ.`); clean[skill]=n; }
  const complete=Object.keys(maxBySkill).every(skill=>Number.isFinite(Number(clean[skill]))); const manualTotal=Object.values(clean).reduce((n,v)=>n+(Number(v)||0),0); const totalScore=complete?Number(attempt.autoScore||0)+manualTotal:null; const result=complete?(totalScore>=Number(exam.passScore||180)?'Đạt':'Chưa đạt'):null;
  await aRef.update({manualScores:clean,feedback:String(feedback||''),reviewerId:user.id,reviewerName:user.name,status:complete?'ready':'grading',totalScore,result,updatedAt:now()});
  return {status:complete?'ready':'grading',totalScore};
});

exports.publishAttemptResult = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid); if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được công bố kết quả.');
  const attemptId=request.data?.attemptId; if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId), aSnap=await aRef.get(); if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()}, eSnap=await db.collection('exams').doc(attempt.examId).get(); if(!eSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:eSnap.id,...eSnap.data()}; if(!(user.role==='master'||exam.ownerId===user.id)) throw new HttpsError('permission-denied','Chỉ giáo viên tạo bài hoặc Quản trị cấp cao được công bố kết quả.');
  if(attempt.status!=='ready') throw new HttpsError('failed-precondition','Bài chưa được chấm đủ.');
  const notificationRef=db.collection('notifications').doc(); const mailRef=db.collection('mail').doc(`result-${notificationRef.id}`);
  const batch=db.batch(); batch.update(aRef,{status:'published',publishedAt:now(),updatedAt:now()}); batch.set(notificationRef,{type:'result_published',status:'queued',to:attempt.studentEmail||'',studentId:attempt.studentId,attemptId,subject:`G2G – Đã có kết quả ${attempt.examTitle}`,body:'Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.',createdAt:now()}); if(attempt.studentEmail) batch.set(mailRef,{to:[attempt.studentEmail],message:{subject:`G2G – Đã có kết quả ${attempt.examTitle}`,text:'Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.',html:'<p>Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.</p>'}}); await batch.commit();
  return {status:'published'};
});

exports.setUserRole = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid); if(user.role!=='master') throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được thay đổi vai trò.');
  const {userId,role}=request.data||{}; if(!userId||!['student','teacher'].includes(role)) throw new HttpsError('invalid-argument','Dữ liệu vai trò không hợp lệ.'); if(userId===uid) throw new HttpsError('failed-precondition','Không tự thay đổi vai trò của tài khoản quản trị.'); await db.collection('users').doc(userId).update({role,updatedAt:now()}); return {userId,role};
});

exports.rebuildQuestionPublic = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid); if(user.role!=='master') throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được thực hiện thao tác này.');
  const snap=await db.collection('questions').get(), batch=db.batch(); snap.docs.forEach(d=>batch.set(db.collection('questionPublic').doc(d.id),publicQuestion(d.data()),{merge:false})); await batch.commit(); return {count:snap.size};
});
