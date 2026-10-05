const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db=getFirestore();
const PRIVATE_FIELDS=['autoScore','manualScores','sectionScores','totalScore','result','reviewerId','reviewerName','feedback','rubrics'];

function now(){ return new Date().toISOString(); }
function requireAuth(request){ if(!request.auth) throw new HttpsError('unauthenticated','Bạn cần đăng nhập.'); return request.auth.uid; }
async function getUser(uid){ const snap=await db.collection('users').doc(uid).get(); if(!snap.exists) throw new HttpsError('permission-denied','Không tìm thấy tài khoản.'); return {id:uid,...snap.data()}; }
function isTeacher(user){ return user.role==='teacher'||user.role==='master'; }
async function canGrade(user,exam){
  if(user.role==='master'||exam.ownerId===user.id) return true;
  if(user.role!=='teacher') return false;
  const snap=await db.collection('gradingRequests').where('examId','==',exam.id).get();
  return snap.docs.some(d=>{const x=d.data();return x.requesterId===user.id&&x.status==='approved';});
}
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
async function loadExamAndQuestions(examId){
  const eSnap=await db.collection('exams').doc(examId).get();
  if(!eSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:eSnap.id,...eSnap.data()};
  const qids=[...new Set((exam.sections||[]).flatMap(s=>s.questionIds||[]))];
  const snaps=await Promise.all(qids.map(id=>db.collection('questions').doc(id).get()));
  const qmap=new Map(snaps.filter(s=>s.exists).map(s=>[s.id,{id:s.id,...s.data()}]));
  return {exam,qmap};
}
async function audit(user,action,entityId,detail={}){
  await db.collection('auditLog').add({at:now(),userId:user.id,userName:user.name||'',action,entityType:'attempt',entityId,detail});
}

exports.submitAttempt = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid), attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId), aSnap=await aRef.get();
  if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()};
  if(attempt.studentId!==uid) throw new HttpsError('permission-denied','Không có quyền nộp lượt thi này.');
  if(attempt.status!=='in_progress') return {status:attempt.status};

  const {exam,qmap}=await loadExamAndQuestions(attempt.examId);
  const sectionScores={}; let autoScore=0,hasManual=false;
  for(const sec of exam.sections||[]){
    let subtotal=0;
    for(const id of sec.questionIds||[]){ const q=qmap.get(id); if(!q)continue; if(q.autoGrade)subtotal+=scoreQuestion(q,attempt.answers?.[id]); else hasManual=true; }
    subtotal=Math.round(subtotal*100)/100; sectionScores[sec.name]=subtotal; autoScore+=subtotal;
  }
  autoScore=Math.round(autoScore*100)/100;
  const status=hasManual?'grading':'ready';
  const totalScore=hasManual?null:autoScore;
  const result=hasManual?null:(totalScore>=Number(exam.passScore||180)?'Đạt':'Chưa đạt');
  const at=now();
  const batch=db.batch();
  batch.set(db.collection('attemptPrivate').doc(attemptId),{autoScore,sectionScores,manualScores:{},totalScore,result,feedback:'',updatedAt:at},{merge:true});
  batch.update(aRef,{status,submittedAt:at,updatedAt:at});
  batch.set(db.collection('auditLog').doc(),{at,userId:user.id,userName:user.name||'',action:'submit_attempt',entityType:'attempt',entityId:attemptId,detail:{status}});
  await batch.commit();
  return {status};
});

exports.saveManualGrade = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid);
  if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được chấm bài.');
  const {attemptId,scores={},feedback=''}=request.data||{};
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId), aSnap=await aRef.get();
  if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()};
  const {exam,qmap}=await loadExamAndQuestions(attempt.examId);
  if(!(await canGrade(user,exam))) throw new HttpsError('permission-denied','Bạn chưa được cấp quyền chấm bài này.');
  if(!['grading','ready'].includes(attempt.status)) throw new HttpsError('failed-precondition','Bài không ở trạng thái chấm.');

  const pRef=db.collection('attemptPrivate').doc(attemptId), pSnap=await pRef.get();
  const priv=pSnap.exists?pSnap.data():{};
  const manual=[...qmap.values()].filter(q=>!q.autoGrade);
  const maxBySkill={}; for(const q of manual) maxBySkill[q.skill]=(maxBySkill[q.skill]||0)+Number(q.maxScore||0);
  const clean={...(priv.manualScores||{})};
  for(const [skill,value] of Object.entries(scores||{})){
    if(!(skill in maxBySkill)) continue;
    const n=Number(value);
    if(!Number.isFinite(n)||n<0||n>maxBySkill[skill]) throw new HttpsError('invalid-argument',`Điểm ${skill} không hợp lệ.`);
    clean[skill]=n;
  }
  const complete=Object.keys(maxBySkill).every(skill=>Number.isFinite(Number(clean[skill])));
  const manualTotal=Object.values(clean).reduce((n,v)=>n+(Number(v)||0),0);
  const autoScore=Number(priv.autoScore||0);
  const totalScore=complete?autoScore+manualTotal:null;
  const result=complete?(totalScore>=Number(exam.passScore||180)?'Đạt':'Chưa đạt'):null;
  const status=complete?'ready':'grading', at=now();
  const batch=db.batch();
  batch.set(pRef,{...priv,autoScore,manualScores:clean,feedback:String(feedback||''),reviewerId:user.id,reviewerName:user.name||'',totalScore,result,updatedAt:at},{merge:true});
  batch.update(aRef,{status,updatedAt:at});
  batch.set(db.collection('auditLog').doc(),{at,userId:user.id,userName:user.name||'',action:'save_grade',entityType:'attempt',entityId:attemptId,detail:{complete,status}});
  await batch.commit();
  return {status};
});

exports.publishAttemptResult = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid);
  if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được công bố kết quả.');
  const attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId), aSnap=await aRef.get();
  if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()};
  const eSnap=await db.collection('exams').doc(attempt.examId).get();
  if(!eSnap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  const exam={id:eSnap.id,...eSnap.data()};
  if(!(user.role==='master'||exam.ownerId===user.id)) throw new HttpsError('permission-denied','Chỉ giáo viên tạo bài hoặc Quản trị cấp cao được công bố kết quả.');
  if(attempt.status!=='ready') throw new HttpsError('failed-precondition','Bài chưa được chấm đủ.');
  const pRef=db.collection('attemptPrivate').doc(attemptId), pSnap=await pRef.get();
  if(!pSnap.exists) throw new HttpsError('failed-precondition','Không tìm thấy dữ liệu chấm điểm.');
  const priv=pSnap.data();
  if(!Number.isFinite(Number(priv.totalScore))) throw new HttpsError('failed-precondition','Bài chưa có tổng điểm hợp lệ.');

  const at=now(), notificationRef=db.collection('notifications').doc(), mailRef=db.collection('mail').doc(`result-${notificationRef.id}`);
  const publicResult={
    status:'published',publishedAt:at,updatedAt:at,
    autoScore:Number(priv.autoScore||0),manualScores:priv.manualScores||{},sectionScores:priv.sectionScores||{},
    totalScore:Number(priv.totalScore),result:priv.result||'',reviewerId:priv.reviewerId||null,reviewerName:priv.reviewerName||null,feedback:priv.feedback||''
  };
  const batch=db.batch();
  batch.update(aRef,publicResult);
  batch.set(notificationRef,{type:'result_published',status:'queued',to:attempt.studentEmail||'',studentId:attempt.studentId,attemptId,subject:`G2G – Đã có kết quả ${attempt.examTitle}`,body:'Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.',createdAt:at});
  if(attempt.studentEmail) batch.set(mailRef,{to:[attempt.studentEmail],message:{subject:`G2G – Đã có kết quả ${attempt.examTitle}`,text:'Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.',html:'<p>Kết quả thi thử của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.</p>'}});
  batch.set(db.collection('auditLog').doc(),{at,userId:user.id,userName:user.name||'',action:'publish_result',entityType:'attempt',entityId:attemptId,detail:{studentId:attempt.studentId}});
  await batch.commit();
  return {status:'published'};
});

exports.migrateAttemptPrivacy = onCall(async request => {
  const uid=requireAuth(request), user=await getUser(uid);
  if(user.role!=='master') throw new HttpsError('permission-denied','Chỉ Quản trị cấp cao được chạy migration.');
  const snap=await db.collection('attempts').get();
  let migrated=0;
  for(const doc of snap.docs){
    const a=doc.data();
    if(a.status==='published') continue;
    const privateData={}; let has=false;
    for(const key of PRIVATE_FIELDS){ if(key in a){ privateData[key]=a[key]; has=true; } }
    if(!has) continue;
    const batch=db.batch();
    batch.set(db.collection('attemptPrivate').doc(doc.id),{...privateData,updatedAt:now()},{merge:true});
    const deletes={}; for(const key of PRIVATE_FIELDS) if(key in a) deletes[key]=FieldValue.delete();
    batch.update(doc.ref,deletes); await batch.commit(); migrated++;
  }
  await audit(user,'migrate_attempt_privacy','migration',{migrated});
  return {migrated};
});
