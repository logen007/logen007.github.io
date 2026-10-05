const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { sendConfiguredEmail, renderTemplate } = require('./mailer.js');

const db = getFirestore();
const REGION='asia-southeast1';

const DEFAULT_SETTINGS={
  general:{publicUrl:'https://logen007.github.io/g2g-exam/'},
  auth:{googleLoginEnabled:true,allowNewStudents:true,allowedDomain:''},
  exam:{allowRetake:true,allowRestart:true},
  email:{
    enabled:true,
    resultSubject:'G2G – Đã có kết quả {exam}',
    resultText:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nXem chi tiết: {url}',
    resultHtml:'<p>Xin chào <strong>{student}</strong>,</p><p>Kết quả bài thi <strong>{exam}</strong> của bạn đã được công bố.</p><p>Điểm: <strong>{score}</strong><br>Kết quả: <strong>{result}</strong></p><p><a href="{url}">Đăng nhập hệ thống G2G để xem chi tiết</a></p>'
  },
  results:{notifyResultEmail:true,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
  operations:{maintenanceMode:false,maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'}
};

function now(){ return new Date().toISOString(); }
function requireAuth(request){
  if(!request.auth) throw new HttpsError('unauthenticated','Bạn cần đăng nhập.');
  return request.auth.uid;
}
async function getUser(uid){
  const snap=await db.collection('users').doc(uid).get();
  if(!snap.exists) throw new HttpsError('permission-denied','Không tìm thấy tài khoản.');
  return {id:uid,...snap.data()};
}
function isTeacher(user){ return user?.role==='teacher'||user?.role==='master'; }
function lockId(uid,examId){ return `${uid}__${examId}`.replaceAll('/','_'); }

async function loadSystemSettings(){
  const snap=await db.collection('settings').doc('global').get();
  const data=snap.exists?snap.data():{};
  const email={...DEFAULT_SETTINGS.email,...(data.email||{})};
  if(!data.email){
    email.enabled=data.results?.notifyResultEmail??DEFAULT_SETTINGS.email.enabled;
    email.resultSubject=data.results?.resultEmailSubject||DEFAULT_SETTINGS.email.resultSubject;
  }
  return {
    general:{...DEFAULT_SETTINGS.general,...(data.general||{})},
    auth:{...DEFAULT_SETTINGS.auth,...(data.auth||{})},
    exam:{...DEFAULT_SETTINGS.exam,...(data.exam||{})},
    email,
    results:{...DEFAULT_SETTINGS.results,...(data.results||{})},
    operations:{...DEFAULT_SETTINGS.operations,...(data.operations||{})}
  };
}
function emailVars(attempt,priv,settings){
  return {
    exam:attempt.examTitle||'bài thi',
    student:attempt.studentName||'học viên',
    score:String(priv.totalScore??attempt.totalScore??''),
    result:String(priv.result||attempt.result||''),
    url:String(settings.general?.publicUrl||DEFAULT_SETTINGS.general.publicUrl)
  };
}

async function canGrade(user,exam){
  if(user.role==='master'||exam.ownerId===user.id) return true;
  if(user.role!=='teacher') return false;
  const snap=await db.collection('gradingRequests').where('examId','==',exam.id).get();
  return snap.docs.some(d=>{
    const x=d.data();
    return x.requesterId===user.id&&x.status==='approved';
  });
}

async function loadExam(examId){
  const snap=await db.collection('exams').doc(examId).get();
  if(!snap.exists) throw new HttpsError('not-found','Không tìm thấy bài thi.');
  return {id:snap.id,...snap.data()};
}

async function loadManualLimits(exam){
  const qids=[...new Set((exam.sections||[]).flatMap(s=>s.questionIds||[]))];
  const snaps=await Promise.all(qids.map(id=>db.collection('questions').doc(id).get()));
  const limits={};
  for(const snap of snaps){
    if(!snap.exists) continue;
    const q=snap.data();
    if(q.autoGrade) continue;
    limits[q.skill]=(limits[q.skill]||0)+Number(q.maxScore||0);
  }
  return limits;
}

exports.startAttemptSecure = onCall({region:REGION},async request => {
  const uid=requireAuth(request);
  const user=await getUser(uid);
  if(user.role!=='student'||user.active===false) throw new HttpsError('permission-denied','Tài khoản này không phải học viên đang hoạt động.');
  const {examId,restart=false}=request.data||{};
  if(!examId) throw new HttpsError('invalid-argument','Thiếu mã bài thi.');
  const exam=await loadExam(examId);
  if(exam.status!=='published') throw new HttpsError('failed-precondition','Bài thi chưa mở cho học viên.');
  const systemSettings=await loadSystemSettings();

  const oldSnap=await db.collection('attempts').where('studentId','==',uid).get();
  const oldMine=oldSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.examId===examId);
  const baseline=Math.max(0,...oldMine.map(a=>Number(a.attemptNo||0)));
  const legacyCurrent=oldMine.find(a=>a.status==='in_progress');
  const lRef=db.collection('attemptLocks').doc(lockId(uid,examId));
  const candidateRef=db.collection('attempts').doc();

  const result=await db.runTransaction(async tx=>{
    const lSnap=await tx.get(lRef);
    const lock=lSnap.exists?lSnap.data():{};
    const currentId=lock.currentAttemptId||legacyCurrent?.id||null;
    let current=null;
    if(currentId){
      const cRef=db.collection('attempts').doc(currentId);
      const cSnap=await tx.get(cRef);
      if(cSnap.exists) current={id:cSnap.id,...cSnap.data(),ref:cRef};
    }

    if(current?.status==='in_progress'&&!restart){
      if(!lSnap.exists) tx.set(lRef,{studentId:uid,examId,currentAttemptId:current.id,counter:Math.max(baseline,Number(current.attemptNo||0)),updatedAt:now()},{merge:true});
      return {attemptId:current.id,resumed:true};
    }

    if(systemSettings.operations.maintenanceMode){
      throw new HttpsError('failed-precondition',String(systemSettings.operations.maintenanceMessage||DEFAULT_SETTINGS.operations.maintenanceMessage));
    }
    if(restart&&!systemSettings.exam.allowRestart){
      throw new HttpsError('failed-precondition','Hệ thống hiện không cho phép bỏ lượt đang làm để bắt đầu lại.');
    }
    const priorCount=Math.max(baseline,Number(lock.counter||0));
    if(priorCount>0&&current?.status!=='in_progress'&&!systemSettings.exam.allowRetake){
      throw new HttpsError('failed-precondition','Bài thi này hiện không cho phép thi lại.');
    }

    if(current?.status==='in_progress'&&restart){
      tx.update(current.ref,{status:'abandoned',abandonedAt:now(),updatedAt:now()});
    }

    const attemptNo=Math.max(baseline,Number(lock.counter||0))+1;
    const startedAt=now();
    const first=exam.sections?.[0];
    const sectionStates={};
    if(first){
      const ms=Math.max(1,Number(first.timeMinutes||30))*60*1000;
      sectionStates[first.id]={startedAt,deadlineAt:new Date(Date.now()+ms).toISOString()};
    }
    const attempt={
      examId,examTitle:exam.title,examVersion:Number(exam.version||1),
      studentId:uid,studentName:user.name||'',studentEmail:user.email||'',attemptNo,
      status:'in_progress',startedAt,updatedAt:startedAt,currentSectionIndex:0,
      sectionStates,answers:{},publishedAt:null
    };
    tx.set(candidateRef,attempt);
    tx.set(lRef,{studentId:uid,examId,currentAttemptId:candidateRef.id,counter:attemptNo,updatedAt:startedAt},{merge:false});
    tx.set(db.collection('auditLog').doc(),{at:startedAt,userId:uid,userName:user.name||'',action:'start_attempt',entityType:'attempt',entityId:candidateRef.id,detail:{examId,restart:Boolean(restart)}});
    return {attemptId:candidateRef.id,resumed:false};
  });

  return result;
});

exports.saveManualGrade = onCall({region:REGION},async request => {
  const uid=requireAuth(request),user=await getUser(uid);
  if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được chấm bài.');
  const {attemptId,scores={},feedback}=request.data||{};
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');

  const aRef=db.collection('attempts').doc(attemptId);
  const initial=await aRef.get();
  if(!initial.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const initialAttempt={id:initial.id,...initial.data()};
  const exam=await loadExam(initialAttempt.examId);
  if(!(await canGrade(user,exam))) throw new HttpsError('permission-denied','Bạn chưa được cấp quyền chấm bài này.');
  const limits=await loadManualLimits(exam);

  const out=await db.runTransaction(async tx=>{
    const aSnap=await tx.get(aRef);
    if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
    const attempt={id:aSnap.id,...aSnap.data()};
    if(!['grading','ready'].includes(attempt.status)) throw new HttpsError('failed-precondition','Bài không ở trạng thái chấm.');
    const pRef=db.collection('attemptPrivate').doc(attemptId);
    const pSnap=await tx.get(pRef);
    const priv=pSnap.exists?pSnap.data():{};
    const clean={...(priv.manualScores||{})};
    for(const [skill,value] of Object.entries(scores||{})){
      if(!(skill in limits)) continue;
      const n=Number(value);
      if(!Number.isFinite(n)||n<0||n>limits[skill]) throw new HttpsError('invalid-argument',`Điểm ${skill} phải nằm trong khoảng 0–${limits[skill]}.`);
      clean[skill]=n;
    }
    const complete=Object.keys(limits).every(skill=>Number.isFinite(Number(clean[skill])));
    const manualTotal=Object.values(clean).reduce((n,v)=>n+(Number(v)||0),0);
    const autoScore=Number(priv.autoScore||0);
    const totalScore=complete?autoScore+manualTotal:null;
    const result=complete?(totalScore>=Number(exam.passScore||180)?'Đạt':'Chưa đạt'):null;
    const status=complete?'ready':'grading',at=now();
    const nextPrivate={...priv,autoScore,manualScores:clean,reviewerId:user.id,reviewerName:user.name||'',totalScore,result,updatedAt:at};
    if(feedback!==undefined) nextPrivate.feedback=String(feedback||'');
    tx.set(pRef,nextPrivate,{merge:true});
    tx.update(aRef,{status,updatedAt:at});
    tx.set(db.collection('auditLog').doc(),{at,userId:user.id,userName:user.name||'',action:'save_grade',entityType:'attempt',entityId:attemptId,detail:{complete,status}});
    return {status,totalScore};
  });
  return out;
});

async function deliverResultEmail(attemptId){
  const nRef=db.collection('notifications').doc(`result-${attemptId}`);
  const claim=await db.runTransaction(async tx=>{
    const snap=await tx.get(nRef);
    if(!snap.exists) return {send:false,status:'missing'};
    const n=snap.data();
    if(['sent','email_disabled','no_email'].includes(n.status)) return {send:false,status:n.status};
    if(n.status==='sending'){
      const age=Date.now()-Date.parse(n.sendingAt||0);
      if(Number.isFinite(age)&&age<120000) return {send:false,status:'sending'};
    }
    if(!['queued','failed','sending'].includes(n.status)) return {send:false,status:n.status||'unknown'};
    const at=now();
    tx.set(nRef,{status:'sending',sendingAt:at,lastError:null},{merge:true});
    return {send:true,notification:{...n,status:'sending',sendingAt:at}};
  });
  if(!claim.send) return claim;
  const n=claim.notification;
  try{
    const sent=await sendConfiguredEmail({to:n.to,subject:n.subject,text:n.text,html:n.html});
    await nRef.set({status:'sent',sentAt:now(),messageId:sent.messageId||'',lastError:null},{merge:true});
    return {send:true,status:'sent',messageId:sent.messageId||''};
  }catch(error){
    const message=String(error?.message||'Không gửi được email.').slice(0,500);
    await nRef.set({status:'failed',failedAt:now(),lastError:message},{merge:true});
    console.error('Result email failed',attemptId,error);
    return {send:true,status:'failed',error:message};
  }
}

exports.publishAttemptResult = onCall({region:REGION,timeoutSeconds:60},async request => {
  const uid=requireAuth(request),user=await getUser(uid);
  if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được công bố kết quả.');
  const attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aRef=db.collection('attempts').doc(attemptId);
  const initial=await aRef.get();
  if(!initial.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const exam=await loadExam(initial.data().examId);
  if(!(user.role==='master'||exam.ownerId===user.id)) throw new HttpsError('permission-denied','Chỉ giáo viên tạo bài hoặc Quản trị cấp cao được công bố kết quả.');
  const systemSettings=await loadSystemSettings();
  const notificationRef=db.collection('notifications').doc(`result-${attemptId}`);
  const auditRef=db.collection('auditLog').doc(`publish-${attemptId}`);

  const publication=await db.runTransaction(async tx=>{
    const aSnap=await tx.get(aRef);
    if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
    const attempt={id:aSnap.id,...aSnap.data()};
    if(attempt.status==='published') return {status:'published',alreadyPublished:true};
    if(attempt.status!=='ready') throw new HttpsError('failed-precondition','Bài chưa được chấm đủ.');
    const pRef=db.collection('attemptPrivate').doc(attemptId);
    const pSnap=await tx.get(pRef);
    if(!pSnap.exists) throw new HttpsError('failed-precondition','Không tìm thấy dữ liệu chấm điểm.');
    const priv=pSnap.data();
    if(!Number.isFinite(Number(priv.totalScore))) throw new HttpsError('failed-precondition','Bài chưa có tổng điểm hợp lệ.');
    const at=now();
    const vars=emailVars(attempt,priv,systemSettings);
    const subject=renderTemplate(systemSettings.email.resultSubject,vars,false);
    const text=renderTemplate(systemSettings.email.resultText,vars,false);
    const html=renderTemplate(systemSettings.email.resultHtml,vars,true);
    const emailEnabled=Boolean(systemSettings.email.enabled);
    const notificationStatus=!emailEnabled?'email_disabled':attempt.studentEmail?'queued':'no_email';
    tx.update(aRef,{
      status:'published',publishedAt:at,updatedAt:at,
      autoScore:Number(priv.autoScore||0),manualScores:priv.manualScores||{},sectionScores:priv.sectionScores||{},
      totalScore:Number(priv.totalScore),result:priv.result||'',reviewerId:priv.reviewerId||null,reviewerName:priv.reviewerName||null,feedback:priv.feedback||''
    });
    tx.set(notificationRef,{type:'result_published',status:notificationStatus,to:attempt.studentEmail||'',studentId:attempt.studentId,attemptId,subject,text,html,createdAt:at},{merge:false});
    tx.set(auditRef,{at,userId:user.id,userName:user.name||'',action:'publish_result',entityType:'attempt',entityId:attemptId,detail:{studentId:attempt.studentId,emailEnabled,notificationStatus}},{merge:false});
    return {status:'published',alreadyPublished:false,notificationStatus};
  });

  const email=await deliverResultEmail(attemptId);
  return {...publication,email};
});

exports.retryResultEmail = onCall({region:REGION,timeoutSeconds:60},async request=>{
  const uid=requireAuth(request),user=await getUser(uid);
  if(!isTeacher(user)) throw new HttpsError('permission-denied','Chỉ giáo viên được gửi lại email kết quả.');
  const attemptId=request.data?.attemptId;
  if(!attemptId) throw new HttpsError('invalid-argument','Thiếu mã lượt thi.');
  const aSnap=await db.collection('attempts').doc(attemptId).get();
  if(!aSnap.exists) throw new HttpsError('not-found','Không tìm thấy lượt thi.');
  const attempt={id:aSnap.id,...aSnap.data()};
  const exam=await loadExam(attempt.examId);
  if(!(user.role==='master'||exam.ownerId===user.id)) throw new HttpsError('permission-denied','Chỉ giáo viên tạo bài hoặc Quản trị cấp cao được gửi lại email.');
  if(attempt.status!=='published') throw new HttpsError('failed-precondition','Kết quả chưa được công bố.');
  const result=await deliverResultEmail(attemptId);
  await db.collection('auditLog').add({at:now(),userId:user.id,userName:user.name||'',action:'retry_result_email',entityType:'attempt',entityId:attemptId,detail:{status:result.status}});
  return result;
});
