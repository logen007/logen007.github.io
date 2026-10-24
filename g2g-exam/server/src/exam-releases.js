import {query,withTx,appError,audit} from './db.js';
import {validateExamForPublish} from '../../src/domain/exams.js';
import {releaseHash,publicationLabel} from './exam-release-content.js';
import {isPrefilledQuestion} from '../../src/domain/question-display.js';

const cache=new Map(),limit=16*1024*1024;
let cacheBytes=0;
function remember(key,snapshot){
  const size=Buffer.byteLength(JSON.stringify(snapshot));
  if(size>limit)return;
  if(cache.has(key)){cacheBytes-=cache.get(key).size;cache.delete(key);}
  cache.set(key,{snapshot:structuredClone(snapshot),size});cacheBytes+=size;
  while(cacheBytes>limit){const first=cache.keys().next().value;cacheBytes-=cache.get(first).size;cache.delete(first);}
}
export async function releasedExam(exam,client={query}){
  if(!exam.publicationVersion)return exam;
  const key=exam.id+':'+exam.publicationVersion;
  let snapshot=cache.get(key)?.snapshot;
  if(!snapshot){
    const row=(await client.query('SELECT snapshot FROM exam_releases WHERE exam_id=$1 AND version=$2',[exam.id,exam.publicationVersion])).rows[0];
    if(!row)throw appError(409,'Không tìm thấy phiên bản đề đã xuất bản.');
    snapshot=row.snapshot;
    remember(key,snapshot);
  }
  return {...structuredClone(snapshot),hidden:exam.hidden,learningLevel:exam.learningLevel,status:exam.status,locked:exam.locked};
}

// Caller holds the exam row lock. Baseline mode freezes legacy published content
// before edits without imposing new validation on existing exams.
export async function createExamRelease(client,row,{baseline=false,onProgress=()=>{}}={}){
  onProgress('checking');
  const exam={...row.data,id:row.id,ownerId:row.owner_id,status:row.status};
  const ids=[...new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]))];
  const rows=ids.length?(await client.query('SELECT id,data,status FROM questions WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',[ids])).rows:[];
  const questions=rows.map(q=>({...q.data,id:q.id,status:q.status}));
  if(!baseline){
    const errors=validateExamForPublish({questions},exam);
    if(errors.length)throw appError(400,errors.join('\n'));
  }
  onProgress('version');
  const hash=releaseHash(exam,questions);
  const previous=(await client.query('SELECT version,content_hash,snapshot FROM exam_releases WHERE exam_id=$1 ORDER BY version DESC LIMIT 1',[exam.id])).rows[0];
  const unchanged=previous?.content_hash===hash;
  const version=unchanged?previous.version:Number(previous?.version||0)+1;
  const label=publicationLabel(version);
  const snapshot=unchanged?previous.snapshot:{...exam,status:'published',publicationVersion:version,publicationLabel:label,questionCount:questions.filter(q=>!isPrefilledQuestion(q)).length,questionSnapshot:questions,scoringPolicyVersion:1};
  onProgress('cache');
  if(!unchanged)await client.query('INSERT INTO exam_releases(exam_id,version,content_hash,snapshot) VALUES($1,$2,$3,$4::jsonb)',[exam.id,version,hash,JSON.stringify(snapshot)]);
  await client.query("UPDATE exams SET status='published',data=data||$2::jsonb,updated_at=now() WHERE id=$1",[exam.id,JSON.stringify({publicationVersion:version,publicationLabel:label})]);
  return {examId:exam.id,version:label,publicationVersion:version,snapshot,reused:unchanged};
}

export async function publishExamRelease(user,{examId},onProgress=()=>{}){
  if(!['master','teacher'].includes(user.role))throw appError(403,'Không có quyền xuất bản đề.');
  const result=await withTx(async client=>{
    const row=(await client.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[examId])).rows[0];
    if(!row||row.status==='trash')throw appError(404,'Không tìm thấy đề thi.');
    if(row.data.kind==='speaking')throw appError(409,'Xuất bản đề nói bằng trình biên soạn đề nói.');
    if(user.role!=='master'&&row.owner_id!==user.id)throw appError(403,'Không có quyền xuất bản đề.');
    const release=await createExamRelease(client,row,{onProgress});
    await audit(user,'publish','exam',examId,{version:release.version,reused:release.reused},client);
    return release;
  });
  remember(result.examId+':'+result.publicationVersion,result.snapshot);
  const {snapshot,...receipt}=result;
  return receipt;
}

export async function unpublishExamRelease(user,{examId}){
  if(!['master','teacher'].includes(user.role))throw appError(403,'Không có quyền bỏ xuất bản đề.');
  return withTx(async client=>{
    const row=(await client.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[examId])).rows[0];
    if(!row||row.status==='trash')throw appError(404,'Không tìm thấy đề thi.');
    if(row.data.kind==='speaking')throw appError(409,'Bỏ xuất bản đề nói bằng trình biên soạn đề nói.');
    if(user.role!=='master'&&row.owner_id!==user.id)throw appError(403,'Không có quyền bỏ xuất bản đề.');
    await client.query("UPDATE exams SET status='draft',data=data||'{\"status\":\"draft\"}'::jsonb,updated_at=now() WHERE id=$1",[examId]);
    await audit(user,'unpublish','exam',examId,{},client);
    return {examId,status:'draft'};
  });
}
