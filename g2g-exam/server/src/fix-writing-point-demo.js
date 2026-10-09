// Explicit repair of the user-approved draft only; preserve all other content.
import {mkdir,writeFile} from 'node:fs/promises';
import {pool,withTx,audit} from './db.js';
import {normalizeWritingRows,writingFormScore} from './writing-form.js';
const examId='exam-muyyimz4-2nw10x',questionId='q-muzfny20-izfjcr';
try{
  console.log(JSON.stringify(await withTx(async c=>{
    const exam=(await c.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[examId])).rows[0];
    const question=(await c.query('SELECT * FROM questions WHERE id=$1 FOR UPDATE',[questionId])).rows[0];
    if(!exam||exam.status!=='draft'||exam.locked||!question||question.locked)throw Error('Expected unlocked draft');
    if(!exam.data.sections.some(s=>s.name==='Viết 1'&&s.questionIds.includes(questionId)))throw Error('Unexpected part');
    if((await c.query('SELECT 1 FROM attempts WHERE exam_id=$1 LIMIT 1',[examId])).rowCount)throw Error('Draft has attempts');
    const others=(await c.query('SELECT data FROM exams WHERE id<>$1',[examId])).rows;
    if(others.some(e=>e.data.sections?.some(s=>s.questionIds?.includes(questionId))))throw Error('Shared question');
    const rubric=normalizeWritingRows(question.data.rubric);
    const find=label=>rubric.filter(r=>!r.hidden&&r.label===label);
    const name=find('Name, Vorname:'),phone=find('Telefon:'),street=find('Straße, Hausnummer:');
    if(name.length!==1||phone.length!==1||![1,2].includes(street.length))throw Error('Unexpected fields');
    if(street.length===2){
      if(street.some(r=>!r.answers||r.answers.includes('|')))throw Error('Review address variants before merging');
      street[0].answers=street.map(r=>r.answers.trim()).join(' ');
      rubric.splice(rubric.indexOf(street[1]),1);
    }
    for(const row of [name[0],phone[0],street[0]])row.maxScore=.33;
    await mkdir('/data/operator-backups',{recursive:true,mode:0o700});
    const backup=`/data/operator-backups/writing-point-fix-${Date.now()}.json`;
    await writeFile(backup,JSON.stringify({exam,question}),{flag:'wx',mode:0o600});
    const data={...question.data,rubric,maxScore:writingFormScore(rubric),updatedAt:new Date().toISOString()};
    await c.query('UPDATE questions SET data=$2::jsonb,updated_at=now() WHERE id=$1',[questionId,JSON.stringify(data)]);
    await audit(null,'fix_writing_point_group','exam',examId,{questionId,backup},c);
    return {questionId,score:data.maxScore,firstGroup:[name[0],phone[0],street[0]].map(r=>({label:r.label,score:r.maxScore})),backup};
  })));
}finally{await pool.end();}
