import assert from 'node:assert/strict';
import './login.test.mjs';
import './audio-runtime.test.mjs';
import './exam-question-sidebar.test.mjs';
import './letter-answer-groups.test.mjs';
import './courses.test.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {iconHtml} from '../src/ui/icons.js';
import {sectionPromptHtml} from '../src/views/student.js';
{
  const section={instruction:'Before [IMG] After [img]',instructionImageUrl:'/uploads/article.jpg',instructionImageMaxWidth:500};
  const html=sectionPromptHtml(section);
  assert.ok(html.indexOf('Before')<html.indexOf('<img'));
  assert.ok(html.indexOf('<img')<html.indexOf('After'));
  assert.equal((html.match(/<img /g)||[]).length,1);
  assert.doesNotMatch(html,/\[img\]/i);
  assert.match(html,/max-width:500px/);
  assert.doesNotMatch(sectionPromptHtml({...section,instructionImageUrl:''}),/<img|\[img\]/i);
  assert.ok(sectionPromptHtml({...section,instruction:'Before'}).indexOf('<img')>0);
}
import {examHtml,liveExamHtml,studentExamCardHtml,submittedHtml,expiredHtml,answerPresent} from '../src/views/student.js';
const originalStorage=globalThis.sessionStorage;
globalThis.sessionStorage={getItem:()=>null};
{
  const questions=[{id:'one',type:'single',title:'One',choices:['A','B']},{id:'two',type:'single',title:'Two',choices:['A','B']}];
  const exam={id:'live',title:'One page',level:'A1',sections:[{id:'first',name:'Nghe 1',skillKey:'listening',questionIds:['one'],questionProfile:{}},{id:'second',name:'Đọc 1',skillKey:'reading',questionIds:['two'],questionProfile:{}}]};
  const html=liveExamHtml({attempt:{id:'attempt',answers:{two:0}},exam,allQuestions:questions,online:true});
  assert.match(html,/thi--live/);
  assert.match(html,/exam-paper--live/);
  assert.equal((html.match(/data-exam-section=/g)||[]).length,2);
  assert.equal((html.match(/data-question-jump=/g)||[]).length,2);
  assert.match(html,/type="button" class="exam-question-link/);
  assert.match(html,/exam-question-link is-answered/);
  assert.match(html,/aria-label="Nghe"><h3>Nghe<\/h3>[\s\S]*?data-question-jump="one"[^>]*>1<\/button>/);
  assert.match(html,/aria-label="Đọc"><h3>Đọc<\/h3>[\s\S]*?data-question-jump="two"[^>]*>2<\/button>/);
  assert.match(html,/aria-label="Mở danh sách câu hỏi, câu 1"/);
  assert.match(html,/data-exam-question-sidebar-current>1/);
  assert.match(html,/Thời gian còn lại/);
  assert.match(html,/data-exam-sidebar-time-ring/);
  assert.match(html,/Hoàn thành/);
  assert.doesNotMatch(html,/Progress|Câu hỏi đã hoàn thành/);
  assert.doesNotMatch(html,/Chưa làm|Đang xem|Đã làm/);
  assert.doesNotMatch(html,/☰/);
  assert.ok(html.indexOf('exam-question-sidebar-panel')<html.indexOf('exam-question-sidebar-toggle'));
  assert.doesNotMatch(html,/data-action="next-section"|data-action="prev-section"|exam-reading-split/);
}
const longChoices=['geben die Deutschen mehr Geld für Bio-Produkte aus.','gibt es viele Probleme mit schlechten Lebensmitteln.','wester mag südamerikanische Tänze und möchte gern'];
const optionQuestion={id:'long-layout',type:'single',maxScore:1,title:'Question',choices:longChoices};
for(const preview of [false,true]){
  const markup=renderQuestionHtml(optionQuestion,1,{},{preview,mobileThreeChoices:true});
  assert.match(markup,/answer-options--long/);
  assert.equal((markup.match(/type="radio"/g)||[]).length,3);
  assert.match(markup,/value="1" checked/);
}
assert.match(renderQuestionHtml({...optionQuestion,choices:['Ja','Nein']},null,{}),/answer-options--short/);
assert.doesNotMatch(renderQuestionHtml({...optionQuestion,choices:[{text:longChoices[0],imageUrl:'/uploads/a.jpg'},'B','C']},null,{}),/answer-options--long/);
import {readExamAnswers} from '../src/ui/exam-answers.js';
import {examBuilderHtml} from '../src/views/builder.js';
import {topbarHtml} from '../src/ui/layout.js';
import {currentPublicSettings} from '../src/settings/theme.js';
import {dashboardHtml} from '../src/views/admin.js';
import {previewExamModalHtml} from '../src/views/modals.js';
import {mountStudentRuntime} from '../src/part-templates/a1-listening-part-1/student.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {writingFormScore} from '../src/domain/writing-form.js';
import {compactBinaryChoices} from '../src/domain/question-display.js';
import {renderQuestionHtml} from '../src/views/student.js';
{
  const html=renderQuestionHtml({id:'writing-clean',type:'writing',maxScore:10,title:'[b]Eigene Anleitung[/b]'},'Hallo',{id:'preview'},{singleQuestion:true,questionNumber:1,wordRange:[20,30]});
  assert.match(html,/class="question-number">1\.<\/strong>/);
  assert.doesNotMatch(html,/Schreiben Sie 20–30 Wörter/);
  assert.match(html,/<strong class="text-bold">Eigene Anleitung<\/strong>/);
  assert.match(html,/Hallo/);
  assert.match(html,/aria-label="Schriftliche Antwort 1"/);
  assert.match(renderQuestionHtml({id:'writing-numbered',type:'writing',maxScore:10},'',{id:'preview'},{questionNumber:42}),/aria-label="Schriftliche Antwort 42"/);
  assert.match(html,/word-count/);
  for(const writing of [{writingFormVersion:1},{formFrame:true}]){
    const form=renderQuestionHtml({id:'numbered-form',type:'writing',rubric:[],...writing},{},{id:'preview'},{singleQuestion:true,questionNumber:43,formFrame:writing.formFrame});
    assert.match(form,/class="question-number">43\.<\/strong>/,'Writing forms display their global question number');
  }
  const example=renderQuestionHtml({id:'writing-example',type:'writing',example:true},'',{id:'preview'},{questionNumber:40,singleQuestion:true});
  assert.doesNotMatch(example,/class="question-number"/,'Examples never consume or display a question number');
  const questions=[{id:'reading',type:'single',title:'Read',choices:['A','B']},{id:'write1',type:'writing',title:'SMS'},{id:'write2',type:'writing',title:'Email'}];
  const exam={id:'numbered-writing',title:'Writing numbers',level:'A2',sections:questions.map((q,i)=>({id:`section-${i}`,name:i?'Viết':'Đọc',skillKey:i?'writing':'reading',questionIds:[q.id],questionProfile:{}}))};
  const live=liveExamHtml({attempt:{id:'a',answers:{}},exam,allQuestions:questions,online:true});
  assert.deepEqual([...live.matchAll(/class="question-number">(\d+)\.<\/strong>/g)].map(match=>Number(match[1])),[1,2,3],'Writing continues numbering across single-task sections');
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(css,/\.exam-paper \.answer-options--long \{ grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\); \}/,'Text answers fill equal responsive columns instead of always stacking');
}

for(const preview of [false,true]){
  const q={id:'reading-one',type:'single',title:'Aussage',choices:['Richtig','Falsch'],maxScore:1};
  const section={id:'read1',name:'Đọc 1',skillKey:'reading',skill:'Đọc',instructionImageUrl:'/uploads/reading-one.jpg',questionIds:[q.id],questionProfile:{layout:'true-false'}};
  const html=examHtml({attempt:{id:'a',answers:{}},exam:{id:'e',title:'A1',provider:'GOETHE',level:'A1',sections:[section]},sectionIndex:0,questions:[q],allQuestions:[q],online:true,preview});
  assert.match(html,/class="exam-reading-split"/);
  assert.ok(html.indexOf('/uploads/reading-one.jpg')<html.indexOf('aria-label="Aufgaben"'));
  const other=examHtml({attempt:{id:'a',answers:{}},exam:{id:'e',title:'A1',provider:'GOETHE',level:'A1',sections:[{...section,name:'Đọc 3'}]},sectionIndex:0,questions:[q],allQuestions:[q],online:true,preview});
  assert.doesNotMatch(other,/class="exam-reading-split"/);
}
const bootHtml=readFileSync(new URL('../vi.html',import.meta.url),'utf8');
assert.doesNotMatch(bootHtml,/Đang tải Luyện thi tiếng Đức/);
assert.match(bootHtml,/id="bootShell" aria-busy="true"/);
assert.doesNotMatch(bootHtml,/boot-progress|boot-shape|src="\.\/src\/ui\/boot-layout/);
assert.match(bootHtml,/Thử lại/);
assert.doesNotMatch(bootHtml,/boot-card|boot-mark|boot-avatar/);
assert.doesNotMatch(bootHtml,/class="thanh-dau"/);
const landingSource=readFileSync(new URL('../src/views/login.js',import.meta.url),'utf8');
assert.match(landingSource,/Tiếp tục với Google/);
assert.match(landingSource,/Hoàn toàn miễn phí/);
const publicStatsSource=readFileSync(new URL('../server/src/index.js',import.meta.url),'utf8');
assert.ok(publicStatsSource.includes("FROM users WHERE role='teacher'"));
assert.ok(publicStatsSource.includes("FROM attempts WHERE status IN ('grading','ready','published')"));
assert.match(readFileSync(new URL('../src/exam-specs/goethe.js',import.meta.url),'utf8'),/Promise.all/);
const touchStyles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(touchStyles,/\.thi--live \{[^}]*width:min\(1000px,100%\);/);
assert.match(touchStyles,/\.exam-question-sidebar-toggle \{ display:grid; width:36px;/);
assert.match(touchStyles,/\.exam-question-sidebar \{ position:fixed; z-index:20; top:0;[\s\S]*?height:100dvh;/);
assert.match(touchStyles,/\.exam-question-link:hover \{ border-color:var\(--exam-status-blue\);/);
assert.match(touchStyles,/\.exam-question-link\.is-answered \{ border-color:var\(--brand-primary\); background:var\(--brand-primary\); color:var\(--brand-on-primary\);/);
assert.match(touchStyles,/\.exam-question-time-pie \{[\s\S]*?background:conic-gradient/);
assert.match(readFileSync(new URL('../src/ui/exam-question-sidebar.js',import.meta.url),'utf8'),/view\.scrollTo\(\{top,behavior:/);
assert.match(touchStyles,/@media \(any-pointer:coarse\) \{[\s\S]*?select, textarea:not\(\.exam-title-input\), \[contenteditable="true"\][\s\S]*?font-size:16px !important;/);
assert.doesNotMatch(readFileSync(new URL('../vi.html',import.meta.url),'utf8'),/user-scalable\s*=\s*no|maximum-scale\s*=/);
assert.match(readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),/initialFocus\?\.focus\(\{preventScroll:true\}\)/);
let passed=0;
async function test(name,run){
  try{await run();passed++;console.log(`✓ ${name}`);}
  catch(error){console.error(`✗ ${name}`);throw error;}
}

const tags=(html,tag)=>[...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`,'g'))].map(match=>match[0]);
const attribute=(tag,name)=>tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const hasClass=(tag,name)=>(attribute(tag,'class')||'').split(/\s+/).includes(name);
const actionButtons=(html,action)=>tags(html,'button').filter(tag=>attribute(tag,'data-action')===action);
const header=html=>html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0]||'';
const fixture=()=>{
  const questions=[
    {id:'choice',type:'single',prompt:'Choose an answer.',choices:['First','Second']},
    {id:'match',type:'matching',prompt:'Match the items.',pairs:[['One','A'],['Two','B']]},
    {id:'written',type:'writing',prompt:'Write your response.'}
  ];
  const sections=[
    {id:'first',name:'First part',instruction:'Read the instructions.',questionIds:questions.map(q=>q.id),showTimer:true},
    {id:'middle',name:'Middle part',instruction:'',questionIds:[],showTimer:false},
    {id:'last',name:'Last part',instruction:'',questionIds:[],showTimer:true}
  ];
  return {
    attempt:{id:'preview-fixture',answers:{choice:0,match:['','B'],written:'Two words'}},
    exam:{id:'fixture',title:'Preview fixture',level:'A1',sections},
    questions,sectionIndex:0,online:true,preview:true,
    previewSummary:{answered:3,total:3,sections:sections.map((section,index)=>({name:section.name,answered:index===0?3:0,total:index===0?3:0}))}
  };
};

try{
  await test('Section completion requires every matching item and form field, with zero accepted',()=>{
    assert.equal(answerPresent(0,{type:'single'}),true);
    assert.equal(answerPresent('   ',{type:'writing'}),false);
    const matching={type:'matching',pairs:[['One','A'],['Two','B']]};
    assert.equal(answerPresent(['A',''],matching),false);
    assert.equal(answerPresent(['A','B'],matching),true);
    const form={type:'writing',rubric:[{type:'heading'},{type:'text'},{type:'choice'},{type:'signature'},{type:'text',hidden:true}]};
    assert.equal(answerPresent({1:'Name'},form),false);
    assert.equal(answerPresent({1:'Name',2:'Option'},form),true);
  });
  await test('Navigation reads all current controls before a pending autosave fires',()=>{
    const controls={
      '.answer-one':[{dataset:{q:'choice'},checked:true,value:'0'},{dataset:{q:'choice'},checked:false,value:'1'}],
      '.answer-match':[{dataset:{q:'match',i:'0'},value:'A'},{dataset:{q:'match',i:'1'},value:''}],
      '.answer-text':[{dataset:{q:'essay'},value:'Latest edit'}],
      '.answer-form-field':[{dataset:{q:'form',fieldIndex:'1'},type:'text',value:'Name'},{dataset:{q:'form',fieldIndex:'2'},type:'radio',checked:true,value:'Yes'},{dataset:{q:'form',fieldIndex:'2'},type:'radio',checked:false,value:'No'}],
    };
    assert.deepEqual(readExamAnswers({querySelectorAll:selector=>controls[selector]}),{choice:0,match:['A',''],essay:'Latest edit',form:{1:'Name',2:'Yes'}});
  });
  await test('Next saves and advances even with unanswered questions',async()=>{
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    const functionSource=source.slice(source.indexOf('async function moveAttemptSection(delta){'),source.indexOf('async function createNewExam()'));
    const calls=[],answers={first:0};
    const state={attempts:[{id:'attempt',examId:'exam',status:'in_progress',currentSectionIndex:0}],exams:[{id:'exam',sections:[{questionIds:['first','second']},{}]}],questions:[{id:'first',type:'single'},{id:'second',type:'single'}]};
    const context=vm.createContext({guardExamAudio:()=>false,data:state,ui:{attemptId:'attempt'},app:{querySelectorAll:()=>[]},movingAttemptSection:false,user:{},ATTEMPT_STATUS:{IN_PROGRESS:'in_progress'},byId:(items,id)=>items.find(item=>item.id===id),readExamAnswers:()=>answers,answerPresent,revealUnansweredQuestion:(_,id)=>calls.push(id),flushTextAnswers:async()=>{calls.push('save');return true;},repo:{transaction:fn=>fn(state),getState:async()=>state},setAttemptSection:()=>{calls.push('advance');return true;},act:fn=>fn(),render:()=>calls.push('render'),scrollExamToTop:()=>calls.push('top'),notify:()=>{}});
    vm.runInContext(functionSource,context);
    await context.moveAttemptSection(1);
    assert.deepEqual(calls,['save','advance','render','top']);
    calls.length=0;
    context.repo.mode='api';
    context.repo.outbox={move:index=>calls.push('local-next-'+index)};
    context.repo.saveDraftAnswer=()=>calls.push('local-save');
    await context.moveAttemptSection(1);
    assert.deepEqual(calls,['local-save','local-next-1','render','top'],'API Next never waits for server save');
    delete context.repo.mode;delete context.repo.outbox;
    calls.length=0;context.guardExamAudio=()=>true;
    await context.moveAttemptSection(1);
    assert.deepEqual(calls,[]);
    context.guardExamAudio=()=>false;
    answers.second=1;calls.length=0;
    await context.moveAttemptSection(1);
    assert.deepEqual(calls,['save','advance','render','top']);
  });
  await test('Submission screen uses the concise approved message',()=>{
    const html=submittedHtml();
    assert.match(html,/<h1>Đã nộp bài<\/h1>/);
    assert.match(html,/Điểm tạm tính có tại trang kết quả/);
    assert.match(html,/Kết quả chính thức sẽ có sau khi giáo viên chấm và công bố/);
    assert.match(html,/data-action="student-attempt-detail"/);
    assert.match(html,/class="vong thanh-cong"/);
    for(const removed of ['ĐÃ NỘP BÀI THÀNH CÔNG','Đang chờ kết quả','Khi có kết quả','Bài thi đã được ghi nhận'])assert.ok(!html.includes(removed));
  });
  await test('Live exam keeps progress only in navigation and timeout has a home action',()=>{
    const html=examHtml({...fixture(),preview:false,previewSummary:null});
    assert.ok(!html.includes('data-action="exam-select-section"'));
    assert.ok(html.includes('Prüfungszeit:'));
    assert.equal(actionButtons(html,'submit-exam').length,1);
    assert.doesNotMatch(html,/Có giới hạn thời gian/);
    assert.doesNotMatch(html,/>Còn lại</);
    assert.match(html,/class="tien-do"[^>]*><span[^>]*>2\/3<\/span> - <b id="examTimeSummary">/);
    const expired=expiredHtml();
    assert.match(expired,/Leider konnten Sie diesen Prüfungsteil nicht rechtzeitig abschließen\./);
    assert.equal(actionButtons(expired,'student-home').length,1);
  });
  await test('Preview and live exam share the paper and illustrated-answer layout',()=>{
    const sample=fixture();
    sample.exam.sections[0].instruction='Read the instructions.';
    sample.questions[0].choices=[{text:'50 €',imageUrl:'/media/50.png'},{text:'65 €',imageUrl:'/media/65.png'}];
    const preview=examHtml(sample);
    const live=examHtml({...sample,preview:false,previewSummary:null});
    for(const html of [preview,live]){
      assert.match(html,/<div class="exam-paper">/);
      assert.match(html,/class="answer-options answer-options--illustrated"/);
      assert.match(html,/class="preview-question-heading"/);
    }
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.exam-paper \.answer-options--illustrated \.answer-option-body/);
    assert.ok(css.includes('.answer-options--illustrated:has(> .answer-option:nth-child(3)):not(:has(> .answer-option:nth-child(4))) { grid-template-columns:repeat(3,minmax(0,1fr));'),'Three illustrated answers share a row across templates');
    assert.match(css,/\.exam-paper \.cau-thi/);
  });

  await test('German exam section names always include Teil',()=>{
    const sample=fixture();sample.exam.sections[0].name='Nghe 2';
    const html=examHtml({...sample,preview:false,previewSummary:null});
    assert.match(html,/<h1>Hören Teil 2<\/h1>/);
    assert.doesNotMatch(html,/<h1>Hören 2<\/h1>/);
  });
  await test('Nghe 1 keeps three illustrated choices across mobile preview and exam',()=>{
    const sample=fixture();
    sample.exam.sections[0].templateType='A1_LISTENING_PART_1';
    sample.questions[0].choices=[
      {text:'50 €',imageUrl:'/media/50.png'},
      {text:'65 €',imageUrl:'/media/65.png'},
      {text:'60,50 €',imageUrl:'/media/60.png'},
    ];
    for(const preview of [true,false]){
      const html=examHtml({...sample,preview});
      assert.match(html,/class="answer-options answer-options--illustrated answer-options--mobile-three"/);
    }
    sample.exam.sections[0].templateType='OTHER_PART';
    assert.doesNotMatch(examHtml(sample),/answer-options--mobile-three/);
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.exam-paper \.answer-options--mobile-three\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  });
  await test('Example questions show the correct answer without numbering, progress or score controls',()=>{
    const sample=fixture();
    sample.questions[0]={...sample.questions[0],example:true,correctAnswer:1,maxScore:4};
    sample.questions=[sample.questions[1],sample.questions[0],sample.questions[2]];
    sample.exam.sections[0].questionIds=sample.questions.map(question=>question.id);
    sample.attempt.answers={};
    sample.allQuestions=sample.questions;
    sample.previewSummary={answered:0,total:2,sections:[{name:'First part',answered:0,total:2}]};
    const html=examHtml(sample);
    assert.match(html,/class="cau-thi is-example is-answered"/);
    assert.match(html,/<div class="question-example-title">Beispiel<\/div>/);
    assert.match(html,/value="1" checked disabled/);
    assert.ok(html.indexOf('Beispiel')<html.indexOf('Match the items.'),'Example must render before regular questions even when stored later.');
    assert.doesNotMatch(html,/class="question-number"[^>]*>1<\/span>[\s\S]*?Beispiel/);
    assert.match(html,/class="question-number"[^>]*>1\.<\/strong> Match the items/);
    const live=examHtml({...sample,preview:false,previewSummary:null});
    assert.match(live,/0\/2/);
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.cau-thi\.is-example \.answer-option>input:disabled\s*\{[^}]*appearance:none;[^}]*opacity:0/);
  });

  await test('Example questions are excluded from exam modal counts',()=>{
    const html=previewExamModalHtml({title:'Đề mẫu',sections:[{name:'Nghe 1',timeMinutes:10,questionIds:['example','real']}]},[
      {id:'example',example:true},{id:'real',example:false}
    ]);
    assert.match(html,/1 câu · 10 phút/);
    assert.doesNotMatch(html,/2 câu/);
  });

  await test('Adjacent example questions show the Beispiel heading only once',()=>{
    const input=fixture();
    input.questions[0]={...input.questions[0],example:true,correctAnswer:0};
    input.questions[1]={...input.questions[1],example:true,correctAnswer:0};
    input.exam.sections[0].questionIds=input.questions.map(question=>question.id);
    input.allQuestions=input.questions;
    const html=examHtml(input);
    assert.equal((html.match(/question-example-title/g)||[]).length,1);
    assert.equal((html.match(/>Beispiel</g)||[]).length,1);
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.exam-paper \.exam-question-pair\.exam-question-pair--example > \.cau-thi\.is-example,[\s\S]*?\{ margin:0; padding:0; border:0; border-radius:0; background:transparent; \}/,'Grouped examples lose their inner frame even outside the desktop to-thi wrapper');
    assert.equal((html.match(/class="exam-question-pair exam-question-pair--example"/g)||[]).length,1);
    assert.doesNotMatch(html,/class="question-number">_/);
    const exampleStart=html.indexOf('class="exam-question-pair exam-question-pair--example"');
    assert.ok(exampleStart<html.indexOf('data-q="choice"'));
    assert.ok(html.indexOf('data-q="match"')<html.indexOf('data-q="written"'));
  });
  await test('Starting a retake refreshes state and advancing returns to page top',()=>{
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.ok(source.includes('repo.startAttemptSecure(examId,{restart})'),'Starting or retaking opens a fresh server-owned session');
    assert.match(source,/await covered;data=await repo.getState\(\);ui.attemptId=attempt.id;ui.view='exam';startingAttempt=false;render\(\)/);
    assert.match(source,/async function moveAttemptSection\(delta\)[\s\S]*?if\(result\)\{[^}]*render\(\);scrollExamToTop\(\)/);
    assert.match(source,/function showPreviewSection\(index\)[\s\S]*?scrollExamToTop\(\)/);
  });
  await test('Student exam card shows provider, exact duration, four skills and plain new status in footer',()=>{
    const exam={id:'goethe-a1',provider:'GOETHE',level:'A1',title:'Modelltest 1',sections:[{timeMinutes:20,questionIds:[]},{timeMinutes:15,questionIds:[]}]};
    const html=studentExamCardHtml(exam,[],{questions:[]});
    assert.match(html,/class="nhan exam-provider" data-provider="GOETHE">Goethe<\/span>/);
    assert.match(html,/class="nhan exam-level" data-level="A1">A1<\/span>/);
    assert.doesNotMatch(html,/>Goethe A1<\/span>/);
    assert.match(html,/<div class="exam-card-details"><div class="exam-card-tags">[^]*?<\/div><span class="meta">4 kỹ năng · 0 câu<\/span><\/div>/);
    const telc=studentExamCardHtml({...exam,provider:'TELC',level:'B2'},[],{questions:[]});
    assert.match(telc,/data-provider="TELC">Telc<\/span>/);
    assert.match(telc,/data-level="B2">B2<\/span>/);
    assert.match(html,/35 phút/);
    assert.doesNotMatch(html,/THI THỬ|khoảng/);
    assert.match(html,/<div class="exam-card-footer"><span class="exam-card-status exam-new-label">Đề Mới<\/span>/);
    assert.doesNotMatch(html,/Chưa từng thi|class="day"|class="chan"|class="hanh-dong"/);
    assert.match(html,/class="exam-card-footer"[^]*?data-action="start"[^]*?<span>Bắt đầu thi · 35 phút<\/span><svg/);
    assert.doesNotMatch(html,/<div class="meta">[^<]*phút/);
    const cardCss=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(cardCss,/\.exam-card-footer \{[^}]*justify-content:flex-start/);
    assert.match(cardCss,/\.exam-card-status \{ flex:0 0 100%/);
    assert.doesNotMatch(cardCss.match(/\.exam-card-footer>\.nut \{[^}]*\}/)[0],/(?:max-)?width:/);
    const pending=studentExamCardHtml(exam,[{examId:exam.id,status:'submitted'}],{questions:[]});
    assert.doesNotMatch(pending,/the-de-new|Chưa từng thi/);
    const locked=studentExamCardHtml({...exam,hidden:true,hasActiveCodes:false},[],{questions:[]});
    assert.match(locked,/data-action="enter-code"[^>]*disabled/);
    assert.match(locked,/Không có mã thi/);
    assert.doesNotMatch(html,/<div class="chan">[\s\S]*<b>Mới<\/b>/);
  });
  await test('Student exam card puts the latest result on the left and bolds only its score',()=>{
    const exam={id:'exam-1',provider:'GOETHE',level:'A1',title:'Modelltest',sections:[]};
    const failed=studentExamCardHtml(exam,[{examId:'exam-1',status:'published',totalScore:14,result:'Chưa đạt',publishedAt:'2026-10-09'}],{questions:[]});
    assert.doesNotMatch(failed,/Đã thi 1 lần/);
    assert.match(failed,/Lần thi gần nhất <strong>14<\/strong> điểm - <span class="exam-latest-result failed">Chưa đạt<\/span>/);
    const passed=studentExamCardHtml(exam,[{examId:'exam-1',status:'published',totalScore:20,result:'Đạt',publishedAt:'2026-10-10'}],{questions:[]});
    assert.match(passed,/class="exam-latest-result passed">Đạt<\/span>/);
  });
  await test('Header keeps role-appropriate menus in builder and grading views',()=>{
    for(const role of ['master','teacher'])for(const view of ['admin','builder','grading-detail']){
      const html=topbarHtml({user:{id:role,role},mode:'api',online:true,ui:{view}});
      assert.equal(actionButtons(html,'admin-tab').length,role==='master'?8:4);
      assert.ok(html.indexOf('data-tab="courses"')<html.indexOf('data-tab="exams"'),'Courses precede exams for staff');
      if(role==='master')assert.match(html,/data-tab="speaking"/);
      else assert.doesNotMatch(html,/data-tab="speaking"/);
      if(role==='master')assert.doesNotMatch(html,/data-tab="classes"/);
      else assert.match(html,/data-tab="classes"/);
      assert.match(html,/data-tab="exams"/);
    }
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.match(source,/\[data-action="admin-tab"\][^\n]+await flushBuilderDraft\(\)[^\n]+ui.adminTab/);
  });
  await test('Student exam menu filters by level then Goethe or Telc',()=>{
    const html=topbarHtml({user:{id:'student',role:'student',name:'Student'},mode:'api',online:true,ui:{view:'student-home'},studentExamMenu:[
      {id:'g-a1',status:'published',level:'A1',provider:'GOETHE'},
      {id:'t-a1',status:'published',level:'A1',provider:'TELC'},
      {id:'fid-b1',status:'published',level:'B1',provider:'FID'}
    ]});
    assert.ok(html.indexOf('data-action="open-courses"')<html.indexOf('data-action="student-home"'),'Courses precede exams for students');
    assert.match(html,/student-exam-nav-menu/);
    assert.match(html,/data-exam-level="A1" data-exam-provider="GOETHE"/);
    assert.match(html,/data-exam-level="A1" data-exam-provider="TELC"/);
    assert.match(html,/>Goethe<\/button>/);
    assert.match(html,/>Telc<\/button>/);
    assert.doesNotMatch(html,/fid-b1|Loại đề B1/);
  });
  await test('My courses appears only in the student avatar menu',()=>{
    for(const role of ['student','teacher','master']){
      const html=topbarHtml({user:{id:role,role},mode:'api',online:true,ui:{view:'courses',courseRoute:{page:'mine'}}});
      const nav=html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0]||'';
      const menu=html.match(/<div id="accountRoleMenu"[\s\S]*?<\/div>/)?.[0]||'';
      assert.doesNotMatch(nav,/Khóa học của tôi|data-course-page="mine"/);
      if(role==='student'){
        assert.match(menu,/data-action="open-courses" data-course-page="mine" aria-current="true"/);
        assert.match(menu,/<span>Khóa học của tôi<\/span>/);
        assert.equal((html.match(/data-course-page="mine"/g)||[]).length,1);
      }else assert.doesNotMatch(menu,/data-course-page="mine"/);
    }
  });
  await test('Admin utility tabs show accessible icons without visible labels',()=>{
    for(const adminTab of ['dashboard','exams','teachers']){
      const html=topbarHtml({user:{id:'master',role:'master',name:'Admin'},mode:'api',online:true,ui:{view:'admin',adminTab}});
      const button=html.match(/<button[^>]*data-tab="teachers"[^>]*>[\s\S]*?<\/button>/)?.[0]||'';
      assert.match(button,/aria-label="Người dùng"/);
      assert.match(button,/<svg/);
      assert.doesNotMatch(button,/<span>Người dùng<\/span>/);
      assert.doesNotMatch(button,/Giáo viên/);
      for(const utility of ['teachers','trash'])assert.match(html.match(new RegExp(`<button[^>]*data-tab="${utility}"[^>]*>`))?.[0]||'',/muc-ben--icon/);
    }
    assert.doesNotMatch(readFileSync(new URL('../src/users/bootstrap.js',import.meta.url),'utf8'),/tabLabel/);
  });
  await test('Header account omits role badge while preserving role switching',()=>{
    const filters=readFileSync(new URL('../src/users/bootstrap.js',import.meta.url),'utf8');
    assert.match(filters,/\['external','Khách'\]/);
    assert.doesNotMatch(filters,/\['all','Tất cả'\]/);
    const handler=filters.match(/button.onclick=\(\)=>\{([^\n]+?)\}\);/)[1];
    const sandbox={selectedGroup:'all',button:{dataset:{userGroupFilter:'teacher'}},filter:()=>{}};
    vm.runInNewContext(handler,sandbox);assert.equal(sandbox.selectedGroup,'teacher');
    vm.runInNewContext(handler,sandbox);assert.equal(sandbox.selectedGroup,'all');
    sandbox.button.dataset.userGroupFilter='external';
    vm.runInNewContext(handler,sandbox);assert.equal(sandbox.selectedGroup,'external');
    const html=topbarHtml({user:{id:'master',role:'master',name:'Admin'},mode:'api',online:true,ui:{view:'admin'},canSwitchRole:true});
    assert.match(html,/<div class="logo">G2G<\/div>/,'An unconfigured logo must not request a missing image');
    const settings=currentPublicSettings(),savedGeneral=settings.general;
    try{
      settings.general={...savedGeneral,logoUrl:'/uploads/configured-logo.png'};
      assert.match(topbarHtml({user:{role:'master'},mode:'api',online:true}),/<div class="logo"><img src="\/brand\/logo\?v=/);
    }finally{settings.general=savedGeneral;}
    assert.match(html,/<header class="thanh-dau" data-current-role="master">/);
    assert.doesNotMatch(html,/<span class="nhan"/);
    assert.match(html,/<button class="account-avatar"[^>]*aria-controls="accountRoleMenu"/);
    assert.doesNotMatch(html,/⌄/);
    assert.equal(actionButtons(html,'toggle-role-menu').length,1);
    assert.equal(actionButtons(html,'test-role').length,2);
    assert.match(html,/data-role="student"><svg[^]*?<span>Học viên<\/span><\/button>/);
    assert.match(html,/data-role="teacher"><svg[^]*?<span>Giáo viên<\/span><\/button>/);
    assert.doesNotMatch(html,/data-action="test-role" data-role="master"|header-logout|account-role-trigger/);
    assert.match(html,/class="account-role-indicator" data-role="master"/);
    const badgeCss=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(badgeCss,/\.account-role-indicator \{ position:absolute; top:-3px; left:-3px;[^}]*width:18px; height:18px;/);
    assert.match(badgeCss,/\.account-role-indicator svg \{ width:14px; height:14px;/);
    assert.match(html,/data-action="account-profile"><svg[^]*?<span>Hồ sơ<\/span>/);
    assert.match(html,/data-action="logout"><svg[^]*?<span>Đăng xuất<\/span>/);
    const regular=topbarHtml({user:{role:'teacher',name:'Teacher'},mode:'api',online:true});
    assert.equal(actionButtons(regular,'test-role').length,0);
    assert.doesNotMatch(regular,/account-role-indicator/);
    assert.equal(actionButtons(regular,'account-profile').length,1);
    const withPicture=topbarHtml({user:{id:'master',role:'master',name:'Admin',picture:'https://lh3.googleusercontent.com/avatar.jpg'},mode:'api',online:true,canSwitchRole:true});
    assert.match(withPicture,/<img src="https:\/\/lh3\.googleusercontent\.com\/avatar\.jpg" alt="" referrerpolicy="no-referrer">/);
    for(const role of ['student','teacher']){
      const roleHtml=topbarHtml({user:{id:'master',role,name:'Admin',canTestRoles:true},mode:'api',online:true,canSwitchRole:true});
      assert.doesNotMatch(roleHtml,new RegExp(`data-action="test-role" data-role="${role}"`));
      assert.match(roleHtml,new RegExp(`class="account-role-indicator" data-role="${role}"`));
      assert.match(roleHtml,/data-role="master"><svg[^]*?<span>Át min<\/span>/);
      assert.match(roleHtml,new RegExp(`data-current-role="${role}"`));
    }
  });
  await test('Active student uses the Google avatar',()=>{
    const html=dashboardHtml({data:{users:[{id:'student',role:'student',name:'Dương Phan',picture:'https://lh3.googleusercontent.com/teacher.jpg',createdAt:new Date().toISOString()}],exams:[],attempts:[{status:'published',studentId:'student',submittedAt:new Date().toISOString()}]}});
    assert.match(html,/class="dashboard-person"/);
    assert.match(html,/<img src="https:\/\/lh3\.googleusercontent\.com\/teacher\.jpg" alt="" referrerpolicy="no-referrer">/);
    assert.match(html,/Dương Phan/);
  });
  await test('Marking an example moves it first with FLIP animation and persists the new order',()=>{
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.match(source,/const questionIds=\[\.\.\.app\.querySelectorAll\('\.part-question\[data-question-id\]'\)\]/);
    assert.match(source,/if\(makeExample\)[\s\S]*?container\.insertBefore\(card,cards\[0\]\|\|null\)[\s\S]*?item\.animate/);
    const builder=renderBuilder({data:{questions:[{id:'q',type:'single',title:'Mẫu',choices:['A','B'],maxScore:1}]},exam:{settings:{}},section:{questionIds:['q'],questionProfile:{}}});
    assert.match(builder,/<span>đ<\/span>/);
    assert.doesNotMatch(builder,/<span>điểm<\/span>/);
  });
  await test('Preview has its own header actions and no real attempt timer or submission controls',()=>{
    for(const sectionIndex of [0,1,2]){
      const html=examHtml({...fixture(),sectionIndex});
      assert.ok(header(html),'The preview must retain a page header.');
      assert.ok(header(html).includes('Preview fixture'));
      assert.equal(actionButtons(header(html),'close-preview').length,1);
      assert.equal(actionButtons(header(html),'reset-preview').length,0);
      assert.ok(tags(html,'div').some(tag=>hasClass(tag,'thi--preview')));
      assert.equal(actionButtons(html,'reset-preview').length,0);
      assert.ok(actionButtons(html,'close-preview').length>=1);
      for(const action of ['prev-section','next-section','submit-exam'])assert.equal(actionButtons(html,action).length,0);
      assert.doesNotMatch(html,/\bid="(?:examTimer|examTimeSummary)"/);
      assert.doesNotMatch(html,/\bid="saveState"/);
      assert.doesNotMatch(html,/\bdata-current-answer-count(?:\s|>)/);
      assert.doesNotMatch(html,/Thử trả lời như học viên|Không lưu kết quả|Phần \d+ \/ \d+|>ĐỀ BÀI</);
    }
  });

  await test('Only preview exposes a native section dropdown above the paper',()=>{
    const input=fixture(),html=examHtml({...input,sectionIndex:1});
    const previewHeader=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
    assert.ok(previewHeader.indexOf('data-action="close-preview"')<previewHeader.indexOf('class="preview-exam-title"'));
    assert.ok(previewHeader.indexOf('class="preview-exam-title"')<previewHeader.indexOf('class="preview-outline"'));
    assert.match(previewHeader,/<header[^>]*><div class="preview-header-row">/,'All header controls share one row');
    const outline=tags(html,'div').filter(tag=>hasClass(tag,'preview-outline'));
    assert.equal(outline.length,1);
    const outlineStart=html.indexOf(outline[0]),mainStart=html.indexOf('<main');
    assert.ok(outlineStart<mainStart,'The section switcher comes before the exam paper.');
    const outlineHtml=html.slice(outlineStart,mainStart);
    assert.doesNotMatch(outlineHtml,/data-preview-total|data-preview-progress|reset-preview/);
    const picker=tags(outlineHtml,'select').filter(tag=>attribute(tag,'data-action')==='preview-select-section');
    assert.equal(picker.length,1);
    assert.match(outlineHtml,/for="previewSectionSelect"/);
    assert.doesNotMatch(outlineHtml,/>Chuyển phần</);
    const sections=tags(outlineHtml,'option');
    assert.deepEqual(sections.map(tag=>attribute(tag,'value')),['0','1','2']);
    assert.deepEqual(sections.map(tag=>/\bselected(?:\s|>)/.test(tag)),[false,true,false]);
    assert.equal(actionButtons(html,'preview-select-section').length,0);
    assert.doesNotMatch(html,/data-preview-total|data-preview-current|data-preview-progress|data-preview-section-progress/);
    const real=examHtml({...input,preview:false});
    assert.equal(tags(real,'div').filter(tag=>hasClass(tag,'preview-outline')).length,0);
    assert.doesNotMatch(real,/\bdata-preview-/);
    assert.doesNotMatch(real,/data-action="(?:preview-[^"]*|reset-preview|close-preview)"/);
    assert.doesNotMatch(header(real),/\bid="examTimer"/);
    assert.doesNotMatch(real,/data-exam-completion|Für die Abgabe sind mindestens/);
    assert.equal((real.match(/id="examMainTime"/g)||[]).length,1);
    assert.match(real,/\bid="examTimeSummary"/);
    assert.match(real,/\bid="saveState"/);
  });

  await test('Builder places its return link beside provider/level and keeps successful autosave quiet',()=>{
    const input=fixture();
    Object.assign(input.exam,{provider:'GOETHE',publicationLabel:'1.0.1'});
    const html=examBuilderHtml({data:{questions:input.questions},user:{id:'teacher'},exam:input.exam,section:null,readOnly:false});
    const back=actionButtons(html,'back-admin');
    assert.equal(back.length,1);
    assert.ok(hasClass(back[0],'text-link'));
    const meta=html.match(/<div class="builder-meta">([\s\S]*?)<\/div>/)?.[1]||'';
    assert.ok(meta.includes(back[0]));
    assert.ok(meta.indexOf(back[0])<meta.indexOf('class="builder-badges"'));
    assert.match(meta,/<span class="nhan exam-provider" data-provider="GOETHE">Goethe<\/span><span class="nhan exam-level" data-level="A1">A1<\/span>/);
    assert.match(meta,/data-exam-version=/);
    assert.match(meta,/>v1\.0\.1<\/small>/);
    assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.builder-version\s*\{\s*margin-left:0;/);
    assert.equal((html.match(/class="exam-publication-version"/g)||[]).length,1);
    assert.match(html,/data-builder-save-status[^>]+hidden><\/span>/);
    assert.doesNotMatch(html,/Đã tự động lưu|Tự động lưu/);
    assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.builder-back:hover\s*\{\s*text-decoration:none;/);
    assert.equal(actionButtons(html,'save-exam').length,0);
    assert.doesNotMatch(html,/Lưu nháp/);
    assert.match(html,/data-builder-save-status[^>]+role="status"/);
    assert.equal(actionButtons(html,'preview-exam').length,1);
    assert.equal(actionButtons(html,'publish-exam').length,1);
    const previewHeader=header(examHtml(input));
    const previewBack=actionButtons(previewHeader,'close-preview')[0];
    assert.ok(hasClass(previewBack,'text-link'));
    assert.ok(previewHeader.indexOf(previewBack)<previewHeader.indexOf(input.exam.title));
  });

  await test('Navigation follows all questions and respects first, middle and last section boundaries',()=>{
    for(const preview of [true,false])for(const sectionIndex of [0,1,2]){
      const html=examHtml({...fixture(),preview,sectionIndex});
      const questionList=html.indexOf(tags(html,'section').find(tag=>hasClass(tag,'to-thi')));
      const lastQuestion=html.indexOf('data-q="written"');
      const navigation=html.indexOf(tags(html,'nav').find(tag=>hasClass(tag,'dieu-huong-thi')));
      assert.ok(questionList>=0&&lastQuestion>questionList&&navigation>lastQuestion);
      assert.ok(navigation>html.lastIndexOf('</textarea>'),'Navigation must follow the final answer field.');
      assert.deepEqual(tags(html,'div').filter(tag=>hasClass(tag,'cau-thi')).map(tag=>attribute(tag,'data-q')),['choice','match','written']);
      const firstNumber=sectionIndex===0?1:4;
      assert.deepEqual([...html.matchAll(/class="question-number">(\d+)\.<\/strong>/g)].map(match=>match[1]),[firstNumber,firstNumber+1,firstNumber+2].map(String));
      assert.match(html,new RegExp(`class="question-number">${firstNumber}\\.<\\/strong> Choose an answer\\.`));
      const previous=actionButtons(html,preview?'preview-prev-section':'prev-section');
      assert.equal(previous.length,1);
      assert.equal(/\bdisabled(?:\s|>)/.test(previous[0]),sectionIndex===0);
      const nextAction=sectionIndex===2?(preview?'close-preview':'submit-exam'):(preview?'preview-next-section':'next-section');
      assert.ok(actionButtons(html.slice(navigation),nextAction).length===1);
      if(sectionIndex===2&&preview){
        assert.match(html.slice(navigation),/data-action="close-preview">Kết thúc<\/button>/);
        assert.doesNotMatch(actionButtons(html.slice(navigation),'close-preview')[0],/section-arrow/);
      }
      if(sectionIndex===2)assert.equal(actionButtons(html,preview?'preview-next-section':'next-section').length,0);
    }
  });

  await test('Question numbering continues across the whole exam',()=>{
    const input=fixture(),question={id:'later',type:'single',prompt:'Later question.',choices:['Yes','No']};
    input.exam.sections[1].questionIds=[question.id];
    const html=examHtml({...input,sectionIndex:1,questions:[question]});
    assert.match(html,/class="question-number">4\.<\/strong> Later question\./);
  });

  await test('Writing style is owned by the editor, never toggled by students',()=>{
    const input=fixture();
    for(const preview of [false,true]){
      const plain=examHtml({...input,preview,questions:[{id:'style-writing',type:'writing',handwriting:false}]});
      assert.doesNotMatch(plain,/lined-writing-paper|data-handwriting-toggle/);
      const handwriting=examHtml({...input,preview,questions:[{id:'style-writing',type:'writing'}]});
      assert.match(handwriting,/lined-writing-paper/);
      assert.doesNotMatch(handwriting,/data-handwriting-toggle/);
    }
  });

  await test('Rerendered preview retains radio, matching and writing input hooks and selected answers',()=>{
    const input=fixture();
    input.questions[0].choices=['First','Second','Nháp',{text:'',imageUrl:''}];
    const html=examHtml(input);
    const radios=tags(html,'input').filter(tag=>hasClass(tag,'answer-one'));
    assert.equal(radios.length,2);
    assert.deepEqual(radios.map(tag=>attribute(tag,'data-q')),['choice','choice']);
    assert.deepEqual(radios.map(tag=>attribute(tag,'name')),['answer-choice','answer-choice']);
    assert.deepEqual(radios.map(tag=>/\bchecked(?:\s|>)/.test(tag)),[true,false]);
    assert.match(html,/class="answer-letter">A\.<\/strong> First/);
    assert.match(html,/class="answer-letter">B\.<\/strong> Second/);
    assert.doesNotMatch(html,/class="answer-letter">[CD]\.<\/strong>/);
    assert.doesNotMatch(html,/>Nháp</);
    const matches=tags(html,'select').filter(tag=>hasClass(tag,'answer-match'));
    assert.deepEqual(matches.map(tag=>[attribute(tag,'data-q'),attribute(tag,'data-i')]),[['match','0'],['match','1']]);
    const selected=tags(html,'option').filter(tag=>!tag.includes('data-preview-section-progress')&&/\bselected(?:\s|>)/.test(tag));
    assert.deepEqual(selected.map(tag=>attribute(tag,'value')),['0','B']);
    const written=tags(html,'textarea').find(tag=>hasClass(tag,'answer-text'));
    assert.equal(attribute(written,'data-q'),'written');
    assert.match(html,/<textarea\b[^>]*>Two words<\/textarea>/);
    assert.match(html,/class="word-count">2<\/span>/);
    const answered=tags(html,'div').filter(tag=>hasClass(tag,'cau-thi')&&hasClass(tag,'is-answered'));
    assert.deepEqual(answered.map(tag=>attribute(tag,'data-q')),['choice','written']);
  });

  await test('Compact binary answers share question row without letter prefixes and retain radio behavior',()=>{
    assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.cau-thi--binary>\.answer-options \{[^}]*margin:0 0 0 auto;/,'Binary answer pairs align to the right, including when wrapped below the prompt');
    for(const choices of [['+','-'],['+','−'],['Ja','Nein'],['Falsch','Richtig']]){
      assert.ok(compactBinaryChoices(choices));
      for(const example of [false,true]){
        const html=renderQuestionHtml({id:'binary',type:'single',title:'Aussage',choices,example,correctAnswer:1,maxScore:example?0:1},1,{id:'preview'},{preview:true});
        assert.match(html,/cau-thi--binary/);
        assert.doesNotMatch(html,/answer-letter|aria-label="[AB]\./);
        assert.match(html,/role="radiogroup"/);
        assert.equal(tags(html,'input').length,2);
        assert.ok(tags(html,'input')[1].includes('checked'));
        assert.equal(tags(html,'input')[0].includes('disabled'),example);
      }
    }
    assert.equal(compactBinaryChoices(['A','B']),false);
    assert.equal(compactBinaryChoices(['Ja','Nein','Vielleicht']),false);
    assert.equal(compactBinaryChoices([{text:'Ja',imageUrl:'image.jpg'},'Nein']),false);
  });

  await test('Question and instruction text remain escaped in both preview and real exam layouts',()=>{
    const input=fixture();
    input.exam.title='Exam <script>bad()</script>';
    input.exam.sections[0].name='Part <em>name</em>';
    input.exam.sections[0].instruction='Instruction <img src=x onerror=bad()> & "quoted"';
    input.questions[0].instruction='Question instruction <b>text</b>';
    input.questions[0].prompt='Prompt <svg onload=bad()>';
    input.questions[0].choices[0]='Choice <a href="bad">text</a>';
    input.attempt.answers.written='</textarea><script>answer()</script>';
    input.previewSummary.sections[0].name='Outline <strong>name</strong>';
    for(const preview of [true,false]){
      const html=examHtml({...input,preview});
      for(const escaped of [
        'Exam &lt;script&gt;bad()&lt;/script&gt;',
        'Part &lt;em&gt;name&lt;/em&gt;',
        'Instruction &lt;img src=x onerror=bad()&gt; &amp; &quot;quoted&quot;',
        'Question instruction &lt;b&gt;text&lt;/b&gt;',
        'Prompt &lt;svg onload=bad()&gt;',
        'Choice &lt;a href=&quot;bad&quot;&gt;text&lt;/a&gt;',
        '&lt;/textarea&gt;&lt;script&gt;answer()&lt;/script&gt;'
      ])assert.ok(html.includes(escaped),`Missing escaped text: ${escaped}`);
      const content=html.replaceAll(iconHtml('arrowLeft'),'').replaceAll(iconHtml('arrowRight'),'').replaceAll(iconHtml('grading'),'');
      assert.doesNotMatch(content,/<(?:script|svg)\b|<img src=x|<a href="bad"/);
      if(preview)assert.ok(html.includes('Outline &lt;strong&gt;name&lt;/strong&gt;'));
    }
  });

  await test('Instruction images render below text at the approved width',()=>{
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.exam-instruction\s*\{[^}]*flex-direction:column/);
    assert.match(css,/\.question-stimulus\s*\{[^}]*flex-direction:column/);
    assert.match(css,/\.exam-instruction img\s*\{[^}]*width:100%; max-width:100%; height:auto; max-height:none/);
    assert.match(css,/\.question-stimulus img\s*\{[^}]*width:100%; max-width:100%; height:auto; max-height:none/);
    assert.match(css,/\.exam-instruction img\s*\{[^}]*align-self:flex-start/);
    assert.match(css,/\.question-stimulus img\s*\{[^}]*align-self:flex-start/);
  });

  await test('Illustrated choices stack a full-width image above the label on mobile',()=>{
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.exam-paper \.answer-options--illustrated \.answer-option-body>img\s*\{[^}]*grid-row:1;[^}]*width:100%;[^}]*height:auto/);
    assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.exam-paper \.answer-options--illustrated \.answer-option-body>span\s*\{[^}]*grid-row:2/);
  });

  await test('A question image replaces the img marker at its exact prompt position',()=>{
    const input=fixture();
    input.questions[0].prompt='Before image\n[img]\nAfter image';
    input.questions[0].instructionImageUrl='/images/question.png';
    const html=examHtml({...input,preview:true});
    assert.doesNotMatch(html,/\[img\]/i);
    assert.match(html,/class="question-inline-image"/);
    assert.match(html,/src="\/images\/question\.png"/);
    assert.ok(html.indexOf('Before image')<html.indexOf('question-inline-image'));
    assert.ok(html.indexOf('question-inline-image')<html.indexOf('After image'));
  });

  await test('A stimulus question renders its image once when its title contains an img marker',()=>{
    const input=fixture();
    input.exam.sections[0].questionProfile={stimulusStarts:[0]};
    input.questions[0].title='Auf der Straße:\n[img]\nSie dürfen hier nicht parken.';
    input.questions[0].instructionBlocks=[{text:'',imageUrl:'/images/sign.png'}];
    const html=examHtml({...input,preview:true});
    assert.equal((html.match(/src="\/images\/sign\.png"/g)||[]).length,1);
    assert.doesNotMatch(html,/\[img\]/i);
  });

  await test('Question-owned prompts place their own image between text and footnote',()=>{
    for(const preview of [true,false])for(const splitLayout of [true,false]){
      const input=fixture();
      input.exam.sections[0].questionProfile={splitLayout};
      input.questions[0].instructionBlocks=[
        {text:'[b]Lesen Sie den Text[/b]\n[IMG]\n[i]Investionen - (Geld)Ausgaben[/i]\n[img]',imageUrl:'/images/kino.png',imageMaxWidth:420},
        {text:'Second source [img] Second footnote <script>',imageUrl:'/images/second.png'}
      ];
      const before=JSON.stringify(input.questions);
      const html=examHtml({...input,preview});
      assert.doesNotMatch(html,/\[img\]|<script>/i);
      assert.equal(html.split('src="/images/kino.png"').length-1,1);
      assert.equal(html.split('src="/images/second.png"').length-1,1);
      assert.ok(html.indexOf('Lesen Sie den Text')<html.indexOf('/images/kino.png'));
      assert.ok(html.indexOf('/images/kino.png')<html.indexOf('Investionen'));
      assert.ok(html.indexOf('Second source')<html.indexOf('/images/second.png'));
      assert.ok(html.indexOf('/images/second.png')<html.indexOf('Second footnote'));
      assert.match(html,/max-width:420px/);
      assert.match(html,/&lt;script&gt;/);
      assert.equal(JSON.stringify(input.questions),before);
      input.questions[0].instructionBlocks[0].imageUrl='';
      assert.doesNotMatch(examHtml({...input,preview}),/\[img\]|\/images\/kino.png/i);
    }
  });

  await test('Audio and illustrated answers retain their media and interaction hooks',()=>{
    const input=fixture();
    input.questions[0].audioUrl='/audio/choice.mp3?name="clip"';
    input.questions[0].choices=[{text:'Picture choice',imageUrl:'/images/answer.png?name="image"'},'Text choice'];
    for(const preview of [true,false]){
      const html=examHtml({...input,preview});
      const audio=tags(html,'audio');
      assert.equal(audio.length,1);
      assert.equal(attribute(audio[0],'id'),'audio-choice');
      assert.equal(attribute(audio[0],'src'),'/audio/choice.mp3?name=&quot;clip&quot;');
      const play=tags(html,'button').filter(tag=>hasClass(tag,'play-audio'));
      assert.equal(play.length,1);
      assert.equal(attribute(play[0],'data-q'),'choice');
      assert.ok(tags(html,'img').some(tag=>attribute(tag,'src')==='/images/answer.png?name=&quot;image&quot;'));
      assert.equal(tags(html,'input').filter(tag=>hasClass(tag,'answer-one')).length,2);
    }
  });

  await test('Listening parts expose one section player and hide every question player',()=>{
    const input=fixture();
    input.exam.sections[0].skillKey='listening';
    input.exam.sections[0].audioPolicy={mode:'per_question_segment',segmentRepeat:2,maxSessions:1};
    input.exam.sections[0].instructionAudioUrl='/audio/instruction.mp3';
    input.questions[0].audioUrl='/audio/one.mp3';
    input.questions[0].example=true;
    input.questions[1].audioUrl='/audio/two.mp3';
    for(const preview of [true,false]){
      const html=examHtml({...input,preview});
      const segments=tags(html,'audio').filter(tag=>hasClass(tag,'section-audio-segment'));
      assert.equal(segments.length,3);
      assert.ok(html.includes('/audio/instruction.mp3'));
      assert.equal(attribute(segments[0],'data-label'),'Aufgabenstellung');
      assert.equal(attribute(segments[0],'data-repeat'),'1');
      assert.equal(attribute(segments[1],'data-label'),'Beispiel');
      assert.equal(attribute(segments[1],'data-repeat'),'1');
      assert.equal(attribute(segments[2],'data-label'),'Aufgabe 1');
      assert.equal(attribute(segments[2],'data-repeat'),'2');
      assert.equal(tags(html,'button').filter(tag=>hasClass(tag,'section-audio-play')).length,1);
      assert.equal(tags(html,'button').filter(tag=>hasClass(tag,'play-audio')).length,0);
      assert.match(html,/section-audio-progress/);
      assert.match(html,/section-audio-progress[^>]*hidden/);
      assert.match(html,/Audio kann nur einmal abgespielt werden/);
    }
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.match(source,/Promise\.all\(audios\.map\(readAudioDuration\)\)/);
    assert.match(source,/audios\.map\(audio=>Math\.max\(1,Number\(audio\.dataset\.repeat\)\|\|1\)\)/);
    assert.match(source,/completedDuration\+currentTime/);
    assert.match(source,/requestAnimationFrame\(tick\)/);
    assert.match(source,/\['exam','preview-exam','builder','grading-detail','courses'\]\.includes\(ui\.view\)/);
    assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.section-audio-status\s*\{[^}]*color:var\(--chu\)/);
    assert.match(source,/function stopActiveAudio\(\)[\s\S]*audio\.onpause=null;audio\.onended=null;audio\.onerror=null;[\s\S]*audio\.pause\(\)/);
    assert.match(source,/function render\(\)[\s\S]*stopActiveAudio\(\)/);
    assert.match(source,/url\.searchParams\.set\('preview',ui\.previewExamId\)/);
    assert.match(source,/url\.searchParams\.set\('tab',ui\.adminTab\)/);
    assert.match(source,/initialUrl\.searchParams\.get\('preview'\)/);
  });

  await test('Reading part one inserts its second stimulus before question three',()=>{
    const input=fixture();
    input.exam.sections[0].questionProfile={stimulusStarts:[2]};
    input.questions=[
      {id:'first',type:'single',title:'Question one',choices:['Đúng','Sai']},
      {id:'second',type:'single',title:'Question two',choices:['Đúng','Sai']},
      {id:'third',type:'single',title:'Question three',choices:['Đúng','Sai'],instructionBlocks:[{text:'Second stimulus',imageUrl:'/images/read-2.png'}]},
      {id:'fourth',type:'single',title:'Question four',choices:['Đúng','Sai']},
      {id:'fifth',type:'single',title:'Question five',choices:['Đúng','Sai']},
    ];
    input.exam.sections[0].questionIds=input.questions.map(question=>question.id);
    const html=examHtml({...input,questions:input.questions});
    assert.equal((html.match(/class="question-stimulus"/g)||[]).length,1);
    assert.ok(html.indexOf('Second stimulus')<html.indexOf('Question three'));
    assert.match(html,/src="\/images\/read-2\.png"/);
  });

  await test('Reading one hides instruction audio and keeps secondary prompts movable',()=>{
    const questions=[
      {id:'q1',type:'single',title:'Question one',choices:['Richtig','Falsch'],instructionBlocks:[]},
      {id:'q2',type:'single',title:'Question two',choices:['Richtig','Falsch'],instructionBlocks:[{text:'Flexible prompt',imageUrl:''}]}
    ];
    const section={id:'reading-1',skillKey:'reading',questionIds:['q1','q2'],questionProfile:{layout:'true-false',choices:['Richtig','Falsch'],instructionImage:true,audio:true,stimulusStarts:[2]}};
    const builder=renderBuilder({data:{questions},exam:{settings:{},sections:[section]},section});
    assert.doesNotMatch(builder,/data-section-audio/);
    assert.match(builder,/data-action="add-question-instruction"/);
    assert.match(builder,/data-action="move-question-instruction"/);
    const input=fixture();input.questions=questions;input.allQuestions=questions;input.exam.sections[0]={...section,name:'Đọc 1'};input.attempt.answers={};
    const html=examHtml(input);
    assert.ok(html.indexOf('Flexible prompt')<html.indexOf('Question two'));
  });

  await test('Writing form groups equal labels and numbers fractional score bundles once',()=>{
    const input=fixture(),question={id:'writing-form',type:'writing',title:'Form',rubric:[
      {type:'text',label:'Name',maxScore:.33},{type:'text',label:'Name',maxScore:.33},{type:'text',label:'Name',maxScore:.33},
      {type:'truefalse',label:'Deutsch gelernt?',maxScore:1},{type:'choice',label:'Kurszeit',answers:'9–12 Uhr|13–16 Uhr',maxScore:1},
      {type:'image',label:'Formular',imageUrl:'/images/form.png',maxScore:0},
    ]};
    input.exam.sections[0].questionIds=[question.id];input.questions=[question];input.attempt.answers={[question.id]:{'0':'Eva','3':'Đúng'}};
    const html=examHtml(input);
    assert.equal((html.match(/class="writing-display-group(?: is-full)?"/g)||[]).length,4);
    assert.equal((html.match(/class="writing-point">\(0\)/g)||[]).length,1);
    assert.equal((html.match(/class="writing-point">\(1\)/g)||[]).length,1);
    assert.match(html,/class="writing-binary"/);assert.match(html,/Antwort auswählen/);assert.match(html,/src="\/images\/form\.png"/);
  });

  await test('Writing 1 composes a framed reusable form and scores only answer fields',()=>{
    const input=fixture(),question={id:'writing-one-form',type:'writing',title:'Form',rubric:[
      {type:'heading',label:'',answers:'Patienteninformation',maxScore:8},
      {type:'static',label:'Name, Vorname:',answers:'Serjakov, Vladimir',maxScore:5},
      {type:'text',label:'Beruf:',answers:'Reiseleiter',maxScore:.5},
      {type:'text',label:'Seit wann sind Sie krank?',answers:'seit gestern',maxScore:.5},
      {type:'choice',label:'Was fehlt Ihnen?',answers:'Fieber|Husten',maxScore:1},
      {type:'image',label:'Logo',imageUrl:'/images/form-logo.png',maxScore:4},
    ]};
    input.exam.sections[0].questionIds=[question.id];input.exam.sections[0].questionProfile={formFrame:true};input.questions=[question];input.attempt.answers={[question.id]:{}};
    const html=examHtml(input);
    assert.match(html,/writing-paper/);
    assert.match(html,/<h3>Patienteninformation/);
    assert.doesNotMatch(html,/Serjakov, Vladimir/);
    assert.match(html,/src="\/images\/form-logo\.png"/);
    assert.equal(writingFormScore(question.rubric),7);
    assert.equal((html.match(/class="form-point">/g)||[]).length,3);
  });

  await test('Writing 1 choice controls hide only the embedded A/B block, never the whole form question',()=>{
    const question={id:'write-one',type:'writing',title:'Choose A or B',choices:['A','B'],correctAnswer:0,maxScore:1,rubric:[{type:'text',label:'Name',maxScore:1}]};
    const section={id:'writing-1',skill:'Viết',questionIds:[question.id],questionProfile:{layout:'mixed-form',formFrame:false,choices:['A','B'],formFieldCount:1}};
    let html=renderBuilder({data:{questions:[question]},exam:{settings:{},sections:[section]},section});
    assert.match(html,/value="heading"/);
    assert.doesNotMatch(html,/value="static"/);
    assert.equal(actionButtons(html,'remove-inline-question').length,0);
    assert.equal(actionButtons(html,'hide-mixed-choice').length,1);
    assert.equal(actionButtons(html,'restore-mixed-choice').length,1);
    assert.match(html,/data-mixed-choice-hidden="false"/);
    question.mixedChoiceHidden=true;
    html=renderBuilder({data:{questions:[question]},exam:{settings:{},sections:[section]},section});
    assert.match(html,/mixed-writing-question is-hidden/);
    assert.match(html,/data-mixed-choice-hidden="true"/);
    assert.match(html,/class="writing-form-row/);
  });

  await test('A shared section instruction appears once and an empty question list still has navigation',()=>{
    const input=fixture();
    input.questions[0].prompt=input.exam.sections[0].instruction;
    let html=examHtml(input);
    assert.equal(html.split(input.exam.sections[0].instruction).length-1,1);
    html=examHtml({...input,questions:[],attempt:{id:'preview-empty',answers:{}},previewSummary:{answered:0,total:0,sections:[]}});
    assert.doesNotMatch(html,/0\/0 câu|data-preview-current/);
    assert.doesNotMatch(html,/NaN|Infinity/);
    assert.equal(actionButtons(html,'preview-next-section').length,1);
  });

  await test('Part runtimes skip preview before fetching or binding a real attempt',async()=>{
    const globals=['document','MutationObserver','requestAnimationFrame','fetch'];
    const previous=new Map(globals.map(name=>[name,globalThis[name]]));
    const requests=[];
    let preview=true,inspections=0,frameCallback,mutationCallback;
    const examRoot={
      classList:{contains:name=>preview&&name==='thi--preview'},
      dataset:{},
      querySelectorAll:()=>{inspections++;return [{dataset:{q:'choice'}}];}
    };
    globalThis.document={querySelector:()=>examRoot,getElementById:()=>({})};
    globalThis.MutationObserver=class{
      constructor(callback){mutationCallback=callback;}
      observe(){}
    };
    globalThis.requestAnimationFrame=callback=>{frameCallback=callback;return 1;};
    globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({questions:[]})};};
    try{
      await mountStudentRuntime({examRoot});
      await mountStudentRuntime({examRoot,state:{attempts:[{id:'real-attempt',status:'in_progress',currentQuestionIds:['choice']}]}});
      assert.equal(inspections,0,'The A1 runtime must not inspect preview questions for a matching real attempt.');
      assert.deepEqual(requests,[]);
      assert.deepEqual(examRoot.dataset,{});
      const {mountExamRuntime}=await import('../src/part-templates/runtime.js');
      await mountExamRuntime({examRoot,state:{questions:[]}});
      assert.equal(inspections,0,'The general runtime must leave preview questions alone.');
      assert.deepEqual(requests,[]);
      preview=false;
      examRoot.isConnected=true;
      await mountExamRuntime({examRoot,state:{questions:[]}});
      assert.equal(requests.length,0,'A real exam reuses the authorized view state.');
      assert.equal(inspections,1);
    }finally{
      for(const [name,value] of previous){
        if(value===undefined)delete globalThis[name];
        else globalThis[name]=value;
      }
    }
  });

  await test('Autosave waits for in-flight saves and flushes edits before navigation',async()=>{
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    const functions=source.slice(source.indexOf('async function saveBuilderDraft('),source.indexOf('async function persistBuilderDraft('));
    let active=0,maxActive=0,calls=0,changeDuringSave=false,fail=false,readOnly=false;
    const context=vm.createContext({
      builderSavePromise:null,builderAutosaveTimer:null,builderEditRevision:0,builderSavedRevision:0,gradePublishing:false,gradeAutosave:null,
      clearTimeout:()=>{},ui:{view:'builder'},document:{getElementById:()=>({disabled:readOnly})},
      app:{querySelector:()=>null},
      persistBuilderDraft:async()=>{
        const revision=context.builderEditRevision;
        calls++;active++;maxActive=Math.max(active,maxActive);
        await new Promise(resolve=>setImmediate(resolve));
        if(changeDuringSave){context.builderEditRevision++;changeDuringSave=false;}
        if(!fail)context.builderSavedRevision=revision;
        active--;return !fail;
      }
    });
    vm.runInContext(functions,context);
    const saves=await Promise.all([context.saveBuilderDraft(),context.saveBuilderDraft(),context.saveBuilderDraft()]);
    assert.deepEqual(saves,[true,true,true]);
    assert.equal(maxActive,1,'Concurrent save requests must never overlap.');
    let before=calls;
    assert.equal(await context.flushBuilderDraft(),true);
    assert.equal(calls,before,'Clean navigation must not write again.');
    context.builderEditRevision++;changeDuringSave=true;
    assert.equal(await context.flushBuilderDraft(),true);
    assert.equal(calls-before,2,'Edits entered during a save must also be persisted before leaving.');
    fail=true;context.builderEditRevision++;
    assert.equal(await context.flushBuilderDraft(),false,'Failed persistence must prevent navigation.');
    before=calls;readOnly=true;
    assert.equal(await context.flushBuilderDraft(),true);
    assert.equal(calls,before,'Read-only preview must not attempt to save a locked exam.');
    for(const action of ['back-admin','select-section','preview-exam','publish-exam']){
      const binding=source.slice(source.indexOf(`app.querySelectorAll('[data-action="${action}"]`));
      assert.match(binding.slice(0,binding.indexOf('\n  });')),/if\(!await flushBuilderDraft\(\)\)(?:return;|\{progress.remove\(\);return;\})/,`${action} must flush edits first.`);
    }
  });

  console.log(`\n${passed} kiểm thử preview đã đạt.`);
}finally{
  if(originalStorage===undefined)delete globalThis.sessionStorage;
  else globalThis.sessionStorage=originalStorage;
}
