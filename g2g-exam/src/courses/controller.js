import {courseRequest,coursePath} from './api.js';
import {coursePageHtml} from './views.js';
import {courseLessons,normalizeCourse,validateCourseAnswers} from '../domain/courses.js';
import {newCourseExercise,newCourseQuestion,courseEditorContext,bindCourseExerciseEditor,collectCourseExercise,changeCoursePrompt} from './exercise-editor.js';
import {bindLetterAnswers} from '../ui/letter-answers.js';
import {readExamAnswers} from '../ui/exam-answers.js';
import {bindImageRemoval} from '../ui/image-remove.js';
import {applyTextStyle} from '../ui/textarea-bold.js';
import {confirmAction} from '../ui/confirm.js';
import {uploadQuestionImage} from '../media.js';
import {textHtml} from '../ui/format.js';
import {questionProfileAt} from '../domain/question-profile.js';

const fresh=route=>({route,loading:true,error:'',filters:{search:'',level:'',fee:''},catalog:null,dirty:false,practiceDirty:false,practiceAnswers:{},practiceResult:null,editLesson:'',pendingAudio:new Map()});
const uuid=prefix=>prefix+'-'+crypto.randomUUID();
const ask=(message,confirmLabel='Tiếp tục')=>new Promise(resolve=>confirmAction(message,()=>resolve(true),{confirmLabel,onCancel:()=>resolve(false)}));

export function createCoursesController({root,context,layout,navigate,repaint,notify,bindAudio,request=courseRequest}){
  let state=fresh({page:'catalog'}),routeKey='',generation=0,loadController=null,searchTimer=null,practiceTimer=null,savingPractice=null,busy=false;
  const user=()=>context().user;
  const markDirty=()=>{state.dirty=true;const indicator=root.querySelector('[data-course-dirty]');if(indicator)indicator.textContent='Có thay đổi chưa lưu';};
  const api=(suffix,options)=>request(suffix,options);
  const currentLesson=()=>state.editor&&courseLessons(state.editor.course).find(lesson=>lesson.id===state.editLesson);
  const setStatus=message=>{state.practiceSaveStatus=message;const label=root.querySelector('[data-course-save-status]');if(label)label.textContent=message;};

  async function load({append=false}={}){
    const target=state,token=++generation;loadController?.abort();loadController=new AbortController();
    if(!append){state.loading=true;state.error='';}
    const options={signal:loadController.signal},route=state.route;
    try{
      const data={};
      if(['catalog','mine','manage'].includes(route.page)){
        const params=new URLSearchParams({...state.filters,...(route.page==='manage'?{manage:'1'}:route.page==='mine'?{mine:'1'}:{}),offset:String(append?state.catalog?.courses.length||0:0)});
        const catalog=await api('?'+params,options);
        data.catalog=append?{...catalog,courses:[...(state.catalog?.courses||[]),...catalog.courses]}:catalog;
      }else if(route.page==='edit')data.editor=await api(coursePath(route.id,'?edit=1'),options);
      else if(route.page==='members')data.members=await api(coursePath(route.id,'/members'),options);
      else{
        data.detail=await api(coursePath(route.id),options);
        if(route.page==='learn'){
          const lessons=courseLessons(data.detail),recent=data.detail.progress?.[0]?.lessonId;
          const lessonId=route.lesson||recent||lessons[0]?.id;
          if(!lessonId)throw new Error('Khóa học chưa có bài học.');
          data.lesson=await api(coursePath(route.id,'/lessons/'+encodeURIComponent(lessonId)),options);
          data.practiceAnswers=structuredClone(data.lesson.draft||{});data.practiceResult=data.lesson.hasDraft?null:data.lesson.result||null;
        }
      }
      if(target!==state||token!==generation)return;
      Object.assign(state,data,{loading:false});
      if(route.page==='edit'&&route.lesson&&courseLessons(state.editor.course).some(l=>l.id===route.lesson))state.editLesson=route.lesson;
      repaint();
    }catch(error){if(target!==state||token!==generation||loadController.signal.aborted)return;state.loading=false;state.error=error.message;repaint();}
  }
  function mount(route){
    const key=JSON.stringify([user()?.id,user()?.role,route]);
    if(key!==routeKey){
      routeKey=key;state=fresh({...route});clearTimeout(searchTimer);clearTimeout(practiceTimer);
      void load();
    }
    if(state.editor&&state.editLesson&&currentLesson()?.kind==='exercise')state.exerciseContext=courseEditorContext(currentLesson().exercise,user());
    root.innerHTML=layout(coursePageHtml(state,user()));
    if(state.loading||state.error)return;
    const editor=root.querySelector('[data-course-exercise-editor]');
    if(editor){bindCourseExerciseEditor(editor,state.exerciseContext,state.pendingAudio,notify,markDirty);bindImageRemoval(editor,markDirty);}
    const exercise=state.lesson?.lesson.kind==='exercise'&&!state.practiceResult?state.lesson.lesson.exercise:state.previewExercise;
    if(exercise){
      bindLetterAnswers(root,exercise.questions,state.practiceAnswers,(id,value)=>{state.practiceAnswers[id]=value;queuePractice();});
      bindAudio?.({id:'course-practice'},{preview:true,repeatable:true});
    }
    if(state.previewCourse)bindAudio?.({id:'course-preview'},{preview:true,repeatable:true});
  }
  async function collectEditor(){
    const lesson=currentLesson(),editor=root.querySelector('[data-course-exercise-editor]');
    if(lesson?.kind==='exercise'&&editor){lesson.exercise=await collectCourseExercise(editor,state.exerciseContext,state.pendingAudio);state.pendingAudio.clear();}
    return lesson;
  }
  async function saveEditor(){
    if(!state.editor)return;
    await collectEditor();
    const normalized=normalizeCourse(state.editor.course);
    const saved=await api(coursePath(state.editor.id),{method:'PUT',body:{version:state.editor.version,course:normalized}});
    state.editor=saved;state.dirty=false;
  }
  function readPractice(){
    const answers=readExamAnswers(root);
    for(const input of root.querySelectorAll('[data-letter-answer]'))if(!input.disabled)answers[input.dataset.q]=input.value===''?null:Number(input.value);
    for(const input of root.querySelectorAll('.answer-many')){answers[input.dataset.q]??=[];if(input.checked)answers[input.dataset.q].push(Number(input.value));}
    Object.assign(state.practiceAnswers,answers);
    return structuredClone(state.practiceAnswers);
  }
  function queuePractice(){
    if(state.route.page!=='learn'||state.lesson?.lesson.kind!=='exercise'||state.lesson.trial||state.practiceResult)return;
    readPractice();state.practiceDirty=true;setStatus('Chưa lưu…');clearTimeout(practiceTimer);
    practiceTimer=setTimeout(()=>flushPractice().catch(error=>{setStatus('Chưa lưu · '+error.message);notify(error.message);}),700);
  }
  async function flushPractice(){
    clearTimeout(practiceTimer);
    if(savingPractice)await savingPractice;
    if(!state.practiceDirty)return;
    const target=state;
    savingPractice=(async()=>{
      while(target===state&&state.practiceDirty){
        state.practiceDirty=false;
        try{
          state.pendingProgress??={answers:structuredClone(state.practiceAnswers),revision:state.lesson.revision,operationKey:uuid('progress')};
          const saved=await api(coursePath(state.route.id,'/lessons/'+encodeURIComponent(state.lesson.lesson.id)+'/progress'),{method:'PUT',body:state.pendingProgress});
          state.lesson.revision=saved.revision;
          if(JSON.stringify(state.practiceAnswers)!==JSON.stringify(state.pendingProgress.answers))state.practiceDirty=true;
          state.pendingProgress=null;setStatus('Đã lưu bài tập');
        }catch(error){state.practiceDirty=true;throw error;}
      }
    })();
    try{await savingPractice;}finally{savingPractice=null;}
  }
  async function beforeLeave(){
    if(busy)return false;
    try{if(state.route.page==='edit'&&state.dirty)await saveEditor();await flushPractice();return true;}
    catch(error){notify(error.message);return false;}
  }
  async function go(route){
    // Internal navigation occurs inside a serialized action; it still saves drafts.
    if(state.route.page==='edit'&&state.dirty)await saveEditor();
    await flushPractice();
    if(JSON.stringify(state.route)===JSON.stringify(route))await load();else navigate(route);
    window.scrollTo({top:0,behavior:'instant'});
  }
  async function nextLesson(delta=1){
    const lessons=courseLessons(state.detail),at=lessons.findIndex(item=>item.id===state.lesson.lesson.id),next=lessons[at+delta];
    await go(next?{page:'learn',id:state.route.id,lesson:next.id}:{page:'detail',id:state.route.id});
  }
  async function perform(button,fn){
    if(busy)return;busy=true;button.disabled=true;root.setAttribute('aria-busy','true');
    try{await fn();}
    catch(error){notify(error.message||'Chưa thực hiện được. Nội dung đang nhập vẫn được giữ.');}
    finally{busy=false;if(button.isConnected)button.disabled=false;root.removeAttribute('aria-busy');}
  }
  async function action(name,button){
    const id=button.dataset.id||state.route.id,course=state.editor?.course;
    if(['catalog','mine','manage','detail','edit','members','learn'].includes(name))return go({page:name,id:['catalog','mine','manage'].includes(name)?'':id});
    if(name==='lesson')return go({page:'learn',id,lesson:button.dataset.lesson});
    if(name==='reload'){await load();return;}
    if(name==='more'){await load({append:true});return;}
    if(name==='create'){
      const id=uuid('course'),blank={title:'',coverUrl:'',price:0,level:'A1',shortDescription:'',description:'',chapters:[]};
      await api(coursePath(id),{method:'PUT',body:{version:0,course:blank}});return go({page:'edit',id,step:'info'});
    }
    if(name==='save-course'||name==='save-lesson'){await saveEditor();if(name==='save-lesson')state.editLesson='';repaint();notify('Đã lưu khóa học.');return;}
    if(name==='editor-step')return go({page:'edit',id:state.editor.id,step:button.dataset.step});
    if(name==='add-chapter'){await collectEditor();course.chapters.push({id:uuid('chapter'),title:'Chương mới',knowledge:[],exercises:[]});markDirty();repaint();return;}
    if(name.startsWith('chapter-')){
      await collectEditor();const index=course.chapters.findIndex(c=>c.id===id);if(index<0)return;
      if(name==='chapter-remove'){if(!await ask('Bỏ chương và các bài khỏi bản nháp? Lịch sử học của học viên không thay đổi.','Bỏ chương'))return;course.chapters.splice(index,1);}
      else{const next=index+(name==='chapter-up'?-1:1);if(next>=0&&next<course.chapters.length)[course.chapters[index],course.chapters[next]]=[course.chapters[next],course.chapters[index]];}
      markDirty();repaint();return;
    }
    if(name==='add-lesson'){
      const chapter=course.chapters.find(c=>c.id===button.dataset.chapter),kind=button.dataset.kind;if(!chapter)return;
      const lesson={id:uuid('lesson'),kind:kind==='knowledge'?'knowledge':'exercise',title:kind==='knowledge'?'Bài kiến thức mới':'Bộ bài tập mới',trial:false,...(kind==='knowledge'?{body:'',imageUrl:''}:{exercise:newCourseExercise()})};
      chapter[kind].push(lesson);state.editLesson=lesson.id;state.sources=null;markDirty();repaint();return;
    }
    if(name==='edit-lesson'){await collectEditor();state.editLesson=id;state.sources=null;repaint();return;}
    if(name==='close-lesson'){await collectEditor();state.editLesson='';repaint();return;}
    if(name.startsWith('lesson-')){
      const chapter=course.chapters.find(c=>c.id===button.dataset.chapter),items=chapter?.[button.dataset.kind];if(!items)return;
      const index=items.findIndex(item=>item.id===id);if(index<0)return;
      if(name==='lesson-remove'){if(!await ask('Bỏ bài này khỏi bản nháp?','Bỏ bài'))return;items.splice(index,1);}
      else{const next=index+(name==='lesson-up'?-1:1);if(next>=0&&next<items.length)[items[index],items[next]]=[items[next],items[index]];}
      markDirty();repaint();return;
    }
    if(name==='format'){applyTextStyle(root.querySelector('#courseKnowledgeBody'),button.dataset.tag,{allowEmpty:true});return;}
    if(name==='remove-lesson-image'){currentLesson().imageUrl='';markDirty();repaint();return;}
    if(name==='show-sources'){await collectEditor();state.sources=await api('/exercise-sources');repaint();return;}
    if(name==='import-source'){
      const [exam,section]=(root.querySelector('[data-course-source]').value||'').split('|');if(!exam||!section)throw new Error('Vui lòng chọn phần thi.');
      if(!await ask('Thay bộ bài hiện tại bằng bản sao độc lập của phần thi đã chọn?','Sao chép'))return;
      const imported=await api('/exercise-sources/'+encodeURIComponent(exam)+'/'+encodeURIComponent(section));
      imported.section.id=uuid('part');for(const q of imported.questions)q.id=uuid('q');imported.section.questionIds=imported.questions.map(q=>q.id);
      currentLesson().exercise=imported;markDirty();repaint();return;
    }
    if(name==='apply-template'){
      const value=root.querySelector('[data-course-template]').value;
      if(!await ask('Đổi mẫu sẽ thay các câu hiện tại trong bản nháp của bộ bài này.','Đổi mẫu'))return;
      currentLesson().exercise=newCourseExercise(value);markDirty();repaint();return;
    }
    if(name==='add-question'){await collectEditor();const ex=currentLesson().exercise;for(let i=0;i<(ex.section.questionProfile.pairedQuestions?2:1);i++)ex.questions.push(newCourseQuestion(questionProfileAt(ex.section,ex.questions.length)));ex.section.questionIds=ex.questions.map(q=>q.id);ex.section.questionLimit=ex.questions.length;markDirty();repaint();return;}
    if(name==='add-pair'||name==='remove-pair'){
      await collectEditor();const q=currentLesson().exercise.questions.find(q=>q.id===button.dataset.q);if(!q)return;
      if(name==='add-pair')q.pairs.push(['','']);else q.pairs.splice(Number(button.dataset.index),1);markDirty();repaint();return;
    }
    if(name==='preview-exercise'){await collectEditor();state.previewExercise=structuredClone(currentLesson().exercise);state.practiceAnswers={};repaint();return;}
    if(name==='preview-course'){await collectEditor();state.previewCourse=true;repaint();return;}
    if(name==='close-preview'){state.previewExercise=null;state.previewCourse=false;repaint();return;}
    if(name==='publish'){await saveEditor();const published=await api(coursePath(state.editor.id,'/publish'),{method:'POST',body:{version:state.editor.version}});Object.assign(state.editor,published,{publishedVersion:published.version});repaint();notify('Đã xuất bản khóa học.');return;}
    if(name==='archive'){
      if(!await ask('Ngừng nhận đăng ký mới? Học viên đã đăng ký vẫn học bình thường.','Ngừng đăng ký'))return;
      await saveEditor();await api(coursePath(state.editor.id,'/archive'),{method:'POST',body:{version:state.editor.version}});return go({page:'manage'});
    }
    if(name==='enroll'){
      const enrolled=await api(coursePath(id,'/enroll'),{method:'POST',body:{}});
      notify(enrolled.status==='active'?'Đăng ký thành công. Bạn có thể học ngay.':'Đã đăng ký. Vui lòng liên hệ trung tâm xác nhận học phí.');
      return go({page:enrolled.status==='active'?'learn':'detail',id});
    }
    if(name==='complete-lesson'){
      if(!state.lesson.completedAt){const saved=await api(coursePath(id,'/lessons/'+encodeURIComponent(state.lesson.lesson.id)+'/progress'),{method:'PUT',body:{complete:true,revision:state.lesson.revision}});Object.assign(state.lesson,{revision:saved.revision,completedAt:saved.completedAt});}
      return nextLesson();
    }
    if(name==='next-lesson')return nextLesson();
    if(name==='previous-lesson')return nextLesson(-1);
    if(name==='submit-practice'){
      const answers=readPractice();validateCourseAnswers(state.lesson.lesson.exercise,answers,{complete:true});
      if(state.lesson.trial){state.practiceResult=await api(coursePath(id,'/lessons/'+encodeURIComponent(state.lesson.lesson.id)+'/try'),{method:'POST',body:{answers}});repaint();return;}
      await flushPractice();state.pendingSubmission??={requestKey:uuid('submit'),answers};
      const result=await api(coursePath(id,'/lessons/'+encodeURIComponent(state.lesson.lesson.id)+'/submit'),{method:'POST',body:state.pendingSubmission});
      state.pendingSubmission=null;state.practiceResult=result;state.lesson.revision=result.revision;state.lesson.completedAt=new Date().toISOString();state.practiceDirty=false;repaint();return;
    }
    if(name==='retake'){state.practiceAnswers={};state.practiceResult=null;state.pendingSubmission=null;state.practiceSaveStatus='Lượt luyện tập mới';repaint();return;}
    if(name==='approve'||name==='reject'){
      if(!await ask(name==='approve'?'Xác nhận trung tâm đã nhận đủ học phí và mở khóa cho học viên này?':'Từ chối đăng ký này?',name==='approve'?'Xác nhận học phí':'Từ chối'))return;
      await api(coursePath(id,'/enrollments/'+encodeURIComponent(button.dataset.enrollment)+'/confirm'),{method:'POST',body:{approve:name==='approve'}});await load();return;
    }
    if(name==='member-results'){state.memberResults=await api(coursePath(id,'/members/'+encodeURIComponent(button.dataset.enrollment)+'/results'));repaint();return;}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled||!root.contains(button))return;
    if(button.dataset.courseAction){event.preventDefault();void perform(button,()=>action(button.dataset.courseAction,button));return;}
    const editor=root.querySelector('[data-course-exercise-editor]');if(!editor?.contains(button))return;
    const standard=button.dataset.action,promptAction=button.dataset.sectionInstructionAction;
    if(!promptAction&&!['add-inline-question','remove-inline-question','toggle-question-example','add-question-instruction','remove-question-instruction','move-question-instruction'].includes(standard))return;
    event.preventDefault();void perform(button,async()=>{
      await collectEditor();const ex=currentLesson().exercise;
      if(promptAction)Object.assign(ex.section,changeCoursePrompt(ex.section,Number(button.dataset.index),promptAction,ex.questions));
      else{
        const index=ex.questions.findIndex(q=>q.id===(button.dataset.id||button.dataset.after));
        if(standard==='add-inline-question'){
          const paired=ex.section.questionProfile.pairedQuestions,at=index<0?ex.questions.length:paired?Math.floor(index/2)*2+2:index+1;
          ex.questions.splice(at,0,...Array.from({length:paired?2:1},(_,offset)=>newCourseQuestion(questionProfileAt(ex.section,at+offset))));
        }
        else if(standard==='remove-inline-question'){
          if(index<0)return;ex.questions.splice(ex.section.questionProfile.pairedQuestions?Math.floor(index/2)*2:index,ex.section.questionProfile.pairedQuestions?2:1);
          ex.section.gapPassage=(ex.section.gapPassage||[]).flatMap(part=>typeof part==='string'||part.example?[part]:part.gap===index?[]:[{gap:part.gap>index?part.gap-1:part.gap}]);
        }else if(standard==='toggle-question-example'&&index>=0){const paired=ex.section.questionProfile.pairedQuestions,start=paired?Math.floor(index/2)*2:index,example=!ex.questions[index].example;for(let i=0;i<(paired?2:1);i++)if(ex.questions[start+i])ex.questions[start+i].example=example;}
        else if(index>=0){
          const blocks=ex.questions[index].instructionBlocks||[],at=Number(button.dataset.index)||0;
          if(standard==='add-question-instruction')blocks.splice(at+1,0,{text:'',imageUrl:'',audioUrl:''});
          else if(standard==='remove-question-instruction')blocks.splice(at,1);
          else{const next=at+(button.dataset.dir==='up'?-1:1);if(next>=0&&next<blocks.length)[blocks[at],blocks[next]]=[blocks[next],blocks[at]];}
          ex.questions[index].instructionBlocks=blocks;
        }
      }
      ex.section.questionIds=ex.questions.map(q=>q.id);ex.section.questionLimit=ex.questions.length;markDirty();repaint();
    });
  });
  const input=event=>{
    const field=event.target;
    if(field.dataset.courseFilter){
      state.filters[field.dataset.courseFilter]=field.value;clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>{const active=root.ownerDocument.activeElement,id=active?.id,start=active?.selectionStart;void load().then(()=>{const next=id&&root.querySelector('#'+id);if(next){next.focus();if(start!=null&&next.setSelectionRange)next.setSelectionRange(start,start);}});},field.tagName==='SELECT'?0:300);return;
    }
    if(state.route.page==='edit'){
      if(field.dataset.courseField)state.editor.course[field.dataset.courseField]=field.type==='number'?Number(field.value):field.value;
      if(field.dataset.courseChapterTitle){const chapter=state.editor.course.chapters.find(c=>c.id===field.dataset.courseChapterTitle);if(chapter)chapter.title=field.value;}
      if(field.dataset.courseLessonField){const lesson=currentLesson();if(lesson)lesson[field.dataset.courseLessonField]=field.type==='checkbox'?field.checked:field.value;}
      if(root.querySelector('.course-editor-main')?.contains(field)){markDirty();const preview=root.querySelector('.course-knowledge-editor+details .course-prose');if(preview&&field.dataset.courseLessonField==='body')preview.innerHTML=textHtml(field.value);}
    }
    if(field.closest('.course-practice'))queuePractice();
  };
  root.addEventListener('input',input);root.addEventListener('change',input);
  root.addEventListener('change',event=>{
    const input=event.target;if(!input.dataset.courseUpload||!input.files?.[0])return;
    const button=input.closest('label');void perform(button,async()=>{
      await collectEditor();const url=await uploadQuestionImage(input.files[0],{slot:'course-'+input.dataset.courseUpload});
      if(input.dataset.courseUpload==='cover')state.editor.course.coverUrl=url;else currentLesson().imageUrl=url;
      markDirty();repaint();
    });
  });
  return {mount,beforeLeave,isDirty:()=>state.dirty||state.practiceDirty||busy,
    open:async route=>{if(await beforeLeave())navigate(route);},getState:()=>state,flushPractice};
}
