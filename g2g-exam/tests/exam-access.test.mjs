import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {promotionTarget,STUDENT_LEVELS,normalizeStudentLevel} from '../src/domain/student-profile.js';
import {resultSummary} from '../src/domain/result-summary.js';
import {studentExamCardHtml,studentHomeHtml} from '../src/views/student.js';
import {resultSummaryHtml} from '../src/views/result-summary.js';
import {studentProfileCardHtml,studentShareText,profileStats,bindStudentName} from '../src/views/student-profile-card.js';
import {examAccessFormHtml} from '../src/views/exam-access.js';
import {classFormHtml,classesHtml} from '../src/views/classes.js';
import {openStudentProfile} from '../src/views/classes.js';
import {openClassEnrollment} from '../src/views/class-enrollment.js';

// Minimal dialog adapter: exercise submit handlers without opening a browser.
{
  const previousDocument=globalThis.document;
  let active;
  const element=()=>({value:'',disabled:false,focus(){},addEventListener(){}});
  globalThis.document={
    getElementById:()=>active,
    body:{append(modal){active=modal;}},
    createElement(){
      const button=element(),error={textContent:''},choice={hidden:true,innerHTML:'',querySelector:()=>element()};
      const form={elements:{name:element(),confirmationCode:element(),code:element(),classId:{value:'class1'}},
        querySelector:selector=>selector==='[data-error]'?error:selector==='[data-class-choice]'?choice:button,
        requestSubmit(){this.pending=this.onsubmit({preventDefault(){},currentTarget:this});}};
      return {form,button,error,choice,addEventListener(){},remove(){if(active===this)active=null;},
        set innerHTML(value){this.html=value;form.elements.code.value=value.match(/value="([^"]*)" name="code"/)?.[1]||'';},
        querySelector:selector=>selector==='form'?form:selector==='[data-dismiss]'?null:element()};
    }
  };
  try{
    const student={id:'student',name:'Name',level:'A1'},data={classes:[{id:'external',code:'Extend'}]};
    const calls=[];
    const repo={mode:'api',reload:async()=>{},call:async(action,payload)=>{
      calls.push({action,payload});
      if(action==='verifyClassCode'){
        if(payload.code==='WRONG')throw new Error('Mã không hợp lệ');
        return {classes:[{id:'class1',code:'A1-01'}]};
      }
    }};
    for(const code of ['', 'ABCDE']){
      calls.length=0;
      openStudentProfile({data,student,repo,onSaved:async()=>{},required:true});
      const modal=active;
      assert.ok(modal.html.includes('Hoàn tất thông tin</h2>'));
      assert.ok(modal.html.includes('noi-hop--compact'));
      assert.ok(!modal.html.includes('Trình độ ban đầu'));
      assert.ok(!modal.html.includes('data-sign-out'));
      assert.ok(!modal.html.includes('<label>Họ và tên đầy đủ'));
      assert.ok(!modal.html.match(/name="confirmationCode"[^>]*\brequired\b/));
      modal.form.elements.name.value='Nguyen Van A';
      modal.form.elements.confirmationCode.value=code;
      await modal.form.onsubmit({preventDefault(){},currentTarget:modal.form});
      assert.equal(calls[0].action,'saveStudentProfile');
      if(code){
        await active.form.pending;
        assert.equal(calls[1].action,'verifyClassCode');
        assert.equal(active.choice.hidden,false);
        assert.ok(active.html.includes('Nhập mã đã được giáo viên cung cấp'));
        await active.form.onsubmit({preventDefault(){},currentTarget:active.form});
        assert.equal(calls[2].action,'enrollInClass');
        assert.equal(calls[2].payload.classId,'class1');
      }
      assert.equal(active,null);
    }
    openClassEnrollment({repo,user:student,onSaved:async()=>{},initialCode:'WRONG'});
    await active.form.pending;
    assert.equal(active.error.textContent,'Mã không hợp lệ');
    assert.equal(active.choice.hidden,true);
    openStudentProfile({data,student:{...student,level:'B1'},repo,onSaved:async()=>{}});
    assert.ok(active.html.includes('Trình độ: B1'));
    assert.ok(!active.html.includes('Cập nhật khi đỗ đề thi.'));
    assert.ok(!active.html.includes('<label>Họ và tên đầy đủ'));
  }finally{globalThis.document=previousDocument;}
}

assert.equal(STUDENT_LEVELS.length,6);
assert.equal(normalizeStudentLevel('A1.2'),'A1');
assert.equal(normalizeStudentLevel('A1x2'),null);
assert.equal(promotionTarget('A1','A1',true),'A1');
assert.equal(promotionTarget('B2','A1',true),'A1');
const classTeachers=[{id:'t1',name:'Cô Lan',role:'teacher',picture:'https://example.com/lan.jpg'},{id:'t2',name:'Cô Mai',role:'teacher'},{id:'s',name:'Student',role:'student'}];
const classItem={id:'c',code:'A1-01',description:'Lớp <mới>',teacherIds:['t1','t2']};
const classForm=classFormHtml(classItem,classTeachers);
assert.ok(classForm.includes('name="description"'));
assert.equal((classForm.match(/ checked/g)||[]).length,2);
assert.ok(classForm.includes('lan.jpg'));
assert.ok(!classForm.includes('value="s"'));
assert.ok(classesHtml({data:{classes:[classItem],users:classTeachers}}).includes('Lớp &lt;mới&gt;'));
const settingsHtml=examAccessFormHtml({title:'<Exam>',provider:'GOETHE',level:'A1',hidden:true,learningLevel:'A1.2'});
assert.ok(settingsHtml.includes('&lt;Exam&gt;'));
for(const label of ['Quyền truy cập','Trình độ','Mã thi','Lưu thay đổi','Tạo mã'])assert.ok(settingsHtml.includes(label));
assert.ok(settingsHtml.includes('data-settings-status'));
assert.ok(settingsHtml.includes('data-code-status'));
assert.ok(settingsHtml.includes('access-level-row'));
const controlCss=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
for(const selector of ['.profile-form select','.grade-filters select','.exam-filter select','.access-code-create input'])assert.ok(controlCss.includes(selector));
for(const file of ['builder','admin']){
  const source=readFileSync(new URL(`../src/views/${file}.js`,import.meta.url),'utf8');
  assert.match(source,/class="icon-btn" title="Cài đặt đề" aria-label="Cài đặt đề" data-action="exam-access-settings"/);
  assert.ok(!source.includes('>Cài đặt đề</button>'));
}
assert.equal(promotionTarget('A1.1','B1.1',true),'B1');
assert.equal(promotionTarget('A1.1','B1.1',false),null);
assert.equal(promotionTarget('B2.1','A1.1',true),'A1');
assert.equal(promotionTarget('C2.2','C2.2',true),'C2');
assert.equal(promotionTarget('C2.1','C2.2',true),'C2');
assert.equal(promotionTarget('A1.1',null,true),null);
const exam={id:'e',provider:'TELC',level:'B1',learningLevel:'B1.1',status:'published',title:'Exam',sections:[]};
const questions=[];
for(const [skill,max] of Object.entries({reading:75,grammar:30,listening:75,writing:45})){
  exam.sections.push({id:skill,name:skill,skillKey:skill,timeMinutes:10,questionIds:[skill]});
  questions.push({id:skill,maxScore:max});
}
const marks={scoringVersion:2,sectionScores:{reading:75,grammar:30,listening:30,writing:0},manualScores:{},oralScore:45,oralMax:75};
assert.equal(resultSummary(exam,questions,marks).passed,true);
assert.equal(resultSummary(exam,questions,{...marks,oralScore:44.5}).passed,false);
assert.equal(resultSummary(exam,questions,{...marks,oralScore:null}).complete,false);
assert.ok(resultSummaryHtml(resultSummary(exam,questions,marks)).includes('135/225'));
const data={exams:[exam],questions,attempts:[],users:[]};
assert.ok(studentExamCardHtml({...exam,hidden:true,hasActiveCodes:true},[],data).includes('Nhập mã'));
assert.ok(studentExamCardHtml({...exam,hidden:true,hasActiveCodes:false},[],data).includes('Không có mã thi'));
assert.ok(!studentExamCardHtml({...exam,hidden:true},[],data).includes('data-action="start"'));
assert.ok(studentHomeHtml({data,user:{id:'s',name:'Student'},levelFilter:'B1.1'}).includes('Nhập mã đề'));
console.log('Access UI, TELC gates, exact exam-level assignment passed.');
const student={id:'s',name:'Lan <script>',level:'B1',classId:'c',picture:'https://example.com/avatar.jpg'};
const profileData={...data,classes:[{id:'c',code:'PRIVATE-CLASS'}]};
const profile=studentProfileCardHtml(profileData,student);
assert.ok(profile.includes('Lan &lt;script&gt;'));
assert.ok(profile.includes('PRIVATE-CLASS'));
assert.ok(profile.includes('B1'));
assert.ok(profile.includes('data-action="share-profile"'));
assert.ok(profile.includes('data-edit-student-name'));
for(const text of ['learner-steps','HỒ SƠ HỌC VIÊN','Mã lớp ·','Hạng theo trình độ','Bài đã chấm'])assert.ok(!profile.includes(text));
assert.ok(profile.includes('Bài đã thi'));
const counts=profileStats({...data,attempts:[
  {id:'done',studentId:'s',status:'published',result:'Đạt'},
  {id:'pending',studentId:'s',status:'submitted'},
  {id:'grading',studentId:'s',status:'grading'},
  {id:'active',studentId:'s',status:'in_progress'},
  {id:'abandoned',studentId:'s',status:'abandoned'}
]},student);
assert.equal(counts.taken,3);assert.equal(counts.published,1);
assert.ok(!studentShareText(profileData,student).includes('PRIVATE-CLASS'));
const home=studentHomeHtml({data:profileData,user:student});
assert.ok(!home.includes('Xin chào'));
assert.ok(!home.includes('Xem toàn bộ kết quả'));
assert.ok(!home.includes('Chọn bài thi để bắt đầu.'));
assert.ok(home.includes('data-exam-provider-filter'));
assert.ok(home.includes('data-exam-level-filter'));
const rosterData={classes:[classItem,{id:'ext',code:'Extend'}],users:[
  {id:'outside',name:'Nguyen & Lan',email:'lan@example.test',role:'student',classId:'ext',level:'A1',confirmationCode:'ABCDE'},
  {id:'inside',name:'Class Student',email:'in@example.test',role:'student',classId:'c',level:'B1'}
]};
const classList=classesHtml({data:rosterData});
assert.ok(classList.includes('data-open-class="c"'));
assert.ok(classList.includes('data-student-search'));
assert.ok(classList.includes('Mã xác nhận'));
assert.ok(classList.includes('ABCDE'));
assert.ok(classList.includes('data-copy-confirmation="ABCDE"'));
assert.ok(classList.includes('Nguyen &amp; Lan'));
assert.ok(!classList.includes('Class Student'));
const roster=classesHtml({data:rosterData,classId:'c'});
assert.ok(roster.includes('Class Student'));
assert.ok(!roster.includes('lan@example.test'));
assert.ok(roster.includes('data-class-back'));
assert.ok(studentProfileCardHtml(rosterData,rosterData.users[0]).includes('data-action="class-enrollment"'));
assert.ok(!studentProfileCardHtml(rosterData,rosterData.users[1]).includes('data-action="class-enrollment"'));
// Inline editing is tested without opening a browser.
const editButton={focus(){}},nameInput={value:'',focus(){},select(){},disabled:false};
const nameForm={elements:{name:nameInput},hidden:true},nameTitle={hidden:false},nameStatus={textContent:''};
const nameNodes={'[data-edit-student-name]':editButton,'[data-name-form]':nameForm,'[data-student-name]':nameTitle,'[data-name-status]':nameStatus};
const calls=[];let savedCount=0;
bindStudentName({querySelector:key=>nameNodes[key]},{user:{id:'s',name:'Original Name'},repo:{mode:'api',call:async(...args)=>calls.push(args),reload:async()=>{}},onSaved:async()=>savedCount++});
editButton.onclick();assert.equal(nameForm.hidden,false);assert.equal(nameTitle.hidden,true);
nameInput.value='Changed Name';nameInput.onkeydown({key:'Escape',preventDefault(){}});
assert.equal(nameForm.hidden,true);assert.equal(calls.length,0);
editButton.onclick();nameInput.value='Only';nameInput.onblur();
assert.ok(nameStatus.textContent.includes('họ và tên'));assert.equal(calls.length,0);
nameInput.value='  Changed   Name ';await nameInput.onblur();
assert.deepEqual(calls,[['saveStudentName',{name:'Changed Name'}]]);
assert.equal(savedCount,1);assert.equal(nameForm.hidden,true);
console.log('Student profile: real level, class, safe sharing and removed legacy overview passed.');
