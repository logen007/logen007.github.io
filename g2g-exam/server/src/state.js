import {query,withTx,audit,appError} from './db.js';
import {publicWritingRows,writingFormScore} from './writing-form.js';

const stripId=x=>{const y=structuredClone(x||{});delete y.id;return y;};
const isTeacher=u=>u?.role==='teacher'||u?.role==='master';
function publicQuestion(data){const q=structuredClone(data||{});delete q.correctAnswer;if(q.writingFormVersion===1)q.rubric=publicWritingRows(q.rubric);else delete q.rubric;if(Array.isArray(q.pairs)){const rights=q.pairs.map(x=>x[1]).sort(()=>Math.random()-.5);q.pairs=q.pairs.map((x,i)=>[x[0],rights[i]]);}return q;}
async function rows(sql,args=[]){return (await query(sql,args)).rows;}
async function allowedExamIds(user){if(user.role==='master')return null;const owned=await rows(`SELECT id FROM exams WHERE owner_id=$1`,[user.id]);const grants=await rows(`SELECT exam_id FROM grading_requests WHERE requester_id=$1 AND status='approved'`,[user.id]);return new Set([...owned.map(x=>x.id),...grants.map(x=>x.exam_id)]);}
function rowEntity(r){return {id:r.id,...(r.data||{})};}
function attemptEntity(r,includePrivate=false){return {id:r.id,...(r.public_data||{}),...(includePrivate?(r.private_data||{}):{})};}

export async function loadState(user){
  const state={schemaVersion:6,revision:Date.now(),users:[],questions:[],exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};
  if(user.role==='student'){
    state.users=[user];
    state.exams=(await rows(`SELECT id,data FROM exams WHERE status='published' ORDER BY updated_at DESC`)).map(rowEntity);
    state.questions=(await rows(`SELECT id,data FROM questions WHERE status<>'trash'`)).map(r=>({id:r.id,...publicQuestion(r.data)}));
    state.attempts=(await rows(`SELECT id,public_data FROM attempts WHERE student_id=$1 ORDER BY created_at DESC`,[user.id])).map(r=>({id:r.id,...r.public_data}));
    state.notifications=(await rows(`SELECT id,data,status FROM notifications WHERE student_id=$1 ORDER BY created_at DESC LIMIT 200`,[user.id])).map(r=>({id:r.id,status:r.status,...r.data}));
    return state;
  }
  state.users=(await rows(`SELECT id,email,role,active,data FROM users ORDER BY created_at DESC`)).map(r=>({id:r.id,email:r.email,role:r.role,active:r.active,...r.data}));
  state.questions=(await rows(`SELECT id,data FROM questions ORDER BY updated_at DESC`)).map(rowEntity);
  state.exams=(await rows(`SELECT id,data FROM exams ORDER BY updated_at DESC`)).map(rowEntity);
  const allowed=await allowedExamIds(user);
  const ars=await rows(`SELECT id,exam_id,public_data,private_data FROM attempts ORDER BY created_at DESC`);
  state.attempts=ars.filter(r=>!allowed||allowed.has(r.exam_id)).map(r=>attemptEntity(r,true));
  const gr=await rows(`SELECT id,exam_id,owner_id,requester_id,status,data FROM grading_requests ORDER BY created_at DESC`);
  state.gradingRequests=gr.filter(r=>user.role==='master'||r.owner_id===user.id||r.requester_id===user.id).map(r=>({id:r.id,examId:r.exam_id,ownerId:r.owner_id,requesterId:r.requester_id,status:r.status,...r.data}));
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
  if(item.writingFormVersion===1)item.maxScore=writingFormScore(item.rubric);
  if(!current.rowCount){if(!isTeacher(user)||item.ownerId!==user.id)throw appError(403,'Không có quyền tạo câu hỏi.');await c.query(`INSERT INTO questions(id,owner_id,status,locked,data) VALUES($1,$2,$3,$4,$5::jsonb)`,[op.id,user.id,item.status||'active',Boolean(item.locked),JSON.stringify(stripId(item))]);return;}
  const old=current.rows[0];if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa câu hỏi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục câu hỏi.');if(old.locked&&user.role!=='master')throw appError(409,'Câu hỏi đã khóa vì đang được dùng trong đề.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu câu hỏi.');
  await c.query(`UPDATE questions SET status=$2,locked=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,item.status||old.status,Boolean(item.locked),JSON.stringify(stripId({...item,ownerId:old.owner_id}))]);
}
async function applyExam(c,user,op){
  const current=await c.query(`SELECT * FROM exams WHERE id=$1 FOR UPDATE`,[op.id]);
  if(op.kind==='delete'){
    if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xóa vĩnh viễn bài thi.');const a=await c.query(`SELECT 1 FROM attempts WHERE exam_id=$1 LIMIT 1`,[op.id]);if(a.rowCount)throw appError(409,'Bài thi đã có lịch sử làm bài nên không thể xóa vĩnh viễn.');await c.query(`DELETE FROM exams WHERE id=$1`,[op.id]);return;
  }
  const item=op.item||{};
  if(!current.rowCount){if(!isTeacher(user)||item.ownerId!==user.id)throw appError(403,'Không có quyền tạo bài thi.');await c.query(`INSERT INTO exams(id,owner_id,status,locked,data) VALUES($1,$2,$3,$4,$5::jsonb)`,[op.id,user.id,item.status||'draft',Boolean(item.locked),JSON.stringify(stripId(item))]);return;}
  const old=current.rows[0],oldData=old.data||{};if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa bài thi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục bài thi.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu bài thi.');
  const structural=JSON.stringify([oldData.level,oldData.passScore,oldData.sections])!==JSON.stringify([item.level,item.passScore,item.sections]);if(old.locked&&structural&&user.role!=='master')throw appError(409,'Bài thi đã có học viên làm nên cấu trúc đã khóa.');
  await c.query(`UPDATE exams SET status=$2,locked=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,item.status||old.status,Boolean(item.locked),JSON.stringify(stripId({...item,ownerId:old.owner_id}))]);
}
async function applyGrading(c,user,op){
  const cur=await c.query(`SELECT * FROM grading_requests WHERE id=$1 FOR UPDATE`,[op.id]);
  if(op.kind==='delete'){if(user.role!=='master')throw appError(403,'Không có quyền xóa yêu cầu chấm.');await c.query(`DELETE FROM grading_requests WHERE id=$1`,[op.id]);return;}
  const item=op.item||{};
  if(!cur.rowCount){if(user.role!=='teacher'||item.requesterId!==user.id)throw appError(403,'Không có quyền gửi yêu cầu chấm.');const ex=await c.query(`SELECT owner_id,data FROM exams WHERE id=$1`,[item.examId]);if(!ex.rowCount||ex.rows[0].owner_id===user.id)throw appError(409,'Yêu cầu chấm không hợp lệ.');await c.query(`INSERT INTO grading_requests(id,exam_id,owner_id,requester_id,status,data) VALUES($1,$2,$3,$4,'pending',$5::jsonb)`,[op.id,item.examId,ex.rows[0].owner_id,user.id,JSON.stringify(stripId(item))]);return;}
  const old=cur.rows[0];if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Chỉ chủ bài hoặc Quản trị cấp cao được duyệt.');if(!['approved','rejected','pending'].includes(item.status))throw appError(400,'Trạng thái yêu cầu không hợp lệ.');await c.query(`UPDATE grading_requests SET status=$2,data=$3::jsonb,updated_at=now() WHERE id=$1`,[op.id,item.status,JSON.stringify(stripId(item))]);
}
async function applyUser(c,user,op){if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được quản lý tài khoản.');if(op.kind==='delete')throw appError(409,'Không xóa tài khoản trực tiếp; hãy vô hiệu hóa tài khoản.');const item=op.item||{};const cur=await c.query(`SELECT * FROM users WHERE id=$1 FOR UPDATE`,[op.id]);if(!cur.rowCount)throw appError(404,'Không tìm thấy tài khoản.');if(op.id===user.id&&item.role&&item.role!=='master')throw appError(409,'Không thể tự hạ quyền tài khoản Quản trị cấp cao.');const old=cur.rows[0],role=['student','teacher','master'].includes(item.role)?item.role:old.role;const data=stripId(item);delete data.email;delete data.role;delete data.active;await c.query(`UPDATE users SET role=$2,active=$3,data=$4::jsonb,updated_at=now() WHERE id=$1`,[op.id,role,item.active!==false,JSON.stringify(data)]);}

export async function commitOperations(user,ops=[]){
  if(!Array.isArray(ops)||ops.length>250)throw appError(400,'Danh sách thay đổi không hợp lệ.');
  return withTx(async c=>{
    for(const op of ops){
      if(!op?.collection||!op.id)throw appError(400,'Thay đổi thiếu dữ liệu.');
      if(op.collection==='questions')await applyQuestion(c,user,op);
      else if(op.collection==='exams')await applyExam(c,user,op);
      else if(op.collection==='gradingRequests')await applyGrading(c,user,op);
      else if(op.collection==='users')await applyUser(c,user,op);
      else throw appError(400,`Không hỗ trợ thay đổi ${op.collection}.`);
    }
    if(ops.length)await audit(user,'commit_changes','system','batch',{count:ops.length},c);
    return {ok:true,count:ops.length};
  });
}
