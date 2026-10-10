import {createGradeAutosave} from './ui/grade-autosave.js';
let gradeAutosave=null,gradePublishing=false;
window.addEventListener('beforeunload',event=>{if(gradeAutosave?.pending||gradePublishing){event.preventDefault();event.returnValue='';}});
import {createRepository} from './repository.js';
import {unansweredExamQuestions} from './views/student.js';
import {
  ATTEMPT_STATUS,byId,isMaster,isStudent,canEditExam,canGradeExam,
  createQuestion,updateQuestion,softDeleteQuestion,restoreQuestion,permanentlyDeleteQuestion,
  updateExam,duplicateExam,detachLockedDraftQuestions,softDeleteExam,restoreExam,permanentlyDeleteExam,
  addSection,removeSection,moveSection,updateSection,addQuestionsToSection,
  removeQuestionFromSection,moveQuestion,
  startAttempt,saveAnswer,setAttemptSection,getSectionRemainingSeconds,submitAttempt,abandonAttempt,
  saveManualScore,publishAttempt,publishExam
} from './core.js';
import {uploadQuestionAudio,uploadQuestionImage} from './media.js';
import {countWords} from './ui/format.js';
import {topbarHtml} from './ui/layout.js';
import {classesHtml,bindClasses,openStudentProfile} from './views/classes.js';
import {openClassEnrollment} from './views/class-enrollment.js';
import {openExamAccess,openCodeEntry,showPromotion} from './views/exam-access.js';
import {gradebookHtml,bindGradebook} from './views/gradebook.js';
import {confirmAction} from './ui/confirm.js';
import {
  loginHtml,studentHomeHtml,studentResultsHtml,studentAttemptDetailHtml,examHtml,submittedHtml,expiredHtml,answerPresent
} from './views/student.js';
import {
  adminShellHtml,dashboardHtml,examAdminHtml,
  teachersAdminHtml,trashAdminHtml
} from './views/admin.js';
import {examBuilderHtml,gradingDetailHtml} from './views/builder.js';
import {
  questionModalHtml,previewExamModalHtml,previewQuestionModalHtml,
  studentGradeModalHtml
} from './views/modals.js';
import {getProviderLevels} from './exam-specs/index.js';
import {createExamDraft,ensureExamMatchesConfiguredSpec,questionDraftChoices} from './controllers/exam-factory.js';
import {populateGoetheA1TestFixture} from './controllers/goethe-a1-test-fixture.js';
import {hasPartTemplate,openPartTemplate,bindPartBuilder} from './part-templates/index.js';
import {templateRequest} from './part-templates/shared/api.js';
import {initializeTheme} from './settings/theme.js';
import {loadPublicSettings,refreshInfrastructure} from './settings/api.js';
import {isScoredWritingField,writingFormScore,addWritingRow,removeWritingRow} from './domain/writing-form.js';
import {readWritingRow} from './ui/writing-form.js';
import {readExamAnswers,revealUnansweredQuestion} from './ui/exam-answers.js';

initializeTheme();
const app=document.getElementById('app');
const toast=document.getElementById('toast');
const repo=await createRepository();
let data=await repo.getState();
let user=await repo.getCurrentUser();
let authenticatedUser=user;
let timerHandle=null;
let timerBusy=false;
let submitBusy=false;
let realtimeRenderTimer=null;
let builderAutosaveTimer=null;
let builderAutosaveBusy=false;
let builderAutosaveQueued=false;
let builderSavePromise=null;
let builderEditRevision=0;
let infrastructureLoading=false;
const saveTimers=new Map();
const pendingAudioUploads=new Map();

const ui={
  view:user?(isStudent(user)?'student-home':'admin'):'login',
  adminTab:isMaster(user)?'dashboard':'exams',examId:null,attemptId:null,builderExamId:null,builderSectionId:null,
  gradeAttemptId:null,gradeMode:'best',examFilter:'all',review:null,previewExamId:null,previewSectionIndex:0,previewAnswers:{},infrastructure:null,online:navigator.onLine,
};

repo.subscribe(next=>{
  data=next;
  if(ui.view==='exam'&&byId(next.attempts,ui.attemptId)?.status!==ATTEMPT_STATUS.IN_PROGRESS){
    ui.view='student-home';
    clearTimeout(realtimeRenderTimer);
    realtimeRenderTimer=setTimeout(()=>render(),80);
    return;
  }
  if(['exam','preview-exam','builder','grading-detail'].includes(ui.view)||document.getElementById('modal')||document.querySelector('.g2g-settings-page')||document.querySelector('[data-name-form]:not([hidden])')||document.activeElement?.matches('[data-student-search]'))return;
  clearTimeout(realtimeRenderTimer);
  realtimeRenderTimer=setTimeout(()=>render(),80);
});
window.addEventListener('online',()=>{ui.online=true;if(ui.view!=='exam')render();});
window.addEventListener('offline',()=>{ui.online=false;if(ui.view!=='exam')render();});

function layout(content){
  return topbarHtml({user,mode:repo.mode,online:ui.online,ui,canSwitchRole:Boolean(authenticatedUser?.canTestRoles||isMaster(authenticatedUser))})+content;
}

function notify(msg){
  toast.textContent=msg;
  toast.classList.remove('an');
  clearTimeout(notify.t);
  notify.t=setTimeout(()=>toast.classList.add('an'),2700);
}

function clearTimer(){
  if(timerHandle){clearInterval(timerHandle);timerHandle=null;}
  timerBusy=false;
}

function stopActiveAudio(){
  app.querySelectorAll('audio').forEach(audio=>{
    audio.onpause=null;audio.onended=null;audio.onerror=null;
    try{audio.pause();audio.currentTime=0;}catch{}
  });
}

function syncViewUrl(){
  if(!user)return;
  const url=new URL(window.location.href);
  for(const key of ['edit','preview','section','view','tab','attempt'])url.searchParams.delete(key);
  if(ui.view==='builder'&&ui.builderExamId)url.searchParams.set('edit',ui.builderExamId);
  else if(ui.view==='preview-exam'&&ui.previewExamId){url.searchParams.set('preview',ui.previewExamId);url.searchParams.set('section',String(ui.previewSectionIndex||0));}
  else if(ui.view==='grading-detail'&&ui.gradeAttemptId){url.searchParams.set('view','grading');url.searchParams.set('attempt',ui.gradeAttemptId);}
  else if(ui.view==='exam'&&ui.attemptId){url.searchParams.set('view','exam');url.searchParams.set('attempt',ui.attemptId);}
  else if(ui.view==='student-results')url.searchParams.set('view','results');
  else if(ui.view==='student-attempt-detail')url.searchParams.set('view','results');
  else if(ui.view==='admin')url.searchParams.set('tab',ui.adminTab);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}

async function act(fn,success,{rerender=true}={}){
  try{
    const result=await fn();
    data=await repo.getState();
    if(success)notify(success);
    if(rerender)render();
    return result;
  }catch(error){
    console.error(error);
    notify(error?.message||'Có lỗi xảy ra.');
    return null;
  }
}

function loginView(){
  app.innerHTML=loginHtml({mode:repo.mode});
  if(repo.mode==='local'){
    const exams=data.exams.filter(ex=>ex.status==='published');
    const types=[...new Set(exams.map(ex=>[ex.provider,ex.level].filter(Boolean).join(' ')))].filter(Boolean);
    document.getElementById('landingTypes').innerHTML=types.map(type=>`<span>${type.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</span>`).join('');
    document.getElementById('landingMetrics').innerHTML=[['Học viên',data.users.filter(u=>u.role==='student').length],['Bài thi đã chấm',data.attempts.filter(a=>a.status==='published').length],['Bộ đề',exams.length]].map(([label,count])=>`<div><b>${count}</b><span>${label}</span></div>`).join('');
  }
  if(repo.mode!=='local')loadPublicSettings().then(publicData=>{
    const types=document.getElementById('landingTypes'),metrics=document.getElementById('landingMetrics');
    if(types)types.innerHTML=(publicData.stats?.examTypes||[]).map(type=>`<span>${String(type).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</span>`).join('')||'<span>Đang cập nhật bộ đề</span>';
    if(metrics)metrics.innerHTML=[['students','Học viên'],['graded','Bài thi đã chấm'],['exams','Bộ đề']].map(([key,label])=>`<div><b>${Number(publicData.stats?.[key]||0).toLocaleString('vi-VN')}</b><span>${label}</span></div>`).join('');
  }).catch(()=>{const types=document.getElementById('landingTypes');if(types)types.textContent='Chưa tải được danh sách đề.';});
  document.getElementById('googleLogin').onclick=async()=>{
    if(repo.mode==='local'){
      notify('Đây là bản demo cục bộ. Đăng nhập Google chỉ hoạt động trên máy chủ G2G.');
      return;
    }
    try{
      user=await repo.signInGoogle();
      authenticatedUser=user;
      data=await repo.getState();
      ui.view=isStudent(user)?'student-home':'admin';
      render();
    }catch(error){
      notify(error?.message||'Không đăng nhập được bằng Google.');
    }
  };
  app.querySelectorAll('.demo-login').forEach(button=>button.onclick=async()=>{
    user=await repo.signInDemo(button.dataset.id);
    authenticatedUser=user;
    data=await repo.getState();
    ui.view=isStudent(user)?'student-home':'admin';
    render();
  });
}

function studentHomeView(){app.innerHTML=layout(studentHomeHtml({data,user,filter:ui.examFilter,levelFilter:ui.examLevelFilter}));}
function studentResultsView(){app.innerHTML=layout(studentResultsHtml({data,user}));}
function submittedView(){app.innerHTML=layout(submittedHtml(byId(data.attempts,ui.attemptId)));}

function examView(){
  clearTimer();
  const attempt=byId(data.attempts,ui.attemptId);
  if(!attempt||attempt.studentId!==user.id||attempt.status!==ATTEMPT_STATUS.IN_PROGRESS){ui.view='student-home';render();return;}
  const exam=byId(data.exams,attempt.examId);
  if(!exam){ui.view='student-home';render();return;}
  const sectionIndex=Math.min(attempt.currentSectionIndex||0,Math.max(0,exam.sections.length-1));
  const section=exam.sections[sectionIndex];
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  app.innerHTML=examHtml({attempt,exam,sectionIndex,questions,allQuestions:data.questions,online:ui.online});
  const examBrandIcon=app.querySelector('.exam-mobile-brand img');if(examBrandIcon)examBrandIcon.onerror=()=>examBrandIcon.remove();
  bindExamInputs(attempt,questions);
  bindSectionAudio(attempt,{preview:false});
  startExamTimer(attempt,exam,sectionIndex);
}

function previewExamView(){
  clearTimer();
  const exam=byId(data.exams,ui.previewExamId);
  if(!exam||isStudent(user)){ui.view='admin';render();return;}
  const sectionIndex=Math.min(ui.previewSectionIndex||0,Math.max(0,exam.sections.length-1));
  const section=exam.sections[sectionIndex];
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  const attempt={id:`preview-${exam.id}`,answers:ui.previewAnswers};
  const previewSummary=previewSummaryFor(exam);
  app.innerHTML=examHtml({attempt,exam,sectionIndex,questions,allQuestions:data.questions,online:ui.online,preview:true,previewSummary});
  bindPreviewInputs(attempt,questions);
  bindSectionAudio(attempt,{preview:true});
}

function previewSummaryFor(exam){
  const sections=(exam.sections||[]).map(item=>{
    const items=(item.questionIds||[]).map(id=>byId(data.questions,id)).filter(question=>question&&!question.example);
    return {name:item.name,total:items.length,answered:items.filter(question=>answerPresent(ui.previewAnswers[question.id],question)).length};
  });
  return {sections,total:sections.reduce((sum,item)=>sum+item.total,0),answered:sections.reduce((sum,item)=>sum+item.answered,0)};
}

function showPreviewSection(index){
  const exam=byId(data.exams,ui.previewExamId);
  if(!exam)return;
  ui.previewSectionIndex=Math.max(0,Math.min(index,exam.sections.length-1));
  render();
  document.getElementById('preview-section-title')?.focus({preventScroll:true});
  window.scrollTo(0,0);
}

function refreshPreviewProgress(){
  const exam=byId(data.exams,ui.previewExamId);
  if(!exam)return;
  const summary=previewSummaryFor(exam),section=summary.sections[ui.previewSectionIndex]||{answered:0,total:0};
  app.querySelectorAll('[data-preview-total]').forEach(item=>{item.textContent=`${summary.answered}/${summary.total} câu`;});
  app.querySelectorAll('[data-preview-current]').forEach(item=>{item.textContent=`${section.answered}/${section.total} câu đã trả lời`;});
  app.querySelector('[data-preview-progress]')?.style.setProperty('width',`${summary.total?Math.round((summary.answered/summary.total)*100):0}%`);
  summary.sections.forEach((item,index)=>{
    const label=app.querySelector(`[data-preview-section-progress="${index}"]`);
    if(label)label.textContent=`${item.name} · ${item.answered}/${item.total} câu`;
  });
  app.querySelectorAll('.cau-thi[data-q]').forEach(card=>{
    const question=byId(data.questions,card.dataset.q);
    if(question)card.classList.toggle('is-answered',answerPresent(ui.previewAnswers[question.id],question));
  });
}

function bindExamInputs(attempt,questions){
  app.querySelectorAll('audio').forEach(audio=>{
    audio.addEventListener('play',()=>{audio.dataset.audioBusy='true';});
    for(const event of ['ended','error'])audio.addEventListener(event,()=>{delete audio.dataset.audioBusy;});
  });
  const setLocalAnswer=(qid,value)=>{
    attempt.answers={...(attempt.answers||{}),[qid]:value};
    const required=questions.filter(question=>!question.example),answered=required.filter(question=>answerPresent(attempt.answers[question.id],question)).length;
    app.querySelectorAll('[data-current-answer-count]').forEach(item=>{item.textContent=`${answered}/${required.length}`;});
    const question=questions.find(item=>item.id===qid),card=app.querySelector(`.cau-thi[data-q="${qid}"]`);
    if(card&&question)card.classList.toggle('is-answered',answerPresent(value,question));
  };
  app.querySelectorAll('.answer-one').forEach(el=>el.onchange=()=>{
    const value=el.value===''?null:Number(el.value);
    setLocalAnswer(el.dataset.q,value);
    queueAnswer(attempt.id,el.dataset.q,value,0);
  });
  app.querySelectorAll('.answer-match').forEach(el=>el.onchange=()=>{
    const qid=el.dataset.q,q=questions.find(x=>x.id===qid),values=Array(q?.pairs?.length||0).fill('');
    app.querySelectorAll(`.answer-match[data-q="${qid}"]`).forEach(x=>values[Number(x.dataset.i)]=x.value);
    setLocalAnswer(qid,values);
    queueAnswer(attempt.id,qid,values,0);
  });
  app.querySelectorAll('.answer-text').forEach(el=>{
    el.oninput=()=>{
      const counter=el.parentElement?.querySelector('.word-count');
      if(counter)counter.textContent=countWords(el.value);
      setLocalAnswer(el.dataset.q,el.value);
      queueAnswer(attempt.id,el.dataset.q,el.value,700);
    };
    el.onblur=()=>queueAnswer(attempt.id,el.dataset.q,el.value,0);
  });
  app.querySelectorAll('.answer-form-field').forEach(el=>{const save=()=>{
    const qid=el.dataset.q,values={};
    app.querySelectorAll(`.answer-form-field[data-q="${qid}"]`).forEach(field=>{if(field.type!=='radio'||field.checked)values[field.dataset.fieldIndex]=field.value;});
    setLocalAnswer(qid,values);queueAnswer(attempt.id,qid,values,0);
  };el.onchange=save;if(el.type!=='radio')el.oninput=save;});
  app.querySelectorAll('.play-audio').forEach(btn=>btn.onclick=async()=>{
    const qid=btn.dataset.q,key=`g2g.audio.${attempt.id}.${qid}`,audio=document.getElementById(`audio-${qid}`);
    if(!audio||sessionStorage.getItem(key))return;
    try{
      sessionStorage.setItem(key,'1');
      btn.disabled=true;
      btn.textContent='Audio';
      audio.addEventListener('ended',()=>{btn.textContent='Audio abgespielt';},{once:true});
      audio.addEventListener('seeking',()=>{if(audio.currentTime>0.5)audio.currentTime=Math.max(0,audio.currentTime-0.25);});
      await audio.play();
    }catch(error){
      sessionStorage.removeItem(key);
      btn.disabled=false;
      btn.textContent='Audio abspielen';
      notify('Das Audio konnte nicht abgespielt werden. Bitte prüfen Sie Ihre Verbindung oder die Audiodatei.');
    }
  });
}

function bindPreviewInputs(attempt,questions){
  app.querySelectorAll('.answer-one').forEach(el=>el.onchange=()=>{ui.previewAnswers[el.dataset.q]=el.value===''?null:Number(el.value);refreshPreviewProgress();});
  app.querySelectorAll('.answer-match').forEach(el=>el.onchange=()=>{
    const qid=el.dataset.q,q=questions.find(x=>x.id===qid),values=Array(q?.pairs?.length||0).fill('');
    app.querySelectorAll(`.answer-match[data-q="${qid}"]`).forEach(x=>values[Number(x.dataset.i)]=x.value);
    ui.previewAnswers[qid]=values;refreshPreviewProgress();
  });
  app.querySelectorAll('.answer-text').forEach(el=>el.oninput=()=>{
    const counter=el.parentElement?.querySelector('.word-count');
    if(counter)counter.textContent=countWords(el.value);
    ui.previewAnswers[el.dataset.q]=el.value;refreshPreviewProgress();
  });
  app.querySelectorAll('.answer-form-field').forEach(el=>{const save=()=>{
    const qid=el.dataset.q,values={};
    app.querySelectorAll(`.answer-form-field[data-q="${qid}"]`).forEach(field=>{if(field.type!=='radio'||field.checked)values[field.dataset.fieldIndex]=field.value;});
    ui.previewAnswers[qid]=values;refreshPreviewProgress();
  };el.onchange=save;if(el.type!=='radio')el.oninput=save;});
  app.querySelectorAll('.play-audio').forEach(btn=>btn.onclick=async()=>{
    const qid=btn.dataset.q,key=`g2g.audio.${attempt.id}.${qid}`,audio=document.getElementById(`audio-${qid}`);
    if(!audio||sessionStorage.getItem(key))return;
    try{sessionStorage.setItem(key,'1');btn.disabled=true;btn.textContent='Audio';audio.addEventListener('ended',()=>{btn.textContent='Audio abgespielt';},{once:true});await audio.play();}
    catch{sessionStorage.removeItem(key);btn.disabled=false;btn.textContent='Audio abspielen';notify('Dieses Audio konnte nicht abgespielt werden.');}
  });
}

function examAudioPlaying(){
  return Boolean(app.querySelector('[data-audio-busy="true"]'))||[...app.querySelectorAll('audio')].some(audio=>!audio.paused&&!audio.ended);
}
function guardExamAudio(){
  if(ui.view!=='exam'||!examAudioPlaying())return false;
  notify('Bitte hören Sie das Audio bis zum Ende an.');
  return true;
}
function bindSectionAudio(attempt,{preview}){
  const root=app.querySelector('[data-section-audio]');if(!root)return;
  const button=root.querySelector('.section-audio-play'),status=root.querySelector('.section-audio-status');
  const progress=root.querySelector('.section-audio-progress'),progressFill=progress?.querySelector('i');
  const audios=[...root.querySelectorAll('.section-audio-segment')];
  if(!button||!audios.length)return;
  const setProgress=value=>{
    const percent=Math.max(0,Math.min(100,Number(value)||0));
    if(progressFill)progressFill.style.width=`${percent}%`;
    progress?.setAttribute('aria-valuenow',String(Math.round(percent)));
  };
  button.onclick=async()=>{
    if(button.disabled)return;
    button.disabled=true;
    if(!preview)root.dataset.audioBusy='true';
    let locked=false;
    try{
      const durations=await Promise.all(audios.map(readAudioDuration));
      const repeats=audios.map(audio=>Math.max(1,Number(audio.dataset.repeat)||1));
      const totalDuration=durations.reduce((sum,duration,index)=>sum+duration*repeats[index],0);
      if(!preview){
        await templateRequest('/actions/startPartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:root.dataset.sectionAudio}});
      }
      locked=true;
      if(!preview)sessionStorage.setItem(root.dataset.storageKey,'1');
      progress.hidden=false;root.classList.add('is-playing');
      let completedDuration=0;
      for(let index=0;index<audios.length;index++)for(let turn=0;turn<repeats[index];turn++){
        const label=audios[index].dataset.label||`Aufgabe ${index+1}`,segmentRepeat=repeats[index];
        status.textContent=`${label}${segmentRepeat>1?` · ${turn+1}/${segmentRepeat}`:''}`;
        await playSectionSegment(audios[index],currentTime=>setProgress((completedDuration+currentTime)/totalDuration*100));
        completedDuration+=durations[index];setProgress(completedDuration/totalDuration*100);
      }
      if(!preview)await templateRequest('/actions/completePartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:root.dataset.sectionAudio}});
      root.classList.remove('is-playing');progress.hidden=true;
      setProgress(100);status.textContent='Audio wurde bereits abgespielt';
    }catch(error){
      if(!locked){sessionStorage.removeItem(root.dataset.storageKey);button.disabled=false;}
      root.classList.remove('is-playing');progress.hidden=true;
      status.textContent=locked&&!preview?'Audio wurde bereits abgespielt':'Audio konnte nicht geladen werden';
      notify(error?.message||'Das Audio konnte nicht abgespielt werden.');
    }finally{delete root.dataset.audioBusy;}
  };
}

function readAudioDuration(audio){
  if(Number.isFinite(audio.duration)&&audio.duration>0)return Promise.resolve(audio.duration);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);};
    const ready=()=>{if(!Number.isFinite(audio.duration)||audio.duration<=0)return failed();cleanup();resolve(audio.duration);};
    const failed=()=>{cleanup();reject(new Error('Die Audiodauer konnte nicht ermittelt werden.'));};
    audio.addEventListener('loadedmetadata',ready,{once:true});audio.addEventListener('error',failed,{once:true});audio.load();
  });
}

function playSectionSegment(audio,onProgress){
  return new Promise((resolve,reject)=>{
    let active=true,frame=0;
    const tick=()=>{if(!active)return;onProgress(audio.currentTime);frame=requestAnimationFrame(tick);};
    const cleanup=()=>{active=false;if(frame)cancelAnimationFrame(frame);audio.onended=null;audio.onerror=null;audio.onpause=null;};
    audio.controls=false;audio.currentTime=0;
    audio.onpause=()=>{if(active&&!audio.ended)setTimeout(()=>audio.play().catch(reject),0);};
    audio.onended=()=>{onProgress(audio.duration);cleanup();resolve();};
    audio.onerror=()=>{cleanup();reject(new Error('Không phát được một audio trong phần.'));};
    audio.play().then(tick).catch(error=>{cleanup();reject(error);});
  });
}

function queueAnswer(attemptId,qid,value,delay){
  const key=`${attemptId}:${qid}`;
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key,setTimeout(async()=>{
    await act(()=>repo.transaction(st=>saveAnswer(st,user,attemptId,qid,value)),null,{rerender:false});
    saveTimers.delete(key);
  },delay));
}

async function flushTextAnswers(){
  const pending=[...saveTimers.values()];
  for(const timer of pending)clearTimeout(timer);
  saveTimers.clear();
  const answers=readExamAnswers(app),attemptId=ui.attemptId;
  if(!attemptId||!Object.keys(answers).length)return true;
  return Boolean(await act(()=>repo.transaction(st=>{
    for(const [qid,value] of Object.entries(answers))saveAnswer(st,user,attemptId,qid,value);
    return true;
  }),null,{rerender:false}));
}

function startExamTimer(attempt,exam,sectionIndex){
  const section=exam.sections[sectionIndex],el=document.getElementById('examTimer'),summary=document.getElementById('examTimeSummary');
  const tick=async()=>{
    const left=getSectionRemainingSeconds(attempt,exam,sectionIndex);
    const display=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
    if(el)el.textContent=display;
    if(summary)summary.textContent=display;
    const mainTime=document.getElementById('examMainTime');if(mainTime)mainTime.textContent=display;
    if(left<=0&&!timerBusy){
      clearTimer();
      timerBusy=true;
      stopActiveAudio();
      document.querySelector('[data-confirm-cancel]')?.click();
      document.querySelectorAll('.answer-one,.answer-match,.answer-text,.play-audio').forEach(x=>x.disabled=true);
      for(const pending of saveTimers.values())clearTimeout(pending);
      saveTimers.clear();
      const result=await act(()=>repo.mode==='api'?repo.submitAttemptSecure(attempt.id):repo.transaction(st=>submitAttempt(st,user,attempt.id)),null,{rerender:false});
      if(result){
        data=await repo.getState();ui.view='submitted';render();
        const modal=document.createElement('div');modal.className='hop-chon';
        modal.innerHTML='<div class="noi-hop ket-qua-cho" role="dialog" aria-modal="true" aria-labelledby="timeoutTitle"><div class="vong">⌛</div><h2 id="timeoutTitle">Die Prüfungszeit ist abgelaufen</h2><p>Leider ist die Zeit um. Ihre gespeicherten Antworten wurden automatisch abgegeben.</p><button class="nut chinh" data-close>Ergebnisübersicht</button></div>';
        document.body.append(modal);modal.querySelector('button').focus();modal.querySelector('[data-close]').onclick=()=>modal.remove();
      }else{timerBusy=false;timerHandle=setInterval(tick,5000);}
    }
  };
  timerHandle=setInterval(tick,1000);
  tick();
}

async function submitCurrentExam(confirmed=false){
  if(guardExamAudio())return;
  if(submitBusy)return;
  if(!confirmed){
    const attempt=byId(data.attempts,ui.attemptId),exam=attempt&&byId(data.exams,attempt.examId);
    if(!attempt||!exam)return;
    const missing=unansweredExamQuestions(exam,data.questions,{...attempt.answers,...readExamAnswers(app)});
    confirmAction(missing.length?`Noch nicht vollständig beantwortete Aufgaben: ${missing.map(item=>item.number).join(', ')}. Möchten Sie trotzdem abgeben?`:'Möchten Sie die Prüfung jetzt abgeben?',()=>submitCurrentExam(true),{confirmLabel:'Prüfung abgeben',cancelLabel:'Weiterarbeiten'});
    return;
  }
  submitBusy=true;
  try{
    if(!await flushTextAnswers())return;
    const result=await act(()=>repo.transaction(st=>submitAttempt(st,user,ui.attemptId)),null,{rerender:false});
    if(result){data=await repo.getState();ui.view='submitted';render();}
  }finally{submitBusy=false;}
}

function adminView(){
  if(ui.adminTab==='grading')ui.adminTab='grades';
  if(isMaster(user)&&['grading','grades'].includes(ui.adminTab))ui.adminTab='dashboard';
  let content='';
  if(ui.adminTab==='dashboard'&&isMaster(user)){
    content=dashboardHtml({data,infrastructure:ui.infrastructure});
    if(!ui.infrastructure&&!infrastructureLoading){
      infrastructureLoading=true;
      refreshInfrastructure().then(result=>{ui.infrastructure=result;if(ui.view==='admin'&&ui.adminTab==='dashboard')render();}).catch(error=>notify(error.message||'Không tải được thông tin hạ tầng.')).finally(()=>{infrastructureLoading=false;});
    }
  }
  else if(ui.adminTab==='exams')content=examAdminHtml({data,user,filters:ui.adminExamFilters});
  else if(ui.adminTab==='grades')content=gradebookHtml({data,ui});
  else if(ui.adminTab==='teachers')content=teachersAdminHtml({data,user});
  else if(ui.adminTab==='classes')content=classesHtml({data,classId:ui.classId});
  else if(ui.adminTab==='trash')content=trashAdminHtml({data});
  app.innerHTML=layout(adminShellHtml({content,user,ui}));
}

function examBuilderView(){
  const exam=byId(data.exams,ui.builderExamId);
  if(!exam||isStudent(user)){ui.view='admin';render();return;}
  const section=exam.sections.find(s=>s.id===ui.builderSectionId)||exam.sections[0];
  if(section)ui.builderSectionId=section.id;
  const readOnly=!canEditExam(user,exam);
  app.innerHTML=layout(examBuilderHtml({data,user,exam,section,readOnly}));
}

function gradingDetailView(){
  const attempt=byId(data.attempts,ui.gradeAttemptId),exam=attempt&&byId(data.exams,attempt.examId);
  if(!attempt||!exam||isMaster(user)||!canGradeExam(data,user,exam)){ui.view='admin';ui.adminTab=isMaster(user)?'dashboard':'grades';render();return;}
  app.innerHTML=layout(gradingDetailHtml({data,user,attempt,exam}));
  bindGradeCalculator(attempt);
}

function bindGradeCalculator(attempt){
  app.querySelectorAll('.manual-score,#gradeOralScore').forEach(input=>input.oninput=()=>{
    let total=Number(attempt.autoScore)||0;
    app.querySelectorAll('.manual-score').forEach(x=>total+=Number(x.value)||0);
    total+=Number(document.getElementById('gradeOralScore')?.value||0);
    document.getElementById('gradeTotal').textContent=total;
  });
}

function questionModal(q=null,onCreated=null){
  const edit=Boolean(q);
  app.insertAdjacentHTML('beforeend',questionModalHtml(q));
  const profileFields=['qLevel','qSkill','qPart'].map(id=>document.getElementById(id));
  const firstLabel=profileFields[0]?.previousElementSibling;
  if(firstLabel&&profileFields.every(Boolean)){
    const row=document.createElement('div');
    row.className='question-profile-row';
    firstLabel.before(row);
    profileFields.forEach(field=>{
      const label=field.previousElementSibling;
      const cell=document.createElement('label');
      cell.className='question-profile-field';
      cell.textContent=label.textContent;
      cell.append(field);
      label.remove();
      row.append(cell);
    });
  }
  const sync=()=>{
    const type=document.getElementById('qType').value;
    document.getElementById('choiceFields').style.display=type==='matching'||type==='writing'||type==='speaking'?'none':'';
    document.getElementById('matchingFields').style.display=type==='matching'?'':'none';
    if(type==='truefalse')document.getElementById('qChoices').value='Richtig\nFalsch';
  };
  document.getElementById('qType').onchange=sync;
  sync();
  bindModalClose();
  document.getElementById('saveQuestion').onclick=async()=>{
    const btn=document.getElementById('saveQuestion');
    btn.disabled=true;
    try{
      const type=document.getElementById('qType').value;
      let choices=document.getElementById('qChoices').value.split('\n').map(x=>x.trim()).filter(Boolean),pairs=[];
      if(type==='truefalse')choices=['Richtig','Falsch'];
      if(type==='matching')pairs=document.getElementById('qPairs').value.split('\n').map(x=>x.split('|').map(y=>y.trim())).filter(x=>x.length>=2&&x[0]&&x[1]).map(x=>[x[0],x.slice(1).join(' | ')]);
      let audioUrl=document.getElementById('qAudioUrl').value.trim();
      const file=document.getElementById('qAudioFile').files?.[0];
      if(file){
        document.getElementById('uploadState').textContent='Đang tải audio...';
        audioUrl=await uploadQuestionAudio(file,user.id,q?.id||'draft');
        document.getElementById('uploadState').textContent='Đã tải audio.';
      }
      const score=Number(document.getElementById('qScore').value)||0;
      const input={
        level:document.getElementById('qLevel').value,
        skill:document.getElementById('qSkill').value,
        part:document.getElementById('qPart').value,
        type,
        title:document.getElementById('qTitle').value,
        instruction:document.getElementById('qInstruction').value,
        prompt:document.getElementById('qPrompt').value,
        choices,pairs,
        correctAnswer:['single','cloze','truefalse'].includes(type)?Math.max(0,(Number(document.getElementById('qCorrect').value)||1)-1):null,
        maxScore:score,
        autoGrade:!['writing','speaking'].includes(type),
        audioUrl,
        rubric:type==='writing'
          ? [{id:'task',label:'Hoàn thành yêu cầu',max:Math.round(score/3)},{id:'structure',label:'Tổ chức và diễn đạt',max:Math.round(score/3)},{id:'language',label:'Ngữ pháp và chính tả',max:score-2*Math.round(score/3)}]
          : type==='speaking'
            ? [{id:'content',label:'Nội dung',max:Math.round(score/3)},{id:'fluency',label:'Độ trôi chảy',max:Math.round(score/3)},{id:'language',label:'Ngôn ngữ',max:score-2*Math.round(score/3)}]
            : []
      };
      const result=await act(()=>repo.transaction(st=>edit?updateQuestion(st,user,q.id,input):createQuestion(st,user,input)),edit?'Đã cập nhật câu hỏi.':'Đã tạo câu hỏi.',{rerender:false});
      if(result){
        closeModal();
        data=await repo.getState();
        if(onCreated)await onCreated(result);
        render();
      }
    }finally{
      if(document.getElementById('saveQuestion'))document.getElementById('saveQuestion').disabled=false;
    }
  };
}

function previewExamModal(ex){app.insertAdjacentHTML('beforeend',previewExamModalHtml(ex,data.questions));bindModalClose();}
function previewQuestionModal(q){app.insertAdjacentHTML('beforeend',previewQuestionModalHtml(q));bindModalClose();}
function studentGradeModal(studentId){app.insertAdjacentHTML('beforeend',studentGradeModalHtml({data,studentId}));bindModalClose();}
function closeModal(){document.getElementById('modal')?.remove();}
function bindModalClose(){app.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);}

function render(){
  clearTimer();
  stopActiveAudio();
  if(!user){ui.view='login';loginView();return;}
  syncViewUrl();
  if(ui.view==='student-home')studentHomeView();
  else if(ui.view==='student-results')studentResultsView();
  else if(ui.view==='student-attempt-detail')app.innerHTML=layout(studentAttemptDetailHtml({review:ui.review}));
  else if(ui.view==='exam')examView();
  else if(ui.view==='preview-exam')previewExamView();
  else if(ui.view==='submitted')submittedView();
  else if(ui.view==='expired')app.innerHTML=layout(expiredHtml());
  else if(ui.view==='builder')examBuilderView();
  else if(ui.view==='grading-detail')gradingDetailView();
  else adminView();
  bindGlobal();
  bindViewSpecific();
  const profileSaved=async()=>{data=await repo.getState();const fresh=data.users.find(item=>item.id===user.id);if(fresh)user={...user,...fresh,role:user.role};render();};
  if(!isStudent(user)){
    bindClasses(app,{data,repo,onSaved:profileSaved,onClassOpen:id=>{ui.classId=id;render();window.scrollTo(0,0);}});
    bindGradebook(app,{data,repo,ui,onSaved:profileSaved,render});
  }
  app.querySelector('[data-action="class-enrollment"]')?.addEventListener('click',()=>openClassEnrollment({repo,user,onSaved:profileSaved}));
  bindStudentName(app,{repo,user,onSaved:profileSaved});
  if(isStudent(user)&&!user.canTestRoles&&!user.profileCompletedAt&&!document.getElementById('modal'))openStudentProfile({data,repo,student:user,onSaved:profileSaved,required:true});
  else if(isStudent(user)&&['student-home','student-results','student-attempt-detail','submitted'].includes(ui.view)&&data.promotions?.length&&!document.getElementById('modal'))showPromotion({repo,promotion:data.promotions[0],onSaved:profileSaved});
}

async function saveBuilderDraft({silent=false}={}){
  clearTimeout(builderAutosaveTimer);
  while(builderSavePromise)await builderSavePromise;
  builderSavePromise=persistBuilderDraft({silent});
  try{return await builderSavePromise;}
  finally{builderSavePromise=null;}
}

function setBuilderSaveStatus(state,text){
  const status=app.querySelector('[data-builder-save-status]');
  if(status){status.dataset.state=state;status.hidden=state==='saved';status.textContent=state==='saved'?'':text;}
}

async function flushBuilderDraft(){
  if(gradePublishing)return false;
  if(ui.view==='grading-detail'&&gradeAutosave&&!await gradeAutosave.flush())return false;
  if(ui.view!=='builder'||document.getElementById('examTitle')?.disabled)return true;
  let revision;
  do{
    revision=builderEditRevision;
    if(!await saveBuilderDraft({silent:true}))return false;
  }while(revision!==builderEditRevision);
  return true;
}

async function persistBuilderDraft({silent=false}={}){
  const exam=byId(data.exams,ui.builderExamId),title=document.getElementById('examTitle')?.value.trim();
  const section=exam?.sections.find(item=>item.id===ui.builderSectionId);
  if(!exam||!title){setBuilderSaveStatus('error','Nhập tên đề để lưu');return false;}
  const revision=builderEditRevision;
  setBuilderSaveStatus('saving','Đang lưu…');
  const uploadedInputs=[];
  try{
    const audioUrls=new Map(),audioNames=new Map(),choiceImageUrls=new Map(),questionInstructionImageUrls=new Map(),questionCardImageUrls=new Map(),rubricImageUrls=new Map();
    let sectionImageUrl;
    if(section&&app.querySelector('.part-question[data-question-id]')){
      for(const card of app.querySelectorAll('.part-question[data-question-id]')){
        const uploaded=pendingAudioUploads.get(card.dataset.questionId);
        if(!uploaded)continue;
        const {url,name}=await uploaded.promise;
        audioUrls.set(card.dataset.questionId,url);
        audioNames.set(card.dataset.questionId,name);
      }
      for(const card of app.querySelectorAll('.part-question[data-question-id]')){
        const questionId=card.dataset.questionId;
        for(const input of card.querySelectorAll('[data-choice-image]')){
          const file=input.files?.[0];
          if(!file)continue;
          choiceImageUrls.set(`${questionId}:${input.dataset.choiceImage}`,await uploadQuestionImage(file));
          uploadedInputs.push(input);
        }
        for(const input of card.querySelectorAll('[data-question-instruction-image]')){
          const file=input.files?.[0];
          if(!file)continue;
          questionInstructionImageUrls.set(`${questionId}:${input.dataset.questionInstructionImage}`,await uploadQuestionImage(file));
          uploadedInputs.push(input);
        }
        for(const input of card.querySelectorAll('[data-question-card-image]')){
          const file=input.files?.[0];if(!file)continue;
          questionCardImageUrls.set(questionId,await uploadQuestionImage(file));uploadedInputs.push(input);
        }
        for(const row of card.querySelectorAll('[data-rubric-index]')){
          const input=row.querySelector('[data-rubric-image]'),file=input?.files?.[0];if(!file)continue;
          rubricImageUrls.set(`${questionId}:${row.dataset.rubricIndex}`,await uploadQuestionImage(file));uploadedInputs.push(input);
        }
      }
      const sectionImage=[...app.querySelectorAll('[data-section-image]')].find(input=>input.files?.[0]);
      if(sectionImage){
        sectionImageUrl=await uploadQuestionImage(sectionImage.files[0]);
        uploadedInputs.push(sectionImage);
      }
    }
    await repo.transaction(st=>{
      updateExam(st,user,exam.id,{title});
      if(section&&app.querySelector('.part-question[data-question-id]')){
        const imageControl=app.querySelector('[data-section-image-control]');
        const instructionImageUrl=section.questionProfile?.instructionImage===false
          ?''
          :sectionImageUrl??(imageControl?.dataset.removeSectionImage==='true'?'':section.instructionImageUrl||'');
        const questionIds=[...app.querySelectorAll('.part-question[data-question-id]')].map(card=>card.dataset.questionId);
        updateSection(st,user,exam.id,section.id,{instruction:document.getElementById('sectionInstruction')?.value||'',instructionImageUrl,questionIds});
        app.querySelectorAll('.part-question[data-question-id]').forEach(card=>{
          const id=card.dataset.questionId;
          const example=card.dataset.example==='true';
          const mode=card.dataset.editorMode||'choices';
          let rubric;
          if(mode==='form-fields'||mode==='mixed-form'){
            const previousQuestion=byId(st.questions,id),previousRubric=previousQuestion?.rubric||[];
            rubric=[...card.querySelectorAll('[data-rubric-index]')].map(row=>{
              if(card.dataset.structuredForm==='true')return {...readWritingRow(row,previousRubric[Number(row.dataset.rubricIndex)]),imageUrl:rubricImageUrls.get(`${id}:${row.dataset.rubricIndex}`)??previousRubric[Number(row.dataset.rubricIndex)]?.imageUrl??''};
              const type=row.querySelector('[data-rubric-type]')?.value||'text',hidden=row.dataset.rubricHidden==='true';
              return {
              type,
              label:row.querySelector('[data-rubric-label]')?.value.trim()||'',
              answers:row.querySelector('[data-rubric-answer]')?.value.trim()||'',
              maxScore:isScoredWritingField({type,hidden})?Math.max(0,Number(row.querySelector('[data-rubric-score]')?.value)||0):0,
              hidden,
              imageUrl:rubricImageUrls.get(`${id}:${row.dataset.rubricIndex}`)??(previousRubric[Number(row.dataset.rubricIndex)]?.imageUrl||''),
            };});
            if(mode==='form-fields'){
              const maxScore=writingFormScore(rubric);
              updateQuestion(st,user,id,{rubric,maxScore,example,...(card.dataset.structuredForm==='true'?{writingFormVersion:1}: {})});
              return;
            }
          }
          const titleField=card.querySelector('[data-field="title"]');
          const scoreField=card.querySelector('[data-field="maxScore"]');
          const correct=card.querySelector('[data-field="correct"]:checked');
          const previousQuestion=byId(st.questions,id),previousChoices=previousQuestion?.choices||[];
          const choices=[...card.querySelectorAll('[data-choice]')].map(input=>{
            const index=Number(input.dataset.choice);
            const existing=previousChoices[index];
            return {text:card.querySelector(`[data-choice="${index}"]`)?.value.trim()||'',imageUrl:(choiceImageUrls.get(`${id}:${index}`)??(typeof existing==='object'?existing.imageUrl:''))||''};
          });
          const previousInstructionBlocks=Array.isArray(previousQuestion?.instructionBlocks)
            ?previousQuestion.instructionBlocks
            :[{text:previousQuestion?.prompt||'',imageUrl:previousQuestion?.instructionImageUrl||''}];
          const instructionBlocks=[...card.querySelectorAll('[data-question-instruction-block]')].map((control,index)=>{
            const previousBlock=previousInstructionBlocks[index]||{};
            return {text:control.querySelector('[data-instruction-prompt]')?.value.trim()||'',imageUrl:questionInstructionImageUrls.get(`${id}:${index}`)??(control.dataset.removeQuestionImage==='true'?'':previousBlock.imageUrl||'')};
          });
          const firstInstruction=instructionBlocks[0]||{text:'',imageUrl:''};
          const instructionImageUrl=section.questionProfile?.questionImage===true
            ?(questionCardImageUrls.get(id)??previousQuestion?.instructionImageUrl??'')
            :firstInstruction.imageUrl;
          const mixedChoiceHidden=card.querySelector('[data-mixed-choice-hidden]')?.dataset.mixedChoiceHidden==='true';
          const choiceScore=mixedChoiceHidden?0:Math.max(0,Number(scoreField?.value)||0);
          const maxScore=mode==='mixed-form'?writingFormScore(rubric)+choiceScore:choiceScore;
          updateQuestion(st,user,id,{title:titleField?.value.trim()||'Nháp',prompt:firstInstruction.text,choices,correctAnswer:Number(correct?.value??0),maxScore,example,audioUrl:(audioUrls.get(id)??previousQuestion?.audioUrl)||'',audioName:(audioNames.get(id)??previousQuestion?.audioName)||'',rubric:(rubric??previousQuestion?.rubric)||[],instructionImageUrl,instructionBlocks,mixedChoiceHidden});
        });
      }
    });
    data=await repo.getState();
    audioUrls.forEach((_,questionId)=>{
      pendingAudioUploads.delete(questionId);
      const audioInput=app.querySelector(`[data-question-id="${questionId}"] [data-field="audio"]`);
      if(audioInput)audioInput.value='';
    });
    uploadedInputs.forEach(input=>{input.value='';});
    setBuilderSaveStatus(revision===builderEditRevision?'saved':'pending',revision===builderEditRevision?'Đã tự động lưu':'Chờ lưu thay đổi…');
    if(!silent)notify('Đã lưu bài thi.');
    return true;
  }catch(error){
    setBuilderSaveStatus('error',error?.message||'Chưa lưu được · Kiểm tra kết nối');
    console.error(error);
    notify(error?.message||'Không thể lưu bài thi.');
    return false;
  }
}

function queueBuilderAutosave(delay=450){
  if(ui.view!=='builder')return;
  builderEditRevision++;
  setBuilderSaveStatus('pending','Chờ lưu thay đổi…');
  clearTimeout(builderAutosaveTimer);
  builderAutosaveTimer=setTimeout(async()=>{
    if(ui.view!=='builder')return;
    if(builderAutosaveBusy){builderAutosaveQueued=true;return;}
    builderAutosaveBusy=true;
    try{await saveBuilderDraft({silent:true});}
    finally{
      builderAutosaveBusy=false;
      if(builderAutosaveQueued){builderAutosaveQueued=false;queueBuilderAutosave(0);}
    }
  },delay);
}

function bindGlobal(){
  app.querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=async()=>{if(!await flushBuilderDraft())return;await repo.signOut();user=null;authenticatedUser=null;ui.view='login';render();});
  app.querySelectorAll('[data-action="toggle-role-menu"]').forEach(button=>button.onclick=event=>{
    event.stopPropagation();const account=button.closest('.header-account'),menu=account?.querySelector('[data-role-menu]');if(!menu)return;
    menu.hidden=!menu.hidden;account.querySelectorAll('[data-action="toggle-role-menu"]').forEach(trigger=>trigger.setAttribute('aria-expanded',String(!menu.hidden)));
  });
  app.querySelectorAll('[data-action="test-role"]').forEach(button=>button.onclick=async()=>{
    if(!await flushBuilderDraft())return;
    if(!authenticatedUser?.canTestRoles&&!isMaster(authenticatedUser))return;
    try{
      user=typeof repo.switchTestRole==='function'?await repo.switchTestRole(button.dataset.role):{...authenticatedUser,role:button.dataset.role};
      authenticatedUser=user;data=await repo.getState();ui.view=isStudent(user)?'student-home':'admin';ui.adminTab='exams';render();
    }catch(error){notify(error?.message||'Không đổi được kiểu tài khoản thử nghiệm.');}
  });
  app.querySelectorAll('[data-action="student-home"]').forEach(b=>b.onclick=()=>{ui.view='student-home';render();});
  app.querySelectorAll('[data-action="student-results"]').forEach(b=>b.onclick=()=>{ui.view='student-results';render();});
  app.querySelectorAll('[data-action="student-attempt-detail"]').forEach(b=>b.onclick=async()=>{
    const attempt=byId(data.attempts,b.dataset.id);
    if(!attempt||attempt.studentId!==user.id)return;
    try{
      const review=repo.mode==='api'?await repo.call('getAttemptReview',{attemptId:attempt.id}):{
        attempt,score:attempt.status===ATTEMPT_STATUS.PUBLISHED?{total:attempt.totalScore,sections:attempt.sectionScores,feedback:attempt.feedback,result:attempt.result,reviewerName:attempt.reviewerName}:null,
        sections:(byId(data.exams,attempt.examId)?.sections||[]).map(section=>({name:section.name,questions:(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean).map(q=>({id:q.id,title:q.title||q.prompt,answer:attempt.answers?.[q.id],correct:attempt.status===ATTEMPT_STATUS.PUBLISHED?q.correctAnswer:null,choices:q.choices||[]}))})),
      };
      ui.review=review;ui.view='student-attempt-detail';render();
    }catch(error){notify(error.message||'Không mở được bài làm.');}
  });
  app.querySelectorAll('[data-action="exam-filter"]').forEach(b=>b.onclick=()=>{ui.examFilter=b.dataset.filter;render();});
}

function bindViewSpecific(){
  app.querySelectorAll('[data-admin-exam-filter]').forEach(select=>select.onchange=()=>{ui.adminExamFilters={...ui.adminExamFilters,[select.dataset.adminExamFilter]:select.value};render();});
  app.querySelectorAll('[data-exam-provider-filter]').forEach(select=>select.onchange=()=>{ui.examFilter=select.value;render();});
  app.querySelectorAll('[data-action="exam-select-section"]').forEach(select=>select.onchange=()=>{
    const attempt=byId(data.attempts,ui.attemptId);
    if(attempt)moveAttemptSection(Number(select.value)-(attempt.currentSectionIndex||0));
  });
  app.querySelectorAll('[data-action="share-profile"]').forEach(button=>button.onclick=async()=>{
    const status=app.querySelector('[data-share-status]');
    try{status.textContent=await shareStudentProfile(data,user);}
    catch(error){if(error.name!=='AbortError')status.textContent='Chưa chia sẻ được. Vui lòng thử lại hoặc sao chép địa chỉ trang.';}
  });
  app.querySelectorAll('[data-action="enter-code"]').forEach(button=>button.onclick=()=>openCodeEntry({repo,examId:button.dataset.exam,onStarted:async id=>{data=await repo.getState();ui.attemptId=id;ui.view='exam';render();window.scrollTo(0,0);}}));
  app.querySelectorAll('[data-exam-level-filter]').forEach(select=>select.onchange=()=>{ui.examLevelFilter=select.value;render();});
  app.querySelectorAll('[data-action="exam-access-settings"]').forEach(button=>button.onclick=async()=>{
    if(!await flushBuilderDraft())return;
    const exam=byId(data.exams,button.dataset.id);
    if(exam)await openExamAccess({repo,exam,onSaved:async()=>{data=await repo.getState();render();}});
  });
  app.querySelectorAll('[data-action="start"]').forEach(b=>b.onclick=()=>beginAttempt(b.dataset.exam,true));
  app.querySelectorAll('[data-action="prev-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(-1));
  app.querySelectorAll('[data-action="next-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(1));
  app.querySelectorAll('[data-action="submit-exam"]').forEach(b=>b.onclick=()=>submitCurrentExam());
  app.querySelectorAll('[data-action="preview-prev-section"]').forEach(b=>b.onclick=()=>showPreviewSection(ui.previewSectionIndex-1));
  app.querySelectorAll('[data-action="preview-next-section"]').forEach(b=>b.onclick=()=>showPreviewSection(ui.previewSectionIndex+1));
  app.querySelectorAll('[data-action="preview-select-section"]').forEach(select=>select.onchange=()=>showPreviewSection(Number(select.value)||0));
  app.querySelectorAll('[data-action="reset-preview"]').forEach(b=>b.onclick=()=>{ui.previewAnswers={};ui.previewSectionIndex=0;window.scrollTo(0,0);render();notify('Đã làm lại Preview.');});
  app.querySelectorAll('[data-action="close-preview"]').forEach(b=>b.onclick=()=>{ui.previewAnswers={};ui.view='builder';render();});
  app.querySelectorAll('[data-action="admin-tab"]').forEach(b=>b.onclick=async()=>{if(!await flushBuilderDraft())return;clearBuilderEditUrl();ui.adminTab=b.dataset.tab;ui.view='admin';render();});
  app.querySelectorAll('[data-action="new-question"]').forEach(b=>b.onclick=()=>questionModal(null,ui.view==='builder'?async q=>{const ex=byId(data.exams,ui.builderExamId),sec=ex?.sections.find(s=>s.id===ui.builderSectionId);if(ex&&sec)await act(()=>repo.transaction(st=>addQuestionsToSection(st,user,ex.id,sec.id,[q.id])),'Đã thêm câu vào phần.');}:null));
  app.querySelectorAll('[data-action="edit-part-template"]').forEach(b=>b.onclick=async()=>{
    const exam=byId(data.exams,ui.builderExamId),section=exam?.sections.find(s=>s.id===ui.builderSectionId);
    if(!exam||!section)return;
    if(!hasPartTemplate(section.templateType)){notify('Part này chưa có template riêng.');return;}
    const commit=({operations=[],sectionPatch={}}={})=>repo.transaction(st=>{
      for(const op of operations){
        st[op.collection]||=[];
        const index=st[op.collection].findIndex(item=>item.id===op.id);
        if(op.kind==='delete'){if(index>=0)st[op.collection].splice(index,1);continue;}
        if(index>=0)st[op.collection][index]=op.item;else st[op.collection].push(op.item);
      }
      updateSection(st,user,exam.id,section.id,sectionPatch);
    });
    await openPartTemplate(section.templateType,{exam,section,state:data,user,commit,onSaved:async()=>{
      data=await repo.getState();notify('Đã lưu cấu hình Part.');render();
    }});
  });
  app.querySelectorAll('[data-action="edit-question"]').forEach(b=>b.onclick=()=>questionModal(byId(data.questions,b.dataset.id)));
  app.querySelectorAll('[data-action="preview-question"]').forEach(b=>b.onclick=()=>previewQuestionModal(byId(data.questions,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>softDeleteQuestion(st,user,b.dataset.id)),'Đã chuyển câu hỏi vào Thùng rác.'));
  app.querySelectorAll('[data-action="new-exam"]').forEach(b=>b.onclick=()=>createNewExam());
  app.querySelectorAll('[data-action="edit-exam"]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.id));
  app.querySelectorAll('[data-action="duplicate-exam"]').forEach(b=>b.onclick=async()=>{
    const copy=await act(()=>repo.mode==='api'?repo.call('copyExam',{examId:b.dataset.id}):repo.transaction(st=>duplicateExam(st,user,b.dataset.id)),'Đã nhân bản bài thi.',{rerender:false});
    if(copy&&repo.mode==='api')await repo.reload();
    if(copy){data=await repo.getState();ui.adminTab='exams';await openBuilder(copy.id);}
  });
  app.querySelectorAll('[data-action="view-exam"]').forEach(b=>b.onclick=()=>previewExamModal(byId(data.exams,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>softDeleteExam(st,user,b.dataset.id)),'Đã chuyển bài thi vào Thùng rác.'));
  app.querySelectorAll('[data-action="publish-exam"]').forEach(b=>b.onclick=async()=>{if(!await flushBuilderDraft())return;await act(()=>repo.transaction(st=>publishExam(st,user,b.dataset.id)),'Đã xuất bản bài thi.');});
  app.querySelectorAll('[data-action="preview-exam"]').forEach(b=>b.onclick=async()=>{
    if(!await flushBuilderDraft())return;
    const exam=byId(data.exams,b.dataset.id);
    const sectionIndex=Math.max(0,(exam?.sections||[]).findIndex(section=>section.id===ui.builderSectionId));
    ui.previewExamId=b.dataset.id;ui.previewSectionIndex=sectionIndex;ui.previewAnswers={};ui.view='preview-exam';render();
  });
  app.querySelectorAll('[data-action="open-exam-settings"]').forEach(b=>b.onclick=()=>{
    const exam=byId(data.exams,ui.builderExamId);if(!exam)return;
    const skill=b.dataset.skill;
    if(!skill)return;
    const setting=exam.settings?.skillSettings?.[skill]||{};
    const sectionDefaultTime=(exam.sections||[]).find(item=>item.skill===skill)?.timeMinutes??20;
    const modal=document.createElement('div');modal.className='hop-chon';
    modal.innerHTML=`<div class="noi-hop exam-setup"><div class="dau-hop"><div class="nhan-muc">CÀI ĐẶT</div><button class="nut nho" data-close aria-label="Đóng">×</button></div><div class="exam-setup-grid"><label>Thời gian (phút)<input id="skillTimeMinutes" type="number" min="1" value="${Number(setting.timeMinutes??sectionDefaultTime)}"></label><label>Điểm mặc định mỗi câu<input id="defaultQuestionScore" type="number" min="0" value="${Number(setting.defaultQuestionScore??exam.settings?.defaultQuestionScore??1)}"></label></div><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-close>Hủy</button><button class="nut chinh" id="saveExamSettings">Lưu</button></div></div></div>`;
    document.body.append(modal);modal.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modal.remove());
    modal.querySelector('#saveExamSettings').onclick=()=>{const time=Math.max(1,Number(modal.querySelector('#skillTimeMinutes').value)||1),score=Math.max(0,Number(modal.querySelector('#defaultQuestionScore').value)||0);act(()=>repo.transaction(st=>updateExam(st,user,exam.id,{settings:{skillSettings:{...(exam.settings?.skillSettings||{}),[skill]:{timeMinutes:time,defaultQuestionScore:score}}}})),'Đã lưu cài đặt phần.');modal.remove();};
  });
  app.querySelectorAll('[data-action="grade-attempt"]').forEach(b=>b.onclick=()=>{ui.gradeAttemptId=b.dataset.id;ui.view='grading-detail';render();});
  app.querySelectorAll('[data-action="grade-mode"]').forEach(b=>b.onclick=()=>{ui.gradeMode=b.dataset.mode;render();});
  app.querySelectorAll('[data-action="student-grade-detail"]').forEach(b=>b.onclick=()=>studentGradeModal(b.dataset.id));
  app.querySelectorAll('[data-action="toggle-teacher"]').forEach(b=>b.onclick=()=>toggleTeacher(b.dataset.id));
  app.querySelectorAll('[data-action="restore-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreExam(st,user,b.dataset.id)),'Đã khôi phục bài thi.'));
  app.querySelectorAll('[data-action="restore-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreQuestion(st,user,b.dataset.id)),'Đã khôi phục câu hỏi.'));
  app.querySelectorAll('[data-action="permanent-exam"]').forEach(b=>b.onclick=()=>confirmAction('Xóa vĩnh viễn đề và toàn bộ bài làm, bảng điểm liên quan? Không thể khôi phục.',()=>act(()=>repo.transaction(st=>permanentlyDeleteExam(st,user,b.dataset.id)),'Đã xóa vĩnh viễn đề và lịch sử bài làm.'),{confirmLabel:'Xóa vĩnh viễn',danger:true}));
  app.querySelector('[data-action="empty-trash"]')?.addEventListener('click',()=>confirmAction('Xóa vĩnh viễn tất cả đề trong Thùng rác cùng bài làm và bảng điểm liên quan? Không thể khôi phục. Câu hỏi và media còn được sử dụng sẽ được giữ lại.',()=>act(()=>repo.mode==='api'?(async()=>{const result=await repo.call('emptyTrash');await repo.reload();return result;})():repo.transaction(st=>{
    for(const exam of [...st.exams].filter(e=>e.status==='trash'))permanentlyDeleteExam(st,user,exam.id);
    for(const q of [...st.questions].filter(q=>q.status==='trash')){
      const referenced=st.exams.some(e=>(e.sections||[]).some(s=>s.questionIds?.includes(q.id)))||(st.attempts||[]).some(a=>Object.hasOwn(a.answers||{},q.id)||(a.examSnapshot?.questionSnapshot||[]).some(x=>x.id===q.id));
      if(!referenced)permanentlyDeleteQuestion(st,user,q.id);
    }
  }),'Đã dọn thùng rác. Nội dung còn được sử dụng được giữ lại.'),{confirmLabel:'Dọn sạch thùng rác',danger:true}));
  app.querySelectorAll('[data-action="permanent-question"]').forEach(b=>b.onclick=()=>confirmAction('Xóa vĩnh viễn câu hỏi? Hành động không thể hoàn tác.',()=>act(()=>repo.transaction(st=>permanentlyDeleteQuestion(st,user,b.dataset.id)),'Đã xóa vĩnh viễn.'),{confirmLabel:'Xóa vĩnh viễn',danger:true}));
  bindBuilder();
  bindGrading();
}

async function beginAttempt(examId,restart){
  if(repo.mode==='api'&&!await act(()=>repo.reload(),null,{rerender:false}))return;
  const attempt=await act(()=>repo.transaction(st=>startAttempt(st,user,examId,{restart})),null,{rerender:false});
  if(attempt?.status===ATTEMPT_STATUS.IN_PROGRESS){data=await repo.getState();ui.attemptId=attempt.id;ui.view='exam';render();window.scrollTo(0,0);}
}

async function moveAttemptSection(delta){
  if(guardExamAudio())return;
  const attempt=byId(data.attempts,ui.attemptId),exam=attempt&&byId(data.exams,attempt.examId);
  if(!attempt||!exam)return;
  if(attempt.status!==ATTEMPT_STATUS.IN_PROGRESS){ui.view='student-home';render();notify('Dieser Prüfungsversuch ist bereits beendet. Starten Sie einen neuen Versuch.');return;}
  if(!await flushTextAnswers())return;
  const next=Math.max(0,Math.min(exam.sections.length-1,(attempt.currentSectionIndex||0)+delta));
  const result=await act(()=>repo.transaction(st=>setAttemptSection(st,user,attempt.id,next)),null,{rerender:false});
  if(result){data=await repo.getState();ui.view='exam';render();window.scrollTo(0,0);}
}

async function createNewExam(){
  const setup=await new Promise(resolve=>{
    const modal=document.createElement('div');
    modal.className='hop-chon';
    modal.innerHTML=`<div class="noi-hop exam-setup"><div class="dau-hop"><h2>TẠO BÀI THI</h2><button class="nut nho" data-close>×</button></div><div class="exam-setup-grid"><div class="choice-field"><b>Loại đề</b><div class="choice-buttons" id="newExamProviders"><button type="button" data-provider="GOETHE">Goethe</button><button type="button" data-provider="TELC">TELC</button></div></div><div class="choice-field"><b>Trình độ</b><div class="choice-buttons" id="newExamLevels"><button type="button" data-level="A1">A1</button><button type="button" data-level="A2">A2</button><button type="button" data-level="B1">B1</button><button type="button" data-level="B2">B2</button></div></div><label class="exam-setup-name">Tên đề thi<input id="newExamTitle" placeholder="Ví dụ: Goethe A1 – Đề thi thử 01"></label></div><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-close>Hủy</button><button class="nut chinh" id="confirmNewExam">Tạo đề</button></div></div></div>`;
    document.body.append(modal);
    const title=modal.querySelector('#newExamTitle');
    let provider='GOETHE',level='A1';
    const syncLevels=()=>{
      const available=getProviderLevels(provider);
      if(!available.includes(level))level=available[0];
      modal.querySelectorAll('[data-level]').forEach(button=>{button.classList.toggle('an',!available.includes(button.dataset.level));button.classList.toggle('active',button.dataset.level===level);});
      modal.querySelectorAll('[data-provider]').forEach(button=>button.classList.toggle('active',button.dataset.provider===provider));
      suggest();
    };
    const suggest=()=>{if(!title.value)title.placeholder=`Ví dụ: ${provider} ${level} – Đề thi thử 01`;};
    modal.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>{level=button.dataset.level;syncLevels();});
    modal.querySelectorAll('[data-provider]').forEach(button=>button.onclick=()=>{provider=button.dataset.provider;syncLevels();});
    syncLevels();
    modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{modal.remove();resolve(null);});
    modal.querySelector('#confirmNewExam').onclick=()=>{const value=title.value.trim()||`${provider} ${level} – Bản nháp`;modal.remove();resolve({level,provider,title:value});};
    title.focus();
  });
  if(!setup)return;
  const {level,provider,title}=setup;
  const exam=await act(()=>repo.transaction(st=>createExamDraft(st,user,{level,provider,title})),null,{rerender:false});
  if(exam){data=await repo.getState();openBuilder(exam.id);notify('Đã tạo đề. Link chỉnh sửa trực tiếp đã có trên thanh địa chỉ.');}
}

function builderEditUrl(id){
  const url=new URL(window.location.href);
  url.searchParams.set('edit',id);
  return url.toString();
}

function clearBuilderEditUrl(){
  const url=new URL(window.location.href);
  url.searchParams.delete('edit');
  history.replaceState(null,'',url);
}

async function openBuilder(id){
  let exam=byId(data.exams,id);
  if(!exam||isStudent(user))return;
  if(repo.mode==='api'&&canEditExam(user,exam)){
    const prepared=await act(()=>repo.call('prepareExamForEditing',{examId:id}),null,{rerender:false});
    if(!prepared)return;
    await repo.reload();data=await repo.getState();exam=byId(data.exams,id);
  }
  const changed=canEditExam(user,exam)?await repo.transaction(st=>{
    const detached=detachLockedDraftQuestions(st,user,id);
    const migrated=ensureExamMatchesConfiguredSpec(st,user,id);
    const populated=repo.mode==='local'&&populateGoetheA1TestFixture(st,user,id);
    return detached||migrated||populated;
  }):false;
  if(changed){data=await repo.getState();exam=byId(data.exams,id);}
  ui.builderExamId=id;
  ui.builderSectionId=exam?.sections?.[0]?.id||null;
  ui.view='builder';
  history.replaceState(null,'',builderEditUrl(id));
  render();
}

function bindBuilder(){
  const exam=byId(data.exams,ui.builderExamId);
  if(!exam)return;
  app.querySelectorAll('[data-action="edit-part-template"]').forEach(button=>{
    const section=exam.sections.find(item=>item.id===ui.builderSectionId);
    if(!hasPartTemplate(section?.templateType)){button.disabled=true;button.textContent='Template phần này chưa cấu hình';}
  });
  app.querySelectorAll('[data-action="back-admin"]').forEach(b=>b.onclick=async()=>{if(!await flushBuilderDraft())return;clearBuilderEditUrl();ui.view='admin';ui.adminTab='exams';render();});
  app.querySelectorAll('[data-action="select-section"]').forEach(b=>b.onclick=async e=>{if(e.target.closest('.phan-tool'))return;if(!await flushBuilderDraft())return;ui.builderSectionId=b.dataset.id;render();});
  app.querySelectorAll('[data-action="add-section"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>addSection(st,user,exam.id,{name:'Phần mới',timeMinutes:30})),'Đã thêm phần.'));
  app.querySelectorAll('[data-action="move-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();act(()=>repo.transaction(st=>moveSection(st,user,exam.id,b.dataset.id,b.dataset.dir)));});
  app.querySelectorAll('[data-action="remove-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();confirmAction('Bỏ phần này khỏi bài thi?',()=>act(()=>repo.transaction(st=>removeSection(st,user,exam.id,b.dataset.id)),'Đã bỏ phần.'),{confirmLabel:'Bỏ phần'});});
  app.querySelectorAll('[data-action="move-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>moveQuestion(st,user,exam.id,ui.builderSectionId,b.dataset.id,b.dataset.dir))));
  app.querySelectorAll('[data-action="remove-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã bỏ câu khỏi phần.'));
  app.querySelectorAll('[data-action="add-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>{
    const section=exam.sections.find(item=>item.id===ui.builderSectionId);
    if(!section)return;
    const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
    const profile=section.questionProfile||{};
    const choices=questionDraftChoices(profile);
    const question=createQuestion(st,user,{level:exam.level,skill:section.skill||section.name,part:section.name,type:profile.type||'single',title:'Nháp',choices,correctAnswer:0,maxScore:defaultScore});
    addQuestionsToSection(st,user,exam.id,section.id,[question.id]);
    if(b.dataset.after){
      const ids=[...section.questionIds];
      const from=ids.indexOf(question.id),after=ids.indexOf(b.dataset.after);
      if(from>=0&&after>=0){ids.splice(from,1);ids.splice(after+1,0,question.id);updateSection(st,user,exam.id,section.id,{questionIds:ids});}
    }
  }),'Đã thêm câu hỏi.'));
  app.querySelectorAll('[data-action="remove-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã xóa câu hỏi.'));
  app.querySelectorAll('[data-action="toggle-question-example"]').forEach(button=>button.onclick=async()=>{
    const card=button.closest('.part-question');if(!card)return;
    const makeExample=card.dataset.example!=='true';
    card.dataset.example=makeExample?'true':'false';
    card.classList.toggle('is-example',card.dataset.example==='true');
    let motion=Promise.resolve();
    if(makeExample){
      const container=card.parentElement,cards=[...container.children].filter(item=>item.matches?.('.part-question'));
      const before=new Map(cards.map(item=>[item,item.getBoundingClientRect()]));
      container.insertBefore(card,cards[0]||null);
      const animations=cards.map(item=>{const first=before.get(item),last=item.getBoundingClientRect(),dx=first.left-last.left,dy=first.top-last.top;if(!dx&&!dy)return null;return item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:360,easing:'cubic-bezier(.22,.8,.25,1)'});}).filter(Boolean);
      motion=Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
    }
    const saved=await saveBuilderDraft({silent:true});await motion;
    if(saved){data=await repo.getState();render();}
  });
  app.querySelectorAll('[data-action="hide-mixed-choice"]').forEach(b=>b.onclick=async()=>{
    if(!await saveBuilderDraft({silent:true}))return;
    await act(()=>repo.transaction(st=>updateQuestion(st,user,b.dataset.id,{mixedChoiceHidden:true})),'Đã ẩn câu hỏi.');
  });
  app.querySelectorAll('[data-action="restore-mixed-choice"]').forEach(b=>b.onclick=async()=>{
    if(!await saveBuilderDraft({silent:true}))return;
    await act(()=>repo.transaction(st=>updateQuestion(st,user,b.dataset.id,{mixedChoiceHidden:false})),'Đã hiện câu hỏi.');
  });
  app.querySelectorAll('[data-action="remove-rubric-row"]').forEach(b=>b.onclick=async()=>{
    if(b.closest('[data-structured-form]')){
      if(!await saveBuilderDraft({silent:true}))return;
      await act(()=>repo.transaction(st=>{const q=byId(st.questions,b.dataset.id);if(q)updateQuestion(st,user,q.id,{rubric:removeWritingRow(q.rubric,Number(b.dataset.index))});}));return;
    }
    const row=b.closest('[data-rubric-index]'),card=b.closest('[data-question-id]');if(!row||!card)return;
    row.remove();
    builderEditRevision++;
    if(await saveBuilderDraft({silent:true}))data=await repo.getState();
    render();
  });
  app.querySelectorAll('[data-action="add-form-option"]').forEach(b=>b.onclick=async()=>{
    if(!await saveBuilderDraft({silent:true}))return;
    await act(()=>repo.transaction(st=>{const q=byId(st.questions,b.dataset.id);if(!q)return;const rubric=structuredClone(q.rubric);const row=rubric[Number(b.dataset.index)];if(row)row.options=[...(row.options||[]),''];updateQuestion(st,user,q.id,{rubric});}));
  });
  app.querySelectorAll('[data-action="add-rubric-row"]').forEach(b=>b.onclick=async()=>{
    if(!await saveBuilderDraft({silent:true}))return;
    await act(()=>repo.transaction(st=>{
      const question=byId(st.questions,b.dataset.id);if(!question)return;
      if(b.closest('[data-structured-form]')){updateQuestion(st,user,question.id,{rubric:addWritingRow(question.rubric,b.dataset.type,b.dataset.index===undefined?undefined:Number(b.dataset.index))});return;}
      const rubric=[...(question.rubric||[])],index=Number(b.dataset.index),source=rubric[index]||{},type=source.type||'text';
      if(source.hidden)rubric[index]={...source,hidden:false};
      else rubric.push({type,label:source.label||'',answers:source.answers||'',maxScore:Number(source.maxScore??1),hidden:false,imageUrl:''});
      updateQuestion(st,user,question.id,{rubric});
    }),'Đã thêm trường vào cuối form.');
  });
  const instructionBlocksFor=question=>Array.isArray(question?.instructionBlocks)
    ?question.instructionBlocks
    :[{text:question?.prompt||'',imageUrl:question?.instructionImageUrl||''}];
  app.querySelectorAll('[data-action="add-question-instruction"]').forEach(b=>b.onclick=async()=>{
    await saveBuilderDraft({silent:true});
    await act(()=>repo.transaction(st=>{
      const question=byId(st.questions,b.dataset.id);if(!question)return;
      updateQuestion(st,user,question.id,{instructionBlocks:[...instructionBlocksFor(question),{text:'',imageUrl:''}]});
    }),'Đã thêm đề bài.');
  });
  app.querySelectorAll('[data-action="remove-question-instruction"]').forEach(b=>b.onclick=async()=>{
    await saveBuilderDraft({silent:true});
    await act(()=>repo.transaction(st=>{
      const question=byId(st.questions,b.dataset.id);if(!question)return;
      const blocks=instructionBlocksFor(question);blocks.splice(Number(b.dataset.index),1);
      const first=blocks[0]||{text:'',imageUrl:''};
      updateQuestion(st,user,question.id,{instructionBlocks:blocks,prompt:first.text,instructionImageUrl:first.imageUrl});
    }),'Đã xóa đề bài.');
  });
  app.querySelectorAll('[data-action="move-question-instruction"]').forEach(b=>b.onclick=async()=>{
    if(!await saveBuilderDraft({silent:true}))return;
    await act(()=>repo.transaction(st=>{
      const currentExam=byId(st.exams,exam.id),currentSection=currentExam?.sections.find(item=>item.id===ui.builderSectionId);
      const ids=currentSection?.questionIds||[],sourceIndex=ids.indexOf(b.dataset.id),targetIndex=sourceIndex+(b.dataset.dir==='up'?-1:1);
      if(sourceIndex<0||targetIndex<0||targetIndex>=ids.length)return;
      const source=byId(st.questions,b.dataset.id),target=byId(st.questions,ids[targetIndex]);if(!source||!target)return;
      const sourceBlocks=[...instructionBlocksFor(source)],blockIndex=Number(b.dataset.index),block=sourceBlocks.splice(blockIndex,1)[0];if(!block)return;
      const targetBlocks=Array.isArray(target.instructionBlocks)?[...target.instructionBlocks]:[];
      if(b.dataset.dir==='up')targetBlocks.push(block);else targetBlocks.unshift(block);
      const sourceFirst=sourceBlocks[0]||{text:'',imageUrl:''},targetFirst=targetBlocks[0]||{text:'',imageUrl:''};
      updateQuestion(st,user,source.id,{instructionBlocks:sourceBlocks,prompt:sourceFirst.text,instructionImageUrl:sourceFirst.imageUrl});
      updateQuestion(st,user,target.id,{instructionBlocks:targetBlocks,prompt:targetFirst.text,instructionImageUrl:targetFirst.imageUrl});
    }));
  });
  const section=exam.sections.find(item=>item.id===ui.builderSectionId)||exam.sections[0];
  bindPartBuilder(section?.templateType,{root:app,data,exam,section,pendingAudioUploads,notify});
  app.querySelectorAll('[data-rubric-type]').forEach(field=>field.addEventListener('change',async()=>{await saveBuilderDraft({silent:true});render();}));
  app.querySelectorAll('.goethe-builder input,.goethe-builder textarea,.goethe-builder select').forEach(field=>{
    field.addEventListener('input',()=>queueBuilderAutosave());
    field.addEventListener('change',()=>queueBuilderAutosave(0));
  });
  app.querySelectorAll('[data-action="clear-section-image"],[data-action="clear-question-image"]').forEach(button=>button.addEventListener('click',()=>queueBuilderAutosave(0)));
  app.querySelectorAll('[data-action="save-section"]').forEach(b=>b.onclick=()=>{
    const patch={
      name:document.getElementById('sectionName').value,
      timeMinutes:Number(document.getElementById('sectionTime').value)||1,
      maxScore:Number(document.getElementById('sectionMax').value)||0,
      showTimer:document.getElementById('showTimer').checked,
      autoSubmit:document.getElementById('autoSubmit').checked,
      shuffle:document.getElementById('shuffle').checked
    };
    act(()=>repo.transaction(st=>updateSection(st,user,exam.id,ui.builderSectionId,patch)),'Đã lưu cài đặt phần.');
  });
}

function bindGrading(){
  if(ui.view==='grading-detail'&&app.querySelector('[data-action="publish-result"]')){
    gradeAutosave=createGradeAutosave(()=>saveGrade(false),text=>{const status=app.querySelector('[data-grade-save-status]');if(status)status.textContent=text;});
    app.querySelectorAll('.manual-score,#gradeOralScore,#gradeFeedback').forEach(input=>input.addEventListener('input',()=>gradeAutosave.change()));
  }
  app.querySelectorAll('[data-action="back-grading"]').forEach(b=>b.onclick=async()=>{if(!await flushBuilderDraft())return;gradeAutosave=null;ui.view='admin';ui.adminTab='grades';render();});
  app.querySelectorAll('[data-action="publish-result"]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    const inputs=[...app.querySelectorAll('.manual-score,#gradeOralScore,#gradeFeedback')];
    try{
      if(!await flushBuilderDraft())return;
      gradePublishing=true;
      inputs.forEach(input=>input.readOnly=true);
      await saveGrade(true);
    }finally{gradePublishing=false;inputs.forEach(input=>input.readOnly=false);b.disabled=false;}
  });
}

async function saveGrade(andPublish){
  const attempt=byId(data.attempts,ui.gradeAttemptId);
  if(!attempt)return;
  for(const input of app.querySelectorAll('.manual-score,#gradeOralScore')){
    const previous=input.id==='gradeOralScore'?attempt.oralScore:attempt.manualScores?.[input.dataset.skill];
    input.setCustomValidity(input.value===''&&previous!=null?'Vui lòng nhập điểm, nhập 0 nếu không có điểm.':'');
    if(!input.checkValidity()){input.reportValidity();return;}
  }
  const oralInput=document.getElementById('gradeOralScore');
  if(oralInput?.value){
    if(!oralInput.checkValidity()){oralInput.reportValidity();return;}
    if(repo.mode==='api'){
      const result=await act(()=>repo.call('saveOralScore',{attemptId:attempt.id,score:Number(oralInput.value)}),null,{rerender:false});
      if(!result)return;
      await repo.reload();
    }else await repo.transaction(st=>{const a=byId(st.attempts,attempt.id);a.oralScore=Number(oralInput.value);a.oralMax=Number(oralInput.max);});
  }
  const scores={};
  app.querySelectorAll('.manual-score').forEach(i=>{if(i.value!=='')scores[i.dataset.skill]=Number(i.value);});
  const feedback=document.getElementById('gradeFeedback')?.value||'';
  const saved=await act(()=>repo.transaction(st=>saveManualScore(st,user,attempt.id,{scores,feedback})),null,{rerender:false});
  if(!saved)return;
  data=await repo.getState();
  const fresh=byId(data.attempts,attempt.id);
  if(andPublish){
    if(fresh.status!==ATTEMPT_STATUS.READY){notify('Cần chấm đủ các phần trước khi công bố.');render();return;}
    const published=await act(()=>repo.transaction(st=>publishAttempt(st,user,attempt.id)),'Đã công bố kết quả và xếp email thông báo.',{rerender:false});
    if(published){data=await repo.getState();ui.view='admin';ui.adminTab='grades';render();}
  }
  return true;
}

async function toggleTeacher(id){
  if(!isMaster(user))return;
  const account=byId(data.users,id);
  if(!account)return;
  const role=account.role==='teacher'?'student':'teacher';
  if(typeof repo.setUserRoleSecure==='function'){
    await act(()=>repo.setUserRoleSecure(id,role),'Đã cập nhật vai trò tài khoản.');
    return;
  }
  await act(()=>repo.transaction(st=>{
    const target=byId(st.users,id);
    if(!target)throw new Error('Không tìm thấy tài khoản.');
    if(target.role==='master')throw new Error('Không thể thay đổi tài khoản quản trị cấp cao.');
    target.role=role;
    target.updatedAt=new Date().toISOString();
  }),'Đã cập nhật vai trò tài khoản.');
}

const initialUrl=new URL(window.location.href),directBuilderId=initialUrl.searchParams.get('edit');
const directBuilderExam=directBuilderId&&byId(data.exams,directBuilderId);
if(directBuilderExam&&user&&!isStudent(user))await openBuilder(directBuilderId);
else{
  const previewId=initialUrl.searchParams.get('preview'),previewExam=previewId&&byId(data.exams,previewId);
  const requestedView=initialUrl.searchParams.get('view'),requestedAttempt=initialUrl.searchParams.get('attempt');
  if(previewExam&&user&&!isStudent(user)){ui.previewExamId=previewId;ui.previewSectionIndex=Math.max(0,Number(initialUrl.searchParams.get('section'))||0);ui.view='preview-exam';}
  else if(requestedView==='results'&&isStudent(user))ui.view='student-results';
  else if(requestedView==='exam'&&isStudent(user)&&byId(data.attempts,requestedAttempt)){ui.attemptId=requestedAttempt;ui.view='exam';}
  else if(requestedView==='grading'&&!isStudent(user)&&byId(data.attempts,requestedAttempt)){ui.gradeAttemptId=requestedAttempt;ui.view='grading-detail';}
  else if(!isStudent(user)&&initialUrl.searchParams.get('tab')){ui.adminTab=initialUrl.searchParams.get('tab');ui.view='admin';}
  render();
}
import {shareStudentProfile,bindStudentName} from './views/student-profile-card.js';
