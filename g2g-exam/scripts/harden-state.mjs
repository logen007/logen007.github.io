import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../server/src/state.js');
let source=fs.readFileSync(file,'utf8');

const oldGroupDelete=`  if(op.kind==='delete'){
    if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xóa vĩnh viễn cụm câu hỏi.');
    await c.query(\`DELETE FROM question_groups WHERE id=$1\`,[op.id]);
    return;
  }`;
const newGroupDelete=`  if(op.kind==='delete'){
    if(user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được xóa vĩnh viễn cụm câu hỏi.');
    const row=current.rows[0];
    if(!row)return;
    if(row.status!=='trash')throw appError(409,'Hãy đưa cụm câu hỏi vào Thùng rác trước khi xóa vĩnh viễn.');
    const ids=[...new Set(row.data?.questionIds||[])];
    if(ids.length){
      const exams=await c.query(\`SELECT id,data FROM exams\`);
      const referenced=exams.rows.some(exam=>(exam.data?.sections||[]).some(section=>(section.questionIds||[]).some(id=>ids.includes(id))));
      if(referenced)throw appError(409,'Cụm vẫn có câu hỏi đang được dùng trong bài thi.');
      await c.query(\`DELETE FROM questions WHERE id = ANY($1::text[])\`,[ids]);
    }
    await c.query(\`DELETE FROM question_groups WHERE id=$1\`,[op.id]);
    return;
  }`;
if(source.includes(oldGroupDelete))source=source.replace(oldGroupDelete,newGroupDelete);
else if(!source.includes('Hãy đưa cụm câu hỏi vào Thùng rác trước khi xóa vĩnh viễn.'))throw new Error('Không tìm thấy block delete question group.');

const groupOwner=`  if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa cụm câu hỏi này.');\n`;
if(!source.includes("old.status==='trash'&&item.status!=='trash'"))source=source.replace(groupOwner,groupOwner+`  if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục cụm câu hỏi.');\n`);

const questionLine="  const old=current.rows[0];if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa câu hỏi này.');if(old.locked&&user.role!=='master')throw appError(409,'Câu hỏi đã khóa vì đang được dùng trong đề.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu câu hỏi.');";
const questionNew="  const old=current.rows[0];if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa câu hỏi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục câu hỏi.');if(old.locked&&user.role!=='master')throw appError(409,'Câu hỏi đã khóa vì đang được dùng trong đề.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu câu hỏi.');";
if(source.includes(questionLine))source=source.replace(questionLine,questionNew);

const examLine="  const old=current.rows[0],oldData=old.data||{};if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa bài thi này.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu bài thi.');";
const examNew="  const old=current.rows[0],oldData=old.data||{};if(!(user.role==='master'||old.owner_id===user.id))throw appError(403,'Không có quyền sửa bài thi này.');if(old.status==='trash'&&item.status!=='trash'&&user.role!=='master')throw appError(403,'Chỉ Quản trị cấp cao được khôi phục bài thi.');if(item.ownerId&&item.ownerId!==old.owner_id)throw appError(403,'Không được chuyển chủ sở hữu bài thi.');";
if(source.includes(examLine))source=source.replace(examLine,examNew);

fs.writeFileSync(file,source);
console.log('server state trash authorization hardened');
