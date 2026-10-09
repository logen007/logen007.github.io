import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {examHtml} from '../src/views/student.js';
import {examBuilderHtml} from '../src/views/builder.js';
import {topbarHtml} from '../src/ui/layout.js';
import {mountStudentRuntime} from '../src/part-templates/a1-listening-part-1/student.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {writingFormScore} from '../src/domain/writing-form.js';

const originalStorage=globalThis.sessionStorage;
globalThis.sessionStorage={getItem:()=>null};
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
  await test('Header keeps role-appropriate menus in builder and grading views',()=>{
    for(const role of ['master','teacher'])for(const view of ['admin','builder','grading-detail']){
      const html=topbarHtml({user:{id:role,role},mode:'api',online:true,ui:{view}});
      assert.equal(actionButtons(html,'admin-tab').length,role==='master'?5:3);
      assert.match(html,/data-tab="exams"/);
    }
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.match(source,/\[data-action="admin-tab"\][^\n]+await flushBuilderDraft\(\)[^\n]+clearBuilderEditUrl\(\)/);
  });
  await test('Users navigation label and icon stay consistent before and after selecting the tab',()=>{
    for(const adminTab of ['exams','teachers','grading']){
      const html=topbarHtml({user:{id:'master',role:'master',name:'Admin'},mode:'api',online:true,ui:{view:'admin',adminTab}});
      const button=html.match(/<button[^>]*data-tab="teachers"[^>]*>[\s\S]*?<\/button>/)?.[0]||'';
      assert.match(button,/<span>Người dùng<\/span>/);
      assert.match(button,/<svg/);
      assert.doesNotMatch(button,/Giáo viên/);
    }
    assert.doesNotMatch(readFileSync(new URL('../src/users/bootstrap.js',import.meta.url),'utf8'),/tabLabel/);
  });
  await test('Master badge is hidden without removing existing role hooks',()=>{
    const html=topbarHtml({user:{id:'master',role:'master',name:'Admin'},mode:'api',online:true,ui:{view:'admin'},canSwitchRole:true});
    assert.match(html,/<span class="nhan" hidden>Quản trị cấp cao<\/span>/);
    assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.header-account>\.nhan\[hidden\]\s*\{\s*display:none;/);
    assert.equal(actionButtons(html,'toggle-role-menu').length,1);
    assert.equal(actionButtons(html,'test-role').length,3);
    assert.match(html,/data-role="student">Học sinh/);
    assert.match(html,/data-role="teacher">Giáo viên/);
    assert.match(html,/data-role="master">Admin/);
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
    assert.match(header(real),/\bid="examTimer"/);
    assert.match(real,/\bid="examTimeSummary"/);
    assert.match(real,/\bid="saveState"/);
  });

  await test('Builder places its return link beside provider/level and keeps successful autosave quiet',()=>{
    const input=fixture();
    const html=examBuilderHtml({data:{questions:input.questions},user:{id:'teacher'},exam:input.exam,section:null,readOnly:false});
    const back=actionButtons(html,'back-admin');
    assert.equal(back.length,1);
    assert.ok(hasClass(back[0],'text-link'));
    const meta=html.match(/<div class="builder-meta">([\s\S]*?)<\/div>/)?.[1]||'';
    assert.ok(meta.includes(back[0]));
    assert.ok(meta.indexOf(back[0])<meta.indexOf('<p>'));
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
    assert.ok(previewHeader.indexOf(previewBack)>previewHeader.indexOf(input.exam.title));
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
      if(sectionIndex===2)assert.equal(actionButtons(html,preview?'preview-next-section':'next-section').length,0);
    }
  });

  await test('Question numbering continues across the whole exam',()=>{
    const input=fixture(),question={id:'later',type:'single',prompt:'Later question.',choices:['Yes','No']};
    input.exam.sections[1].questionIds=[question.id];
    const html=examHtml({...input,sectionIndex:1,questions:[question]});
    assert.match(html,/class="question-number">4\.<\/strong> Later question\./);
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
    assert.deepEqual(answered.map(tag=>attribute(tag,'data-q')),['choice','match','written']);
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
      assert.doesNotMatch(html,/<(?:script|svg)\b|<img src=x|<a href="bad"/);
      if(preview)assert.ok(html.includes('Outline &lt;strong&gt;name&lt;/strong&gt;'));
    }
  });

  await test('Instruction images render below text at the approved width',()=>{
    const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.exam-instruction\s*\{[^}]*flex-direction:column/);
    assert.match(css,/\.question-stimulus\s*\{[^}]*flex-direction:column/);
    assert.match(css,/\.exam-instruction img\s*\{[^}]*max-width:min\(760px,86%\)/);
    assert.match(css,/\.question-stimulus img\s*\{[^}]*max-width:min\(760px,86%\)/);
    assert.match(css,/\.exam-instruction img\s*\{[^}]*align-self:flex-start/);
    assert.match(css,/\.question-stimulus img\s*\{[^}]*align-self:flex-start/);
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
      assert.equal(attribute(tags(html,'img')[0],'src'),'/images/answer.png?name=&quot;image&quot;');
      assert.equal(tags(html,'input').filter(tag=>hasClass(tag,'answer-one')).length,2);
    }
  });

  await test('Listening parts expose one section player and hide every question player',()=>{
    const input=fixture();
    input.exam.sections[0].skillKey='listening';
    input.exam.sections[0].audioPolicy={mode:'per_question_segment',segmentRepeat:2,maxSessions:1};
    input.questions[0].audioUrl='/audio/one.mp3';
    input.questions[1].audioUrl='/audio/two.mp3';
    for(const preview of [true,false]){
      const html=examHtml({...input,preview});
      assert.equal(tags(html,'audio').filter(tag=>hasClass(tag,'section-audio-segment')).length,2);
      assert.equal(tags(html,'button').filter(tag=>hasClass(tag,'section-audio-play')).length,1);
      assert.equal(tags(html,'button').filter(tag=>hasClass(tag,'play-audio')).length,0);
      assert.match(html,/data-repeat="2"/);
      assert.match(html,/section-audio-progress/);
      assert.match(html,/section-audio-progress[^>]*hidden/);
      assert.match(html,/Chỉ được nghe một lần/);
    }
    const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
    assert.match(source,/Promise\.all\(audios\.map\(readAudioDuration\)\)/);
    assert.match(source,/completedDuration\+currentTime/);
    assert.match(source,/requestAnimationFrame\(tick\)/);
    assert.match(source,/\['exam','preview-exam','builder','grading-detail'\]\.includes\(ui\.view\)/);
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
    assert.match(html,/class="writing-binary"/);assert.match(html,/Chọn phương án/);assert.match(html,/src="\/images\/form\.png"/);
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
      await import('../src/part-templates/runtime.js');
      assert.equal(typeof frameCallback,'function');
      frameCallback();
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(inspections,0,'The general runtime must leave preview questions alone.');
      assert.deepEqual(requests,[]);
      preview=false;
      mutationCallback();
      frameCallback();
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(requests.length,1,'A real exam must still load its runtime state.');
      assert.match(requests[0],/\/state$/);
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
      builderSavePromise:null,builderAutosaveTimer:null,builderEditRevision:0,
      clearTimeout:()=>{},ui:{view:'builder'},document:{getElementById:()=>({disabled:readOnly})},
      app:{querySelector:()=>null},
      persistBuilderDraft:async()=>{
        calls++;active++;maxActive=Math.max(active,maxActive);
        await new Promise(resolve=>setImmediate(resolve));
        if(changeDuringSave){context.builderEditRevision++;changeDuringSave=false;}
        active--;return !fail;
      }
    });
    vm.runInContext(functions,context);
    const saves=await Promise.all([context.saveBuilderDraft(),context.saveBuilderDraft(),context.saveBuilderDraft()]);
    assert.deepEqual(saves,[true,true,true]);
    assert.equal(maxActive,1,'Concurrent save requests must never overlap.');
    let before=calls;changeDuringSave=true;
    assert.equal(await context.flushBuilderDraft(),true);
    assert.equal(calls-before,2,'Edits entered during a save must also be persisted before leaving.');
    fail=true;
    assert.equal(await context.flushBuilderDraft(),false,'Failed persistence must prevent navigation.');
    before=calls;readOnly=true;
    assert.equal(await context.flushBuilderDraft(),true);
    assert.equal(calls,before,'Read-only preview must not attempt to save a locked exam.');
    for(const action of ['back-admin','select-section','preview-exam','publish-exam']){
      const binding=source.slice(source.indexOf(`app.querySelectorAll('[data-action="${action}"]')`));
      assert.ok(binding.indexOf('if(!await flushBuilderDraft())return;')<binding.indexOf('\n  });')||binding.split('\n')[0].includes('if(!await flushBuilderDraft())return;'),`${action} must flush edits first.`);
    }
  });

  console.log(`\n${passed} kiểm thử preview đã đạt.`);
}finally{
  if(originalStorage===undefined)delete globalThis.sessionStorage;
  else globalThis.sessionStorage=originalStorage;
}
