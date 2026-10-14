import assert from 'node:assert/strict';
import {loadExamCatalog} from '../server/src/exam-catalog.js';
import {loadState} from '../server/src/state.js';
import {stateResponse} from '../server/src/state-response.js';
import {studentHomeHtml} from '../src/views/student.js';
import {examAdminHtml} from '../src/views/admin.js';

export async function catalogBackendScenario({query,teacher,student}){
  const large='PRIVATE_CONTENT_'.repeat(4000);
  await query("INSERT INTO questions(id,owner_id,data) VALUES('catalog-large-q',$1,$2)",[teacher.id,JSON.stringify({title:large,choices:[large,'b'],correctAnswer:0,maxScore:5})]);
  await query("INSERT INTO exams(id,owner_id,status,data) VALUES('catalog-large',$1,'published',$2)",[teacher.id,JSON.stringify({title:'Catalog regression',provider:'TELC',level:'B1',sections:[{id:'s',instruction:large,skill:'Đọc',timeMinutes:90,questionIds:['catalog-large-q']}],settings:{}})]);
  const catalog=await loadExamCatalog(teacher),full=await loadState(teacher);
  assert.equal(catalog.questions.length,0);assert.equal(catalog.attempts.length,0);
  assert.equal(catalog.exams.find(e=>e.id==='catalog-large').questionCount,1);
  assert.equal(catalog.exams.find(e=>e.id==='catalog-large').durationSeconds,5400);
  assert.ok(!JSON.stringify(catalog).includes('PRIVATE_CONTENT_'));
  assert.ok(!JSON.stringify(catalog).includes('questionSnapshot'));
  assert.ok(examAdminHtml({data:catalog,user:teacher}).includes('Catalog regression'));
  assert.match(examAdminHtml({data:catalog,user:teacher}),/<th>Last edit<\/th>/);
  assert.ok(Number.isFinite(Date.parse(catalog.exams.find(e=>e.id==='catalog-large').updatedAt)));
  const studentCatalog=await loadExamCatalog(student);
  assert.ok(studentCatalog.attempts.every(a=>a.studentId===student.id));
  assert.ok(studentCatalog.exams.every(e=>e.status==='published'));
  assert.ok(studentHomeHtml({data:studentCatalog,user:student}).includes('90 phút'));
  await query(`INSERT INTO attempts(id,exam_id,student_id,status,attempt_no,public_data,private_data)
    VALUES('catalog-result','catalog-large',$1,'published',3,$2,$3)`,[student.id,
    JSON.stringify({totalScore:173.5,resultSummary:{skills:{reading:{max:75},grammar:{max:30},listening:{max:75},writing:{max:45},speaking:{max:75}}},answers:{secret:large}}),
    JSON.stringify({examSnapshot:{title:'Frozen exam title',provider:'TELC',level:'B1',questionSnapshot:[{title:large}]},feedback:large})]);
  const resultCatalog=await loadExamCatalog(student),listed=resultCatalog.attempts.find(a=>a.id==='catalog-result');
  assert.equal(listed.examTitle,'Frozen exam title');
  assert.equal(listed.attemptNo,3);
  assert.equal(listed.provider,'TELC');
  assert.equal(listed.level,'B1');
  assert.equal(listed.totalMax,300);
  assert.ok(!JSON.stringify(resultCatalog).includes('PRIVATE_CONTENT_'));
  assert.ok(!JSON.stringify(resultCatalog).includes('questionSnapshot'));
  await query("UPDATE attempts SET status='ready' WHERE id='catalog-result'");
  assert.equal((await loadExamCatalog(student)).attempts.find(a=>a.id==='catalog-result').totalMax,null);
  const reply={header(){return this;},code(){return this;},send(){return null;}};
  const revision=stateResponse(await loadExamCatalog(teacher),{headers:{}},reply).revision;
  assert.equal(stateResponse(await loadExamCatalog(teacher),{headers:{}},reply).revision,revision);
  await query("UPDATE exams SET data=jsonb_set(data,'{title}','\"Changed catalog title\"') WHERE id='catalog-large'");
  assert.notEqual(stateResponse(await loadExamCatalog(teacher),{headers:{}},reply).revision,revision);
  await query("UPDATE questions SET updated_at='2030-01-02T03:04:00Z' WHERE id='catalog-large-q'");
  const afterQuestionEdit=await loadExamCatalog(teacher);
  assert.equal(afterQuestionEdit.exams.find(e=>e.id==='catalog-large').updatedAt,'2030-01-02T03:04:00.000Z');
  const bytes=x=>Buffer.byteLength(JSON.stringify(x));
  assert.ok(bytes(catalog)<bytes(full)/4,'Catalog should be materially smaller than full content');
  console.log('Catalog SQL: permissions, counts, rendering, stable revisions and payload reduction passed ('+bytes(catalog)+' / '+bytes(full)+' bytes).');
}
