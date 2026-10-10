import assert from 'node:assert/strict';
import {canonicalSkill,skillScores,skillPassResult,gradeBand,filteredGradebook,telcResult,isStandardTelc} from '../src/domain/gradebook.js';
import {validateStudentProfile} from '../src/domain/student-profile.js';
import {gradebookHtml} from '../src/views/gradebook.js';

const exam={id:'g',provider:'GOETHE',sections:[
  {name:'Hören Teil 1',skillKey:'listening',questionIds:['a','example']},
  {name:'Hören Teil 2',skillKey:'listening',questionIds:['b']},
  {name:'Hören Teil 3',skillKey:'listening',questionIds:['c']},
  {name:'Schreiben Teil 1',skillKey:'writing',questionIds:['w']},
]};
const questions=['a','b','c'].map(id=>({id,maxScore:5})).concat([{id:'example',maxScore:100,example:true},{id:'w',maxScore:15}]);
const attempt={scoringVersion:2,sectionScores:{'Hören Teil 1':3,'Hören Teil 2':3,'Hören Teil 3':3,'Schreiben Teil 1':2},manualScores:{'Viết':7}};
const scores=skillScores(exam,questions,attempt);
assert.equal(canonicalSkill('Đọc hiểu'),'reading');
assert.equal(canonicalSkill('Ngữ pháp'),'grammar');
assert.deepEqual(scores.listening,{score:9,max:15});
assert.deepEqual(scores.writing,{score:9,max:15});
assert.equal(skillPassResult(scores),'Đạt');
assert.equal(skillPassResult({...scores,listening:{score:8.99,max:15}}),'Chưa đạt');
assert.deepEqual(skillScores(exam,questions,{...attempt,oralScore:0,oralMax:15}).speaking,{score:0,max:15});
for(const [score,label] of [[90,'sehr gut'],[89.99,'gut'],[80,'gut'],[70,'befriedigend'],[60,'ausreichend'],[59.99,'nicht bestanden']])assert.equal(gradeBand(score,100).label,label);
assert.equal(gradeBand(null,15),null);

const data={questions,classes:[{id:'class',code:'i1026'}],users:[{id:'s',role:'student',name:'Nguyen A',classId:'class',level:'A1.2'}],exams:[exam,{id:'t',provider:'TELC',sections:[]}],attempts:[
 {id:'first',examId:'g',studentId:'s',status:'published',submittedAt:'2026-10-08',reviewerId:'t1',...attempt},
 {id:'last',examId:'g',studentId:'s',status:'published',submittedAt:'2026-10-09',reviewerId:'t2',...attempt},
 {id:'telc',examId:'t',studentId:'s',status:'published',submittedAt:'2026-10-10',reviewerId:'t2'},
 {id:'pending',examId:'g',studentId:'s',status:'grading',submittedAt:'2026-10-11',reviewerId:'t2'},
]};
assert.equal(filteredGradebook(data)[0].attempt.id,'pending');
assert.equal(filteredGradebook(data).length,3);
assert.equal(filteredGradebook(data,{status:'graded'}).length,2);
assert.equal(filteredGradebook(data,{status:'pending'})[0].attempt.id,'pending');
assert.equal(filteredGradebook({...data,attempts:[...data.attempts,{...data.attempts[0],id:'draft',status:'in_progress'},{...data.attempts[0],id:'abandoned',status:'abandoned'}]}).length,3);
assert.equal(filteredGradebook(data,{reviewerId:'t1'})[0].attempt.id,'first');
assert.equal(filteredGradebook(data,{provider:'TELC'})[0].attempt.id,'telc');
assert.equal(filteredGradebook(data,{level:'A1.1'}).length,0);
assert.equal(filteredGradebook(data,{classId:'missing'}).length,0);
assert.equal(filteredGradebook(data,{studentId:'missing'}).length,0);
assert.equal(validateStudentProfile({name:'  Nguyen   A  ',classId:'class'},data.classes).level,'A1');
assert.throws(()=>validateStudentProfile({name:'Nguyen A',classId:'unknown'},data.classes));
assert.throws(()=>validateStudentProfile({name:'Nguyen A',classId:'class',level:'admin'},data.classes));
console.log('Gradebook: skill aggregation, boundary grades, filters, profile validation passed.');

const telcSkills=(written,oral)=>({reading:{score:Math.min(written,75),max:75},grammar:{score:Math.max(0,Math.min(written-75,30)),max:30},listening:{score:Math.max(0,Math.min(written-105,75)),max:75},writing:{score:Math.max(0,written-180),max:45},...(oral==null?{}:{speaking:{score:oral,max:75}})});
assert.equal(telcResult(telcSkills(135,45)),'ausreichend');
assert.equal(telcResult(telcSkills(150,40)),'nicht bestanden');
assert.equal(telcResult(telcSkills(134.5,75)),'nicht bestanden');
assert.equal(telcResult(telcSkills(200,60)),'gut');
assert.equal(telcResult(telcSkills(225,null)),'Chờ điểm Nói');
assert.equal(telcResult({...telcSkills(135,45),reading:{score:30,max:45}}),'Chưa đủ cấu trúc điểm TELC');
assert.equal(isStandardTelc({provider:'TELC',level:'B1'}),true);
assert.equal(isStandardTelc({provider:'TELC',level:'C1'}),false);
for(const [written,oral,label] of [[225,45,'sehr gut'],[195,45,'gut'],[165,45,'befriedigend'],[164.5,45,'ausreichend']])assert.equal(telcResult(telcSkills(written,oral)),label);
console.log('TELC B1/B2: independent 135/225 and 45/75 gates, grades, missing oral and format scope passed.');

const html=gradebookHtml({data,ui:{}});
const visitorHtml=gradebookHtml({data:{...data,classes:[{id:'class',code:'Extend'}]},ui:{}});
assert.match(visitorHtml,/<\/button><\/td><td><\/td><td>/);
assert.doesNotMatch(visitorHtml,/Học viên Vãng lai/);
assert.ok(html.includes('<td>i1026</td>'));
assert.ok(html.includes('<th>Bài thi</th><th>Lần thi</th>'));
assert.match(html,/<\/button><\/td><td class="attempt-meta">/);
for(const [provider,count] of [['GOETHE',9],['TELC',12]]){
  const empty=gradebookHtml({data:{...data,attempts:[]},ui:{gradeFilters:{provider}}});
  assert.ok(empty.includes(`colspan="${count}"`));
}
assert.ok(html.includes('Giáo viên chấm bài'));
assert.ok(html.includes('data-grade-filter="classId"'));
assert.ok(html.includes('role="tooltip"'));
assert.ok(!html.includes('data-action="edit-oral"'));
assert.ok(!html.includes('<th>Trạng thái</th>'));
assert.ok(!html.includes('<th>Ngữ pháp</th>'));
assert.ok(gradebookHtml({data,ui:{gradeFilters:{provider:'TELC'}}}).includes('<th>Ngữ pháp</th>'));
for(const provider of ['GOETHE','TELC']){
  const page=gradebookHtml({data,ui:{gradeFilters:{provider}}});
  for(const label of ['Bài Thi','<th>Bài thi</th>','<th>Thời gian</th>','<th>Đọc</th>','<th>Nghe</th>','<th>Viết</th>','<th>Nói</th>','data-grade-filter="status"'])assert.ok(page.includes(label),label);
  for(const label of ['Bảng điểm','Bài thi gần nhất','Tổng thời gian','<th>Điểm'])assert.ok(!page.includes(label),label);
  assert.ok(page.includes('class="table-link grade-attempt--graded" data-action="grade-attempt"'));
}
const pendingHtml=gradebookHtml({data,ui:{gradeFilters:{status:'pending'}}});
assert.ok(pendingHtml.includes('data-action="grade-attempt" data-id="pending"'));
assert.ok(!pendingHtml.includes('grade-attempt--graded'));
const gradedHtml=gradebookHtml({data,ui:{gradeFilters:{status:'graded'}}});
assert.ok(!gradedHtml.includes('data-action="edit-oral"'));
const {topbarHtml}=await import('../src/ui/layout.js');
const nav=topbarHtml({user:{role:'teacher',name:'Teacher'},online:true,ui:{adminTab:'grades'}});
assert.ok(nav.includes('<span>Đề Thi</span>'));
assert.ok(nav.includes('<span>Bài Thi</span>'));
assert.ok(!nav.includes('data-tab="grading"'));
assert.ok(!nav.includes('Bảng điểm'));
const {resultSummaryHtml}=await import('../src/views/result-summary.js');
for(const [score,label,key] of [[90,'sehr gut','excellent'],[80,'gut','good'],[70,'befriedigend','satisfactory'],[60,'ausreichend','sufficient'],[59,'nicht bestanden','failed']]){
  const summaryHtml=resultSummaryHtml({provider:'GOETHE',skills:{reading:{score,max:100}},total:score});
  assert.ok(summaryHtml.includes('<th>Kết quả</th>'));
  assert.ok(summaryHtml.includes(`score-${key}">${label}</span>`));
}
const {gradingDetailHtml}=await import('../src/views/builder.js');
const gradingExam={provider:'GOETHE',level:'A1',sections:[{name:'Schreiben Teil 1',questionProfile:{layout:'form-fields'},questionIds:[]},{name:'Schreiben Teil 2',questionIds:['essay']}]};
const gradingData={questions:[{id:'essay',skill:'Viết',type:'writing',maxScore:10}]};
const gradingAttempt={status:'grading',manualScores:{},resultSummary:{provider:'GOETHE',level:'A1',skills:{},total:0}};
const detail=gradingDetailHtml({data:gradingData,exam:gradingExam,attempt:gradingAttempt});
const labels=['Điểm Viết Bài 2','Điểm nói','Nhận xét','Tổng Điểm'];
for(let i=1;i<labels.length;i++)assert.ok(detail.indexOf(labels[i])>detail.indexOf(labels[i-1]));
assert.ok(detail.includes('min="0" max="10"'));
assert.ok(detail.includes('min="0" max="15"'));
assert.ok(!detail.includes('Điểm phần này'));
const reviewed=gradingDetailHtml({data:gradingData,exam:gradingExam,attempt:{...gradingAttempt,status:'published'}});
assert.ok(!reviewed.includes('data-action="save-grade"'));
assert.match(reviewed,/id="gradeOralScore"[^>]*disabled/);
assert.ok(html.indexOf('<th>Bài thi</th>')<html.indexOf('<th>Học viên</th>'));
assert.ok(!detail.includes('Lưu tạm'));
assert.ok(detail.includes('>Công Bố</button>'));
const timedDetail=gradingDetailHtml({data:gradingData,exam:gradingExam,attempt:{...gradingAttempt,examTitle:'Đề kiểm tra',durationSeconds:750,attemptNo:1}});
assert.ok(timedDetail.includes('Lần #1 - 12 phút 30s -'));
assert.ok(timedDetail.includes('<h2>Đề kiểm tra</h2><p class="phu-de">Goethe A1</p>'));
const formQuestion={id:'form',type:'writing',writingFormVersion:1,autoGrade:true,maxScore:2,rubric:[{type:'text',label:'Họ tên',answers:'Anna',maxScore:1},{type:'text',label:'Địa chỉ',answers:'Berlin',maxScore:1}]};
const formDetail=gradingDetailHtml({data:{questions:[formQuestion]},exam:{...gradingExam,sections:[{name:'Viết 1',questionIds:['form']}]},attempt:{...gradingAttempt,answers:{form:{0:'Anna',1:''}}}});
assert.ok(formDetail.includes('Họ tên'));
assert.ok(formDetail.includes('Anna'));
assert.ok(formDetail.includes('(Chưa trả lời)'));
assert.ok(!formDetail.includes('Đã chọn: {'));

const {createGradeAutosave}=await import('../src/ui/grade-autosave.js');
let release,calls=0;
const autosave=createGradeAutosave(async()=>{calls++;if(calls===1)await new Promise(resolve=>release=resolve);return true;});
autosave.change();
const flushing=autosave.flush();
autosave.change();
release();
assert.equal(await flushing,true);
assert.equal(calls,2);
assert.equal(autosave.pending,false);
let succeeds=false;
const retry=createGradeAutosave(async()=>succeeds);
retry.change();
assert.equal(await retry.flush(),false);
assert.equal(retry.pending,true);
succeeds=true;
assert.equal(await retry.flush(),true);
assert.equal(retry.pending,false);
const {teachersAdminHtml}=await import('../src/views/admin.js');
const usersHtml=teachersAdminHtml({user:{id:'admin',role:'master'},data:{classes:[{id:'ext',code:'Extend'},{id:'cls',code:'A1-01'}],users:[
  {id:'t',role:'teacher',name:'Cô Lan',email:'lan@example.com'},
  {id:'s',role:'student',classId:'cls',name:'An Nguyen',email:'an@example.com'},
  {id:'e',role:'student',classId:'ext',name:'Binh Tran',email:'binh@example.com'}
]}});
for(const group of ['teacher','student','external'])assert.equal((usersHtml.match(new RegExp('data-user-group="'+group+'"','g'))||[]).length,1);
assert.ok(usersHtml.includes('data-user-search="an nguyen an@example.com"'));
assert.ok(!usersHtml.includes('Học viên cần đăng nhập'));
const {examAdminHtml}=await import('../src/views/admin.js');
const filteredExams=examAdminHtml({user:{role:'master'},filters:{provider:'TELC',level:'B1'},data:{attempts:[],exams:[
  {id:'g',title:'Goethe Only',provider:'GOETHE',level:'A1'},
  {id:'t',title:'Telc Match',provider:'TELC',level:'B1'},
  {id:'t2',title:'Other Level',provider:'TELC',level:'B2'}
]}});
assert.ok(filteredExams.includes('Telc Match'));
assert.ok(!filteredExams.includes('Goethe Only'));
assert.ok(!filteredExams.includes('Other Level'));
assert.ok(filteredExams.includes('data-admin-exam-filter="provider"'));
assert.ok(filteredExams.includes('data-admin-exam-filter="level"'));
