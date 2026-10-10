import {query,withTx,audit,appError} from './db.js';
import {deleteTrashedExam} from './trash-delete.js';
import {publicWritingRows,writingFormScore,normalizeWritingRows} from './writing-form.js';
import {expireCodes} from './actions/exam-access.js';
import {preserveAttemptSnapshots} from './exam-snapshots.js';
import {ensureClassCodes} from './actions/class-enrollment.js';

const stripId=x=>{const y=structuredClone(x||{});delete y.id;return y;};
const isTeacher=u=>u?.role==='teacher'||u?.role==='master';
function publicQuestion(data){const q=structuredClone(data||{});if(!q.example)delete q.correctAnswer;if(q.writingFormVersion===1&&!q.example)q.rubric=publicWritingRows(q.rubric);else if(q.writingFormVersion!==1)delete q.rubric;if(Array.isArray(q.pairs)&&!q.example){const rights=q.pairs.map(x=>x[1]).sort(()=>Math.random()-.5);q.pairs=q.pairs.map((x,i)=>[x[0],rights[i]]);}return q;}
async function rows(sql,args=[]){return (await query(sql,args)).rows;}
async function allowedExamIds(user){if(user.role==='master'||user.role==='teacher')return null;return new Set();}
function rowEntity(r){const item={...(r.data||{}),id:r.id,...(r.owner_id?{ownerId:r.owner_id}:{}),...(r.status?{status:r.status}:{}),...(typeof r.locked==='boolean'?{locked:r.locked}:{})};if(item.writingFormVersion===1){item.rubric=normalizeWritingRows(item.rubric);item.maxScore=writingFormScore(item.rubric);}return item;}
function attemptEntity(r,includePrivate=false){return {id:r.id,...(r.public_data||{}),...(includePrivate?(r.private_data||{}):{})};}

export async function loadState(user){
  const state={schemaVersion:6,revision:Date.now(),users:[],questions:[],exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};
  state.classes=await rows(user.role==='student'?'SELECT id,code,active FROM classes WHERE active=true ORDER BY lower(code)':'SELECT id,code,active,description,teacher_ids AS "teacherIds" FROM classes WHERE active=true ORDER BY lower(code)');
  if(user.role==='student'){
    await expireCodes();
    state.users=[user];
    state.exams=(await rows(`SELECT id,data FROM exams WHERE status='published' ORDER BY updated_at DESC`)).map(rowEntity);
    const attempts=await rows(`SELECT id,public_data,private_data,status,exam_id FROM attempts WHERE student_id=$1 ORDER BY created_at DESC`,[user.id]);
    state.attempts=attempts.map(r=>({id:r.id,...r.public_data}));
    const allQuestions=(await rows(`SELECT id,data FROM questions WHERE status<>'trash'`)).map(rowEntity);
    const activeCodes=await rows('SELECT c.exam_id,NOT EXISTS(SELECT 1 FROM exam_code_uses u WHERE u.code_id=c.id AND u.student_id=$1) AS unused FROM exam_codes c WHERE c.expires_at>now()',[user.id]);
    const allowed=new Set();
    state.exams=state.exams.map(exam=>{
      const codeAccess={hasActiveCodes:activeCodes.some(c=>c.exam_id===exam.id),allCodesUsed:activeCodes.some(c=>c.exam_id===exam.id)&&!activeCodes.some(c=>c.exam_id===exam.id&&c.unused)};
      const active=attempts.find(a=>a.exam_id===exam.id&&a.status==='in_progress');
      if(active?.private_data?.examSnapshot){
        const {questionSnapshot,...snapshot}=active.private_data.examSnapshot;
        allQuestions.push(...questionSnapshot);
        for(const q of questionSnapshot)allowed.add(q.id);
        return {...snapshot,hidden:exam.hidden,...codeAccess};
      }
      if(!exam.hidden){for(const section of exam.sections||[])for(const id of section.questionIds||[])allowed.add(id);return exam;}
      const ids=(exam.sections||[]).flatMap(s=>s.questionIds||[]);
      return {id:exam.id,title:exam.title,provider:exam.provider,level:exam.level,learningLevel:exam.learningLevel,status:exam.status,hidden:true,
        ...codeAccess,
        questionCount:allQuestions.filter(q=>ids.includes(q.id)&&!q.example).length,
        sections:(exam.sections||[]).map(s=>({id:s.id,name:s.name,timeMinutes:s.timeMinutes,questionIds:[]}))};
    });
    state.questions=[...new Map(allQuestions.filter(q=>allowed.has(q.id)).map(q=>[q.id,{id:q.id,...publicQuestion(q)}])).values()];
    state.promotions=await rows('SELECT attempt_id AS "attemptId",from_level AS "fromLevel",to_level AS "toLevel" FROM level_promotions WHERE student_id=$1 AND acknowledged_at IS NULL ORDER BY created_at',[user.id]);
    state.notifications=(await rows(`SELECT id,data,status FROM notifications WHERE student_id=$1 ORDER BY created_at DESC LIMIT 200`,[user.id])).map(r=>({id:r.id,status:r.status,...r.data}));
    return state;
  }
  await ensureClassCodes();
  state.users=(await rows(`SELECT u.id,u.email,u.role,u.active,u.data,k.code AS confirmation_code FROM users u
    LEFT JOIN class_confirmation_codes k ON k.student_id=u.id AND k.used_at IS NULL AND k.email=lower(u.email)
      AND u.role='student' AND u.data->>'classId'=(SELECT id FROM classes WHERE lower(code)='extend')
    LEFT JOIN classes c ON c.id=u.data->>'classId'
    ORDER BY u.created_at DESC`)).map(r=>({...r.data,id:r.id,email:r.email,role:r.role,active:r.active,confirmationCode:r.role==='student'?r.confirmation_code:null}));
  state.questions=(await rows(`SELECT id,owner_id,status,locked,data FROM questions ORDER BY updated_at DESC`)).map(rowEntity);
  state.exams=(await rows(`SELECT id,owner_id,status,locked,data FROM exams ORDER BY updated_at DESC`)).map(rowEntity);
  const allowed=await allowedExamIds(user);
  const ars=await rows(`SELECT id,exam_id,public_data,private_data FROM attempts ORDER BY created_at DESC`);
  state.attempts=ars.filter(r=>!allowed||allowed.has(r.exam_id)).map(r=>attemptEntity(r,true));
  if(user.role==='master')state.auditLog=(await rows(`SELECT id,at,user_id,user_name,action,entity_type,entity_id,detail FROM audit_log ORDER BY at DESC LIMIT 1000`)).map(r=>({id:String(r.id),at:r.at,userId:r.user_id,userName:r.user_name,action:r.action,entityType:r.entity_type,entityId:r.entity_id,detail:r.detail}));
  return state;
}

async function applyQuestion(c,user,op){
  const current=await c.query(`SELECT * FROM questions WHERE id=$1 FOR UPDATE`,[op.id]);
  if(op.kind==='delete'){
    if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xóa vĩnh viễn câu hỏi.');
    const ex=(await c.query(`SELECT data FROM exams`)).rows.some(r=>(r.data.sections||[]).some(s=>(s.questionIds||[]).includes(op.id)));
    if(ex)throw appError(409,'Câu hỏi vẫn đang được dùng trong bài thi.');await c.query(`DELETE FROM questions WHERE id=$1`,[op.id]);return;
  }
  const item=op.item||{};
  if(item.writingFormVersion===1){item.rubric=normalizeWritingRows(item.rubric);item.maxScore=writingFormScore(item.rubric);}
  if(!current.rowCount){if(!isTeacher(user)||item.ownerId!==user.id)throw appError(403,'Không có quyền tạo câu hỏi.');await c.query(`INSERT INTO questions(id,owner_id,status,locked,data) VALUES($1,$2,$3,$4,$5::jsonb)`,[op.id,user.id,item.status||'active',Boolean(item.locked),JSON.stringify(stripId(item))]);return;}
  const old=current.rows[0];if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa câu hỏi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục câu hỏi.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu câu hỏi.');
  await c.query(`UPDATE questions SET status=$2,locked=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,item.status||old.status,Boolean(item.locked),JSON.stringify(stripId({...item,ownerId:old.owner_id}))]);
}
async function applyExam(c,user,op){
  const current=await c.query(`SELECT * FROM exams WHERE id=$1 FOR UPDATE`,[op.id]);
  if(op.kind==='delete'){
    if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xóa vĩnh viễn bài thi.');
    await deleteTrashedExam(c,op.id);return;
  }
  const item=op.item||{};
  // Instruction audio was retired; question/example audio remains unchanged.
  if(Array.isArray(item.sections))item.sections=item.sections.map(section=>{
    const {instructionAudioUrl,instructionAudioName,...rest}=section;return rest;
  });
  if(!current.rowCount){if(!isTeacher(user)||item.ownerId!==user.id)throw appError(403,'Không có quyền tạo bài thi.');await c.query(`INSERT INTO exams(id,owner_id,status,locked,data) VALUES($1,$2,$3,$4,$5::jsonb)`,[op.id,user.id,item.status||'draft',Boolean(item.locked),JSON.stringify(stripId(item))]);return;}
  const old=current.rows[0],oldData=old.data||{};if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa bài thi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục bài thi.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu bài thi.');
  await c.query(`UPDATE exams SET status=$2,locked=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,item.status||old.status,Boolean(item.locked),JSON.stringify(stripId({...item,hidden:Boolean(oldData.hidden),learningLevel:oldData.learningLevel||null,ownerId:old.owner_id}))]);
}
async function applyUser(c,user,op){if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được quản lý tài khoản.');if(op.kind==='delete')throw appError(409,'Không xóa tài khoản trực tiếp; hãy vô hiệu hóa tài khoản.');const item=op.item||{};const cur=await c.query(`SELECT * FROM users WHERE id=$1 FOR UPDATE`,[op.id]);if(!cur.rowCount)throw appError(404,'Không tìm thấy tài khoản.');if(op.id===user.id&&item.role&&item.role!=='master')throw appError(409,'Không thể tự hạ quyền tài khoản Quản trị cấp cao.');const old=cur.rows[0],role=['student','teacher','master'].includes(item.role)?item.role:old.role;const data=stripId(item);delete data.email;delete data.role;delete data.active;delete data.confirmationCode;for(const key of ['level','classId','profileCompletedAt']){delete data[key];if(old.data[key]!==undefined)data[key]=old.data[key];}await c.query(`UPDATE users SET role=$2,active=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,role,item.active!==false,JSON.stringify(data)]);}

export async function commitOperations(user,ops=[]){
  if(!Array.isArray(ops)||ops.length>250)throw appError(400,'Danh sách thay đổi không hợp lệ.');
  return withTx(async c=>{
    await preserveAttemptSnapshots(c,ops);
    for(const op of ops){
      if(!op?.collection||!op.id)throw appError(400,'Thay đổi thiếu dữ liệu.');
      if(op.collection==='questions')await applyQuestion(c,user,op);
      else if(op.collection==='exams')await applyExam(c,user,op);
      else if(op.collection==='users')await applyUser(c,user,op);
      else throw appError(400,`Không hỗ trợ thay đổi ${op.collection}.`);
    }
    if(ops.length)await audit(user,'commit_changes','system','batch',{count:ops.length},c);
    return {ok:true,count:ops.length};
  });
}
