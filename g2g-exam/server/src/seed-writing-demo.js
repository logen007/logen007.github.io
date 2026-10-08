// Explicit operator command; never runs on startup. Back up before changing the draft.
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pool,withTx,audit} from './db.js';
const production=new URL('../../public/src/controllers/writing-demo.js',import.meta.url);
const {patientWritingDemo}=await import(existsSync(production)?production.href:new URL('../../src/controllers/writing-demo.js',import.meta.url).href);
const examId=process.argv[2];
if(examId!=='exam-muyyimz4-2nw10x')throw new Error('Only the user-approved demo exam is allowed.');
try{
  const result=await withTx(async c=>{
    const exam=(await c.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[examId])).rows[0];
    if(!exam||exam.status!=='draft'||exam.locked)throw new Error('Expected an unlocked draft.');
    if((await c.query('SELECT 1 FROM attempts WHERE exam_id=$1 LIMIT 1',[examId])).rowCount)throw new Error('Exam has attempts; do not replace its content.');
    const section=exam.data.sections.find(s=>s.name==='Viết 1');
    if(section?.questionIds?.length!==1)throw new Error('Expected one Writing 1 form.');
    const question=(await c.query('SELECT * FROM questions WHERE id=$1 FOR UPDATE',[section.questionIds[0]])).rows[0];
    if(!question||question.locked)throw new Error('Question not editable.');
    const refs=(await c.query('SELECT id,data FROM exams WHERE id<>$1',[examId])).rows;
    if(refs.some(e=>e.data.sections?.some(s=>s.questionIds?.includes(question.id))))throw new Error('Question shared with another exam.');
    const backupDir='/data/operator-backups';await mkdir(backupDir,{recursive:true,mode:0o700});
    const backup=`${backupDir}/writing-demo-${Date.now()}.json`;
    await writeFile(backup,JSON.stringify({exam,question}),{flag:'wx',mode:0o600});
    const demo=patientWritingDemo();
    section.instruction=demo.instruction;section.instructionImageUrl='';
    section.questionProfile={...section.questionProfile,layout:'form-fields',formFrame:true,audio:false};
    const next={...question.data,...demo.question,updatedAt:new Date().toISOString()};
    await c.query('UPDATE questions SET data=$2::jsonb,updated_at=now() WHERE id=$1',[question.id,JSON.stringify(next)]);
    await c.query('UPDATE exams SET data=$2::jsonb,updated_at=now() WHERE id=$1',[examId,JSON.stringify(exam.data)]);
    await audit(null,'seed_patient_writing_demo','exam',examId,{questionId:question.id,backup},c);
    return {examId,questionId:question.id,rows:next.rubric.length,score:next.maxScore,backup};
  });console.log(JSON.stringify(result));
}finally{await pool.end();}
