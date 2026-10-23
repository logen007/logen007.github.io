// Real course controller, shared exam editors and HTTP/SQL service. Synthetic DB only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {createCourseService} from '../server/src/course-service.js';
import {registerCourseRoutes} from '../server/src/course-routes.js';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const {PGlite}=await import(process.env.G2G_PGLITE_PATH);
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost/?view=courses',pretendToBeVisual:true});
for(const name of ['window','document','sessionStorage','localStorage','HTMLElement','HTMLInputElement','Event','CustomEvent','MutationObserver'])globalThis[name]=dom.window[name];
window.scrollTo=()=>{};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const {createCoursesController}=await import('../src/courses/controller.js');
const {newCourseExercise,courseEditorContext,courseExerciseEditorHtml,bindCourseExerciseEditor,collectCourseExercise}=await import('../src/courses/exercise-editor.js');
const {assertCoursePublishable}=await import('../src/domain/courses.js');
const db=new PGlite(),tx=new AsyncLocalStorage();
const query=async(sql,args=[])=>{const r=await(tx.getStore()||db).query(sql,args);return {...r,rowCount:Math.max(r.affectedRows||0,r.rows.length)};};
const service=createCourseService({query,withTx:fn=>db.transaction(client=>tx.run(client,()=>fn({query}))),uid:prefix=>prefix+'-'+randomUUID(),audit:async()=>{}});
const {default:Fastify}=await import('../server/node_modules/fastify/fastify.js');
const app=Fastify(),teacher={id:'teacher',role:'teacher'},student={id:'student',role:'student'};
let user=teacher,route={page:'manage'},controller,failSave=false,dropProgressReceipt=false;
const root=document.querySelector('#app'),notices=[];
const request=async(suffix,options={})=>{
  if(failSave&&options.method==='PUT')throw Error('Synthetic network failure');
  const response=await app.inject({method:options.method||'GET',url:'/api/courses'+suffix,headers:{'x-user':user.id},...(options.body===undefined?{}:{payload:options.body})});
  const data=response.json();if(response.statusCode>=400)throw Error(data.message||data.error);
  if(dropProgressReceipt&&suffix.endsWith('/progress')&&options.method==='PUT'){dropProgressReceipt=false;throw Error('Synthetic lost save receipt');}
  return data;
};
const paint=()=>controller.mount(route);
const until=async(predicate,label)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+label+'; '+notices.at(-1));};
const idle=()=>until(()=>!controller.getState().loading&&!root.hasAttribute('aria-busy'),'controller idle');
const click=async selector=>{const button=root.querySelector(selector);assert.ok(button,'Missing '+selector);button.click();await idle();};
const action=(name,extra='')=>click(`[data-course-action="${name}"]${extra}`);
const fill=(selector,value)=>{const input=root.querySelector(selector);assert.ok(input,'Missing '+selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));return input;};
try{
  await db.exec(await fs.readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  for(const u of [teacher,student])await query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4::jsonb)',[u.id,u.id+'@test.invalid',u.role,JSON.stringify({name:u.id})]);
  registerCourseRoutes(app,{service,userFor:async request=>request.headers['x-user']==='teacher'?teacher:student});
  controller=createCoursesController({root,context:()=>({user}),layout:html=>html,navigate:next=>{route=next;paint();},repaint:paint,notify:m=>notices.push(m),request});
  paint();await idle();await action('create');
  const courseId=controller.getState().editor.id;
  fill('[data-course-field="title"]','Khóa A1 thử nghiệm');fill('[data-course-field="shortDescription"]','Học và luyện tập');
  // Uploaded URL is fixture data; upload transport is covered by the browser and HTTP suite.
  controller.getState().editor.course.coverUrl='/uploads/synthetic-cover.png';
  await action('editor-step','[data-step="content"]');await action('add-chapter');
  const chapterId=controller.getState().editor.course.chapters[0].id;
  fill('[data-course-chapter-title]','Chào hỏi');
  await action('add-lesson','[data-kind="knowledge"]');
  fill('[data-course-lesson-field="title"]','Hallo!');fill('#courseKnowledgeBody','[b]Guten Tag[/b] — Xin chào.');
  failSave=true;assert.equal(await controller.beforeLeave(),false);assert.equal(root.querySelector('#courseKnowledgeBody').value,'[b]Guten Tag[/b] — Xin chào.');assert.equal(controller.isDirty(),true);
  failSave=false;await action('save-lesson');
  await action('add-lesson','[data-kind="exercises"]');
  assert.equal(root.querySelector('[data-course-template]').value,'choices','Do not silently select listening for ordinary choices');
  fill('[data-course-lesson-field="title"]','Luyện chào hỏi');fill('[data-field="title"]','Chọn lời chào');
  ['Hallo','Nein','Danke'].forEach((value,i)=>fill(`[data-choice="${i}"]`,value));
  root.querySelector('[data-field="correct"][value="0"]').click();
  fill('[data-course-explanation]','Hallo dùng để chào hỏi.');
  const exerciseId=controller.getState().editLesson;
  await action('save-lesson');await action('editor-step','[data-step="publish"]');await action('publish');
  assert.equal(controller.getState().editor.status,'published');
  user=student;route={page:'catalog'};paint();await idle();assert.equal(root.querySelectorAll('.course-card').length,1);
  await action('detail');assert.doesNotMatch(root.textContent,/Hallo dùng để/);await action('enroll');
  assert.equal(controller.getState().lesson.lesson.kind,'knowledge');assert.ok(root.querySelector('.course-prose strong'));
  await action('complete-lesson');assert.equal(controller.getState().lesson.lesson.id,exerciseId);
  const qId=controller.getState().lesson.lesson.exercise.questions[0].id;
  dropProgressReceipt=true;root.querySelector('.answer-one[value="1"]').click();await assert.rejects(controller.flushPractice(),/lost save receipt/);
  root.querySelector('.answer-one[value="0"]').click();await controller.flushPractice();
  assert.equal(controller.getState().lesson.revision,2,'Replay uncertain write before sending a newer input');
  assert.equal((await service.getLesson(student,courseId,exerciseId)).draft[qId],0);
  root.querySelector('.answer-one[value="1"]').click();await controller.flushPractice();
  assert.equal((await service.getLesson(student,courseId,exerciseId)).draft[qId],1);
  await action('submit-practice');assert.match(root.textContent,/0.*\/.*1 điểm/);assert.match(root.textContent,/Hallo dùng để chào hỏi/);
  await action('retake');root.querySelector('.answer-one[value="0"]').click();await controller.flushPractice();
  await action('submit-practice');assert.equal(controller.getState().practiceResult.score,1);assert.equal(notices.includes('Bài học đã thay đổi ở tab khác. Vui lòng tải lại.'),false);
  // Fresh controller load restores the durable result and complete state.
  route={page:'detail',id:courseId};paint();await idle();route={page:'learn',id:courseId,lesson:exerciseId};paint();await idle();
  assert.equal(controller.getState().practiceResult.score,1);assert.match(root.textContent,/2\/2 bài hoàn thành/);
  assert.equal((await service.memberResults(teacher,courseId,(await service.members(teacher,courseId)).members[0].id)).submissions.length,2);
  const source=(await service.getCourse(teacher,courseId,{edit:true})).course;
  await service.save(teacher,'paid-ui',{version:0,course:{...source,price:690000}});await service.publish(teacher,'paid-ui',{version:1});
  route={page:'detail',id:'paid-ui'};paint();await idle();await action('enroll');
  assert.equal(controller.getState().detail.enrollment.status,'pending');
  assert.match(root.textContent,/Đăng ký đang chờ/);assert.equal(root.querySelector('[data-course-action="enroll"]'),null,'Same-route enrollment refreshes without leaving a misleading register button');
  // Exercise editor round trips every supported family through the actual shared editor.
  for(const type of ['choices','binary','listening','multiple','letters','matching','headings','gaps']){
    const exercise=newCourseExercise(type),context=courseEditorContext(exercise,teacher),pending=new Map();
    root.innerHTML=courseExerciseEditorHtml(context);const editor=root.querySelector('[data-course-exercise-editor]');
    bindCourseExerciseEditor(editor,context,pending,m=>notices.push(m),()=>{});
    await assert.doesNotReject(collectCourseExercise(editor,context,pending),'Blank '+type+' template remains a saveable draft');
    if(type==='matching'){
      fill('[data-match-prompt]','Ghép từ');[...root.querySelectorAll('[data-course-pair]')].forEach((pair,i)=>{pair.querySelector('[data-pair-left]').value=['Hallo','Danke'][i];pair.querySelector('[data-pair-right]').value=['Xin chào','Cảm ơn'][i];});
    }else if(type==='headings'){
      fill('[data-heading-text]','Ein Text');fill('[data-heading-correct-text]','Begrüßung');fill('[data-heading-distractors]','Essen');
    }else if(type==='gaps'){
      fill('[data-gap-text]','Guten {Tag}!');fill('[data-gap-distractors]','Nacht\nMorgen');
    }else{
      fill('[data-field="title"]','Frage');
      if(type!=='letters')for(const input of root.querySelectorAll('[data-choice]'))input.value='Antwort '+input.dataset.choice;
      const correct=root.querySelector('[data-field="correct"]');if(correct.tagName==='SELECT')correct.value='0';else correct.checked=true;
      if(type==='multiple')root.querySelector('[data-field="correct"][value="2"]').checked=true;
    }
    fill('[data-course-explanation]','Erklärung');
    const roundtrip=await collectCourseExercise(editor,context,pending);
    assert.equal(roundtrip.questions[0].explanation,'Erklärung',type+' explanation');
    assertCoursePublishable({title:'Fixture',coverUrl:'/uploads/test.png',shortDescription:'Test',chapters:[{title:'Test',knowledge:[],exercises:[{kind:'exercise',title:'Test',exercise:roundtrip}]}]});
    if(type==='multiple')assert.deepEqual(roundtrip.questions[0].correctAnswer,[0,2]);
    if(type==='gaps')assert.ok(roundtrip.section.gapPassage.some(part=>part.gap===0));
  }
  assert.ok(chapterId);console.log('Courses DOM/HTTP/SQL: teacher authoring, failed-save retention, publication, student enrollment, completion, autosave, retake, resume and 8 shared exercise families passed.');
}finally{await app.close();await db.close();dom.window.close();}
