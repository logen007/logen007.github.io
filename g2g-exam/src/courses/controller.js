import {beginNavigationLoading} from '../ui/navigation-loading.js';
import {normalizeCourseSlug,courseSlugFromTitle} from '../domain/course-url.js';
import {courseRequest,coursePath} from './api.js';
import {coursePageHtml,coursePermalinkHtml,courseTagSuggestionsHtml} from './views.js';
import {createCoursePreview,coursePreviewAction} from './preview.js';
import {courseLessons,normalizeCourse,validateCourseAnswers} from '../domain/courses.js';
import {newCourseExercise,newCourseQuestion,courseEditorContext,bindCourseExerciseEditor,collectCourseExercise,changeCoursePrompt} from './exercise-editor.js';
import {bindLetterAnswers} from '../ui/letter-answers.js';
import {readExamAnswers} from '../ui/exam-answers.js';
import {bindImageRemoval} from '../ui/image-remove.js';
import {confirmAction} from '../ui/confirm.js';
import {uploadCourseImage,validateImageFile} from '../media.js';
import {COURSE_IMAGE_MAX_BYTES} from '../domain/media-limits.js';
import {knowledgeBlocks,courseDescriptionContent,MAX_KNOWLEDGE_BLOCKS,KNOWLEDGE_LAYOUT_VERSION} from '../domain/course-knowledge.js';
import {questionProfileAt} from '../domain/question-profile.js';

const fresh=route=>({route,loading:true,error:'',filters:{search:'',level:'',fee:'',tag:''},catalog:null,dirty:false,practiceDirty:false,practiceAnswers:{},practiceResult:null,editLesson:'',pendingAudio:new Map()});
const uuid=prefix=>prefix+'-'+crypto.randomUUID();
const publishedActions=new Set(['catalog','mine','manage','detail','edit','members','learn','reload','more','preview-managed','editor-step','edit-chapter','edit-category','edit-lesson','close-lesson','preview-exercise','preview-course','close-preview','unpublish','archive','permalink-edit']);
const ask=(message,confirmLabel='Tiếp tục',options={})=>new Promise(resolve=>confirmAction(message,()=>resolve(true),{...options,confirmLabel,onCancel:()=>resolve(false)}));

export function createCoursesController({root,context,layout,navigate,repaint,notify,bindAudio,request=courseRequest,uploadImage=uploadCourseImage}){
  let state=fresh({page:'catalog'}),routeKey='',generation=0,loadController=null,searchTimer=null,practiceTimer=null,savingPractice=null,busy=false,editorTimer=null,editorRevision=0,savingEditor=null,knowledgeBinding=null,knowledgeRuntime=null;
  const user=()=>context().user;
  const published=()=>state.editor?.status==='published';
  const readOnly=()=>published()||state.publicationBusy;
  const editorStatus=(message,error=false)=>{state.editorSaveStatus=message;state.editorSaveError=error;const indicator=root.querySelector('[data-course-dirty]');if(indicator){indicator.hidden=!message;indicator.textContent=message;indicator.dataset.state=error?'error':'pending';}const retry=root.querySelector('[data-course-action="retry-save"]');if(retry)retry.hidden=!error;};
  const refreshPermalink=()=>{const slot=root.querySelector('[data-course-permalink]');if(slot&&state.editor)slot.innerHTML=coursePermalinkHtml(state);};
  const queueEditor=()=>{clearTimeout(editorTimer);if(state.route.page==='edit'&&state.dirty&&!state.editorSaveError)editorTimer=setTimeout(()=>{if(!busy)void saveEditor().catch(error=>notify(error.message));},600);};
  const markDirty=()=>{if(readOnly())return;state.dirty=true;editorRevision++;editorStatus('Chưa lưu…');queueEditor();};
  const api=(suffix,options)=>request(suffix,options);
  const currentLesson=()=>state.editor&&courseLessons(state.editor.course).find(lesson=>lesson.id===state.editLesson);
  const editorContent=()=>state.editLesson?currentLesson():courseDescriptionContent(state.editor.course);
  const blocks=()=>knowledgeBlocks(editorContent());
  const setStatus=message=>{state.practiceSaveStatus=message;const label=root.querySelector('[data-course-save-status]');if(label)label.textContent=message;};

  async function load({append=false}={}){
    const target=state,token=++generation;loadController?.abort();loadController=new AbortController();
    if(!append){state.loading=true;state.error='';}
    const options={signal:loadController.signal},route=state.route,endLoading=beginNavigationLoading(root.ownerDocument);
    try{
      const data={};
      if(['catalog','mine','manage'].includes(route.page)){
        const params=new URLSearchParams({...state.filters,...(route.page==='manage'?{manage:'1'}:route.page==='mine'?{mine:'1'}:{}),offset:String(append?state.catalog?.courses.length||0:0)});
        const catalog=await api('?'+params,options);
        data.catalog=append?{...catalog,courses:[...(state.catalog?.courses||[]),...catalog.courses]}:catalog;
      }else if(route.page==='edit'){
        const [editor,tags]=await Promise.all([api(coursePath(route.id,'?edit=1'),options),api('?manage=1&limit=1',options).then(result=>result.tags||[]).catch(()=>[])]);data.editor=editor;data.tagSuggestions=tags;
      }
      else if(route.page==='members')data.members=await api(coursePath(route.id,'/members'),options);
      else{
        data.detail=await api(route.slug&&!route.id?'/url/'+encodeURIComponent(route.slug):coursePath(route.id),options);
        route.id=data.detail.id;
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
      if(route.page==='edit'&&route.step==='preview')state.preview=createCoursePreview(state.editor);
      repaint();
    }catch(error){if(target!==state||token!==generation||loadController.signal.aborted)return;state.loading=false;state.error=error.message;repaint();}finally{endLoading();}
  }
  function mount(route){
    knowledgeBinding?.destroy();knowledgeBinding=null;
    const key=JSON.stringify([user()?.id,user()?.role,route]);
    if(key!==routeKey){
      routeKey=key;state=fresh({...route});clearTimeout(searchTimer);clearTimeout(practiceTimer);clearTimeout(editorTimer);editorRevision=0;
      void load();
    }
    if(state.editor&&state.editLesson&&currentLesson()?.kind==='exercise')state.exerciseContext=courseEditorContext(currentLesson().exercise,user());
    if(state.editor&&!readOnly()&&state.editLesson&&currentLesson()?.kind==='knowledge')blocks();
    root.innerHTML=layout(coursePageHtml(state,user()));
    if(state.loading||state.error)return;
    if(readOnly())for(const field of root.querySelectorAll('.course-authoring input,.course-authoring textarea,.course-authoring select,.course-authoring button'))if(state.publicationBusy||field.tagName!=='BUTTON'||!publishedActions.has(field.dataset.courseAction))field.disabled=true;
    const knowledgeRoot=root.querySelector('[data-knowledge-editor]');
    if(knowledgeRoot){
      knowledgeRuntime??=import('./knowledge-visual-editor.js');
      void knowledgeRuntime.then(({bindKnowledgeVisualEditor})=>{
        if(!knowledgeRoot.isConnected)return;
        knowledgeBinding=bindKnowledgeVisualEditor(knowledgeRoot,{lesson:editorContent(),label:state.editLesson?'Nội dung kiến thức':'Mô tả khóa học',notify,onChange:items=>{if(state.editLesson)currentLesson().blocks=items;else{state.editor.course.descriptionBlocks=items;state.editor.course.description=items.filter(item=>item.type==='text').map(item=>item.text).join('\n\n');}markDirty();},onFiles:(files,options)=>void uploadFiles(files,'lesson',knowledgeRoot.querySelector('[data-course-pick="lesson"]'),options)});
      }).catch(error=>{if(knowledgeRoot.isConnected){knowledgeRoot.dataset.ready='error';knowledgeRoot.querySelector('[data-knowledge-canvas]').textContent='Không mở được trình soạn. Vui lòng tải lại trang.';notify(error.message);}});
    }
    const editor=root.querySelector('[data-course-exercise-editor]');
    if(editor&&!readOnly()){bindCourseExerciseEditor(editor,state.exerciseContext,state.pendingAudio,notify,markDirty);bindImageRemoval(editor,markDirty);}
    const practice=state.preview?.current||(!state.preview?state:null);
    const exercise=practice?.lesson?.lesson.kind==='exercise'&&!practice.practiceResult?practice.lesson.lesson.exercise:null;
    if(exercise){
      bindLetterAnswers(root,exercise.questions,practice.practiceAnswers,(id,value)=>{practice.practiceAnswers[id]=value;queuePractice();});
      bindAudio?.({id:'course-practice'},{preview:true,repeatable:true});
    }
  }
  async function collectEditor(){
    const lesson=currentLesson(),editor=root.querySelector('[data-course-exercise-editor]');
    if(!readOnly()&&lesson?.kind==='exercise'&&editor){lesson.exercise=await collectCourseExercise(editor,state.exerciseContext,state.pendingAudio);state.pendingAudio.clear();}
    return lesson;
  }
  async function saveEditor(){
    clearTimeout(editorTimer);
    if(savingEditor)await savingEditor;
    if(!state.editor||!state.dirty)return;
    const target=state;
    savingEditor=(async()=>{
      try{
        while(target===state&&target.dirty){
          if(!target.pendingEditorSave){
            const revision=editorRevision;await collectEditor();
            target.pendingEditorSave={revision,body:{version:target.editor.version,autoSlug:!target.editor.course.slug&&Boolean(target.editor.course.title.trim()),knowledgeLayout:KNOWLEDGE_LAYOUT_VERSION,course:normalizeCourse(target.editor.course)}};
          }
          const pending=target.pendingEditorSave;editorStatus('Đang lưu…');
          const saved=await api(coursePath(target.editor.id),{method:'PUT',body:pending.body});
          if(target!==state)return;
          if(pending.revision===editorRevision){target.editor={...target.editor,...saved};target.dirty=false;}
          else Object.assign(target.editor,{version:saved.version,status:saved.status,publishedVersion:saved.publishedVersion});
          target.pendingEditorSave=null;
        }
        if(target===state){editorStatus('');if(state.permalinkDraft===undefined)refreshPermalink();}
      }catch(error){if(target===state){if([400,409].includes(error.status))target.pendingEditorSave=null;target.dirty=true;editorStatus(error.message||'Chưa lưu được thay đổi.',true);}throw error;}
    })();
    try{await savingEditor;}finally{savingEditor=null;}
  }
  function readPractice(){
    const practice=state.preview?.current||state;
    const answers=readExamAnswers(root);
    for(const input of root.querySelectorAll('[data-letter-answer]'))if(!input.disabled)answers[input.dataset.q]=input.value===''?null:Number(input.value);
    for(const input of root.querySelectorAll('.answer-many')){answers[input.dataset.q]??=[];if(input.checked)answers[input.dataset.q].push(Number(input.value));}
    Object.assign(practice.practiceAnswers,answers);
    return structuredClone(practice.practiceAnswers);
  }
  function queuePractice(){
    if(state.preview){if(state.preview.current?.lesson.lesson.kind==='exercise'&&!state.preview.current.practiceResult)readPractice();return;}
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
    try{if(state.route.page==='edit')await saveEditor();await flushPractice();return true;}
    catch(error){notify(error.message);return false;}
  }
  async function go(route){
    if(['detail','learn'].includes(route.page)){const selected=state.catalog?.courses.find(c=>c.id===route.id)||(state.detail?.id===route.id?state.detail:state.editor?.id===route.id?state.editor.course:null);if(selected?.slug)route.slug=selected.slug;}
    // Internal navigation occurs inside a serialized action; it still saves drafts.
    if(state.route.page==='edit')await saveEditor();
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
    clearTimeout(editorTimer);
    try{if(savingEditor)await savingEditor;await fn();}
    catch(error){notify(error.message||'Chưa thực hiện được. Nội dung đang nhập vẫn được giữ.');}
    finally{busy=false;if(button.isConnected)button.disabled=false;root.removeAttribute('aria-busy');queueEditor();}
  }
  async function action(name,button){
    if(name==='filter-tag'){state.filters.tag=button.dataset.tag||'';clearTimeout(searchTimer);await load();return;}
    const id=button.dataset.id||state.route.id,course=state.editor?.course;
    if(state.preview){
      const answers=state.preview.current?.lesson.lesson.kind==='exercise'&&!state.preview.current.practiceResult?readPractice():undefined;
      if(name==='close-preview'){
        state.preview=null;
        if(state.route.step==='preview')return go({page:'edit',id:state.editor.id,step:'info'});
      }else coursePreviewAction(state.preview,name,{lessonId:button.dataset.lesson,answers});
      repaint();return; // Preview actions must never reach enrollment/progress APIs.
    }
    if(published()&&!publishedActions.has(name))throw Error('Hãy bỏ xuất bản khóa học trước khi chỉnh sửa.');
    if(name==='permalink-edit'){
      if(published()){
        if(!await ask('Bỏ xuất bản khóa học để sửa permalink? Học viên đã đăng ký vẫn giữ phiên bản hiện tại.','Bỏ xuất bản'))return;
        const receipt=await api(coursePath(state.editor.id,'/unpublish'),{method:'POST',body:{version:state.editor.version}});
        Object.assign(state.editor,receipt);repaint();
      }
      await saveEditor();state.permalinkDraft=state.editor.course.slug||courseSlugFromTitle(state.editor.course.title);refreshPermalink();
      const input=root.querySelector('[data-course-permalink-input]');input?.focus();input?.select();return;
    }
    if(name==='permalink-cancel'){
      if(state.pendingEditorSave)await saveEditor();
      state.permalinkDraft=undefined;editorStatus('');refreshPermalink();queueEditor();root.querySelector('[data-course-action="permalink-edit"]')?.focus();return;
    }
    if(name==='permalink-save'){
      const previous=course.slug,slug=normalizeCourseSlug(state.permalinkDraft)||courseSlugFromTitle(course.title);
      if(!slug)throw Error('Vui lòng nhập đường dẫn khóa học.');
      course.slug=slug;markDirty();
      try{await saveEditor();}catch(error){if([400,409].includes(error.status))course.slug=previous;throw error;}
      state.permalinkDraft=undefined;refreshPermalink();root.querySelector('[data-course-action="permalink-edit"]')?.focus();return;
    }
    if(['catalog','mine','manage','detail','edit','members','learn'].includes(name))return go({page:name,id:['catalog','mine','manage'].includes(name)?'':id});
    if(name==='lesson')return go({page:'learn',id,lesson:button.dataset.lesson});
    if(name==='reload'){await load();return;}
    if(name==='more'){await load({append:true});return;}
    if(name==='copy-course'){
      if(state.route.page!=='manage')return;
      if(state.pendingCourseCopy?.sourceId!==id){
        const source=await api(coursePath(id,'?edit=1'));
        state.pendingCourseCopy={sourceId:id,id:uuid('course'),course:normalizeCourse({...source.course,slug:'',title:(source.course.title||'Khóa học').slice(0,190)+' (bản sao)'})};
      }
      const copy=state.pendingCourseCopy;
      await api(coursePath(copy.id),{method:'PUT',body:{version:0,knowledgeLayout:KNOWLEDGE_LAYOUT_VERSION,course:copy.course}});
      state.pendingCourseCopy=null;return go({page:'edit',id:copy.id,step:'info'});
    }
    if(name==='delete-course'){
      if(state.route.page!=='manage')return;
      const item=state.catalog?.courses.find(course=>course.id===id);if(!item)return;
      if(!await ask('Chuyển khóa học này vào Thùng rác? Học viên đã đăng ký vẫn giữ nguyên bài học, tiến độ và kết quả.','Chuyển vào Thùng rác',{danger:true}))return;
      await api(coursePath(id,'/delete'),{method:'POST',body:{version:item.version}});await load();return;
    }
    if(name==='create'){
      const id=uuid('course'),blank={title:'',coverUrl:'',price:0,level:'A1',shortDescription:'',description:'',chapters:[]};
      await api(coursePath(id),{method:'PUT',body:{version:0,course:blank}});return go({page:'edit',id,step:'info'});
    }
    if(name==='retry-save'){await saveEditor();return;}
    if(name==='preview-managed')return go({page:'edit',id,step:'preview'});
    if(name==='editor-step')return go({page:'edit',id:state.editor.id,step:button.dataset.step});
    if(name==='edit-chapter')return go({page:'edit',id:state.editor.id,step:'content',chapter:id});
    if(name==='edit-category'){
      const chapter=course.chapters.find(item=>item.id===button.dataset.chapter),kind=button.dataset.kind;
      if(!chapter||!['knowledge','exercises'].includes(kind))return;
      const lesson=chapter[kind][0];
      if(!lesson)return published()?go({page:'edit',id:state.editor.id,step:'content',chapter:chapter.id,kind}):action('add-lesson',button);
      return go({page:'edit',id:state.editor.id,step:'content',chapter:chapter.id,kind,lesson:lesson.id});
    }
    if(name==='add-chapter'){await collectEditor();const chapter={id:uuid('chapter'),title:'Chương mới',knowledge:[],exercises:[]};course.chapters.push(chapter);markDirty();return go({page:'edit',id:state.editor.id,step:'content',chapter:chapter.id});}
    if(name.startsWith('chapter-')){
      await collectEditor();const index=course.chapters.findIndex(c=>c.id===id);if(index<0)return;
      if(name==='chapter-remove'){if(!await ask('Bỏ chương và các bài trong chương? Lịch sử học của học viên không thay đổi.','Bỏ chương'))return;course.chapters.splice(index,1);}
      else{const next=index+(name==='chapter-up'?-1:1);if(next>=0&&next<course.chapters.length)[course.chapters[index],course.chapters[next]]=[course.chapters[next],course.chapters[index]];}
      markDirty();if(name==='chapter-remove')return go({page:'edit',id:state.editor.id,step:'content'});repaint();return;
    }
    if(name==='add-lesson'){
      const chapter=course.chapters.find(c=>c.id===button.dataset.chapter),kind=button.dataset.kind;if(!chapter)return;
      const lesson={id:uuid('lesson'),kind:kind==='knowledge'?'knowledge':'exercise',title:kind==='knowledge'?'Bài kiến thức mới':'Bộ bài tập mới',trial:false,...(kind==='knowledge'?{body:'',imageUrl:''}:{exercise:newCourseExercise()})};
      chapter[kind].push(lesson);markDirty();return go({page:'edit',id:state.editor.id,step:'content',chapter:chapter.id,kind,lesson:lesson.id});
    }
    if(name==='edit-lesson'){const chapter=course.chapters.find(chapter=>[...chapter.knowledge,...chapter.exercises].some(lesson=>lesson.id===id));if(chapter)return go({page:'edit',id:state.editor.id,step:'content',chapter:chapter.id,kind:chapter.knowledge.some(lesson=>lesson.id===id)?'knowledge':'exercises',lesson:id});return;}
    if(name==='close-lesson')return go({page:'edit',id:state.editor.id,step:'content',chapter:state.route.chapter,kind:state.route.kind});
    if(name.startsWith('lesson-')){
      const chapter=course.chapters.find(c=>c.id===button.dataset.chapter),items=chapter?.[button.dataset.kind];if(!items)return;
      const index=items.findIndex(item=>item.id===id);if(index<0)return;
      if(name==='lesson-remove'){if(!await ask('Bỏ bài này khỏi khóa học?','Bỏ bài'))return;items.splice(index,1);}
      else{const next=index+(name==='lesson-up'?-1:1);if(next>=0&&next<items.length)[items[index],items[next]]=[items[next],items[index]];}
      markDirty();repaint();return;
    }
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
      if(!await ask('Đổi mẫu sẽ thay các câu hiện tại trong bộ bài này.','Đổi mẫu'))return;
      currentLesson().exercise=newCourseExercise(value);markDirty();repaint();return;
    }
    if(name==='add-question'){await collectEditor();const ex=currentLesson().exercise;for(let i=0;i<(ex.section.questionProfile.pairedQuestions?2:1);i++)ex.questions.push(newCourseQuestion(questionProfileAt(ex.section,ex.questions.length)));ex.section.questionIds=ex.questions.map(q=>q.id);ex.section.questionLimit=ex.questions.length;markDirty();repaint();return;}
    if(name==='add-pair'||name==='remove-pair'){
      await collectEditor();const q=currentLesson().exercise.questions.find(q=>q.id===button.dataset.q);if(!q)return;
      if(name==='add-pair')q.pairs.push(['','']);else q.pairs.splice(Number(button.dataset.index),1);markDirty();repaint();return;
    }
    if(name==='preview-exercise'){await saveEditor();state.preview=createCoursePreview(state.editor,state.editLesson);repaint();return;}
    if(name==='preview-course'){await saveEditor();state.preview=createCoursePreview(state.editor);repaint();return;}
    if(name==='publish'){
      await saveEditor();state.permalinkDraft=undefined;state.publicationBusy=true;repaint();
      try{Object.assign(state.editor,await api(coursePath(state.editor.id,'/publish'),{method:'POST',body:{version:state.editor.version}}));}
      catch(error){await load();throw error;}
      finally{state.publicationBusy=false;repaint();}
      return;
    }
    if(name==='unpublish'){const receipt=await api(coursePath(state.editor.id,'/unpublish'),{method:'POST',body:{version:state.editor.version}});Object.assign(state.editor,receipt);repaint();return;}
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
    // Keep native selection in the original user gesture (including Safari/iOS).
    if(button.dataset.coursePick){event.preventDefault();if(!busy&&!published()){knowledgeBinding?.release(state.knowledgeUpload?.point);state.knowledgeUpload=button.dataset.coursePick==='lesson'?{point:knowledgeBinding?.capture(),replaceId:button.hasAttribute('data-knowledge-replace')?knowledgeBinding?.selectedImage():null}:null;state.uploadButton=button;const input=root.querySelector(`[data-course-upload="${button.dataset.coursePick}"]`);if(input){input.multiple=button.dataset.coursePick==='lesson'&&!state.knowledgeUpload?.replaceId;input.click();}}return;}
    if(button.dataset.courseAction){event.preventDefault();void perform(button,()=>action(button.dataset.courseAction,button));return;}
    const editor=root.querySelector('[data-course-exercise-editor]');if(published()||!editor?.contains(button))return;
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
    if(state.preview){if(field.closest('.course-practice'))queuePractice();return;}
    if(field.hasAttribute('data-course-permalink-input')){state.permalinkDraft=field.value;return;}
    if(field.closest('[data-knowledge-editor]'))return;
    if(field.dataset.courseFilter){
      state.filters[field.dataset.courseFilter]=field.value;clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>{const active=root.ownerDocument.activeElement,id=active?.id,start=active?.selectionStart;void load().then(()=>{const next=id&&root.querySelector('#'+id);if(next){next.focus();if(start!=null&&next.setSelectionRange)next.setSelectionRange(start,start);}});},field.tagName==='SELECT'?0:300);return;
    }
    if(state.route.page==='edit'){
      if(readOnly())return;
      if(field.hasAttribute('data-course-tags')){state.editor.course.tags=field.value.split(',').map(tag=>tag.trim()).filter(Boolean);const suggestions=root.querySelector('#courseTagSuggestions');if(suggestions)suggestions.innerHTML=courseTagSuggestionsHtml(state.tagSuggestions||[],field.value);}
      if(field.dataset.courseField)state.editor.course[field.dataset.courseField]=field.type==='number'?Number(field.value):field.value;
      if(field.dataset.courseChapterTitle){const chapter=state.editor.course.chapters.find(c=>c.id===field.dataset.courseChapterTitle);if(chapter)chapter.title=field.value;}
      if(field.dataset.courseLessonField){const lesson=currentLesson();if(lesson)lesson[field.dataset.courseLessonField]=field.type==='checkbox'?field.checked:field.value;}
      if(root.querySelector('.course-authoring')?.contains(field))markDirty();
      if(field.dataset.courseField==='title'&&state.permalinkDraft===undefined)refreshPermalink();
      if(field.dataset.courseField==='level'){const badge=root.querySelector('.builder-meta .exam-level');if(badge){badge.dataset.level=field.value;badge.textContent=field.value;}}
    }
    if(field.closest('.course-practice'))queuePractice();
  };
  root.addEventListener('keydown',event=>{
    if(!event.target.hasAttribute('data-course-permalink-input')||!['Enter','Escape'].includes(event.key))return;
    event.preventDefault();root.querySelector(`[data-course-action="permalink-${event.key==='Enter'?'save':'cancel'}"]`)?.click();
  });
  root.addEventListener('input',input);root.addEventListener('change',input);
  async function uploadFiles(files,slot,button,options={}){
    const binding=knowledgeBinding;
    if(busy||!button||published()){binding?.release(options.point);return;}
    return perform(button,async()=>{
      const status=root.querySelector(`[data-course-upload-status="${slot}"]`);if(status)status.textContent='Đang tải ảnh…';
      const urls=[];let uploadError;
      try{
        files.forEach(file=>validateImageFile(file,COURSE_IMAGE_MAX_BYTES));
        if(slot==='lesson'&&(!binding||!options.replaceId&&blocks().length+files.length+1>MAX_KNOWLEDGE_BLOCKS))throw Error('Bài kiến thức chưa sẵn sàng hoặc vượt 100 khối nội dung.');
        await collectEditor();
        try{for(const file of files)urls.push(await uploadImage(file,{slot:'course-'+slot}));}catch(error){uploadError=error;}
        if(urls.length){
          if(slot==='cover'){state.editor.course.coverUrl=urls[0];markDirty();repaint();}
          else{if(binding!==knowledgeBinding)throw Error('Bài học đã đóng. Vui lòng mở lại để chèn ảnh.');binding.insertImages(urls,options);}
        }
        if(uploadError)throw uploadError;
        if(status?.isConnected)status.textContent='';
      }catch(error){const label=root.querySelector(`[data-course-upload-status="${slot}"]`);if(label)label.textContent=urls.length?`Đã thêm ${urls.length}/${files.length} ảnh. Chọn lại ảnh chưa tải được.`:'Chưa tải được ảnh. Chọn lại để thử.';throw error;}
    }).finally(()=>binding?.release(options.point));
  }
  root.addEventListener('change',event=>{
    const input=event.target;if(!input.dataset.courseUpload||!input.files?.[0])return;
    const slot=input.dataset.courseUpload,button=state.uploadButton?.isConnected?state.uploadButton:root.querySelector(`[data-course-pick="${slot}"]`),files=slot==='cover'||state.knowledgeUpload?.replaceId?[input.files[0]]:Array.from(input.files),options=state.knowledgeUpload||{};state.knowledgeUpload=null;
    void uploadFiles(files,slot,button,options).finally(()=>{input.value='';});
  });
  root.addEventListener('cancel',event=>{if(event.target.dataset.courseUpload){knowledgeBinding?.release(state.knowledgeUpload?.point);state.knowledgeUpload=null;}},true);
  return {mount,beforeLeave,isDirty:()=>state.dirty||state.practiceDirty||busy||Boolean(savingEditor),
    open:async route=>{if(await beforeLeave())navigate(route);},getState:()=>state,flushPractice,flushEditor:saveEditor};
}
