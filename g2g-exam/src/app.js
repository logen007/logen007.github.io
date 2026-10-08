import {createRepository} from './repository.js';
import {
  ATTEMPT_STATUS,byId,isMaster,isStudent,canEditExam,canGradeExam,
  createQuestion,updateQuestion,softDeleteQuestion,restoreQuestion,permanentlyDeleteQuestion,
  updateExam,softDeleteExam,restoreExam,permanentlyDeleteExam,
  addSection,removeSection,moveSection,updateSection,addQuestionsToSection,
  removeQuestionFromSection,moveQuestion,requestGrading,resolveGradingRequest,
  startAttempt,saveAnswer,setAttemptSection,getSectionRemainingSeconds,submitAttempt,
  saveManualScore,publishAttempt,publishExam
} from './core.js';
import {uploadQuestionAudio,uploadQuestionImage} from './media.js';
import {countWords} from './ui/format.js';
import {topbarHtml} from './ui/layout.js';
import {
  loginHtml,studentHomeHtml,studentResultsHtml,examHtml,submittedHtml,answerPresent
} from './views/student.js';
import {
  adminShellHtml,examAdminHtml,gradingAdminHtml,gradesAdminHtml,
  teachersAdminHtml,trashAdminHtml
} from './views/admin.js';
import {examBuilderHtml,gradingDetailHtml} from './views/builder.js';
import {
  questionModalHtml,previewExamModalHtml,previewQuestionModalHtml,
  studentGradeModalHtml
} from './views/modals.js';
import {getProviderLevels} from './exam-specs/index.js';
import {createExamDraft,ensureExamMatchesConfiguredSpec} from './controllers/exam-factory.js';
import {populateGoetheA1TestFixture} from './controllers/goethe-a1-test-fixture.js';
import {hasPartTemplate,openPartTemplate,bindPartBuilder} from './part-templates/index.js';
import {templateRequest} from './part-templates/shared/api.js';
import {initializeTheme} from './settings/theme.js';

initializeTheme();
const app=document.getElementById('app');
const toast=document.getElementById('toast');
const repo=await createRepository();
let data=await repo.getState();
let user=await repo.getCurrentUser();
let timerHandle=null;
let timerBusy=false;
let realtimeRenderTimer=null;
let builderAutosaveTimer=null;
let builderAutosaveBusy=false;
let builderAutosaveQueued=false;
let builderSavePromise=null;
let builderEditRevision=0;
const saveTimers=new Map();
const pendingAudioUploads=new Map();

const ui={
  view:user?(isStudent(user)?'student-home':'admin'):'login',
  adminTab:'exams',examId:null,attemptId:null,builderExamId:null,builderSectionId:null,
  gradeAttemptId:null,gradeMode:'best',previewExamId:null,previewSectionIndex:0,previewAnswers:{},online:navigator.onLine,
};

repo.subscribe(next=>{
  data=next;
  if(['exam','builder','grading-detail'].includes(ui.view)||document.getElementById('modal'))return;
  clearTimeout(realtimeRenderTimer);
  realtimeRenderTimer=setTimeout(()=>render(),80);
});
window.addEventListener('online',()=>{ui.online=true;if(ui.view!=='exam')render();});
window.addEventListener('offline',()=>{ui.online=false;if(ui.view!=='exam')render();});

function layout(content){
  return topbarHtml({user,mode:repo.mode,online:ui.online,ui})+content;
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
  document.getElementById('googleLogin').onclick=async()=>{
    if(repo.mode==='local'){
      notify('Đây là bản demo cục bộ. Đăng nhập Google chỉ hoạt động trên máy chủ G2G.');
      return;
    }
    try{
      user=await repo.signInGoogle();
      data=await repo.getState();
      ui.view=isStudent(user)?'student-home':'admin';
      render();
    }catch(error){
      notify(error?.message||'Không đăng nhập được bằng Google.');
    }
  };
  app.querySelectorAll('.demo-login').forEach(button=>button.onclick=async()=>{
    user=await repo.signInDemo(button.dataset.id);
    data=await repo.getState();
    ui.view=isStudent(user)?'student-home':'admin';
    render();
  });
}

function studentHomeView(){app.innerHTML=layout(studentHomeHtml({data,user}));}
function studentResultsView(){app.innerHTML=layout(studentResultsHtml({data,user}));}
function submittedView(){app.innerHTML=layout(submittedHtml());}

function examView(){
  clearTimer();
  const attempt=byId(data.attempts,ui.attemptId);
  if(!attempt||attempt.studentId!==user.id||attempt.status!==ATTEMPT_STATUS.IN_PROGRESS){ui.view='student-home';render();return;}
  const exam=byId(data.exams,attempt.examId);
  if(!exam){ui.view='student-home';render();return;}
  const sectionIndex=Math.min(attempt.currentSectionIndex||0,Math.max(0,exam.sections.length-1));
  const section=exam.sections[sectionIndex];
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  app.innerHTML=examHtml({attempt,exam,sectionIndex,questions,online:ui.online});
  bindExamInputs(attempt,questions);
  bindSectionAudio(attempt,{preview:false});
  startExamTimer(attempt,exam,sectionIndex);
}

function previewExamView(){
  clearTimer();
  const exam=byId(data.exams,ui.previewExamId);
  if(!exam||!canEditExam(user,exam)){ui.view='admin';render();return;}
  const sectionIndex=Math.min(ui.previewSectionIndex||0,Math.max(0,exam.sections.length-1));
  const section=exam.sections[sectionIndex];
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  const attempt={id:`preview-${exam.id}`,answers:ui.previewAnswers};
  const previewSummary=previewSummaryFor(exam);
  app.innerHTML=examHtml({attempt,exam,sectionIndex,questions,online:ui.online,preview:true,previewSummary});
  bindPreviewInputs(attempt,questions);
  bindSectionAudio(attempt,{preview:true});
}

function previewSummaryFor(exam){
  const sections=(exam.sections||[]).map(item=>{
    const items=(item.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
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
  const setLocalAnswer=(qid,value)=>{
    attempt.answers={...(attempt.answers||{}),[qid]:value};
    const answered=questions.filter(question=>answerPresent(attempt.answers[question.id],question)).length;
    app.querySelectorAll('[data-current-answer-count]').forEach(item=>{item.textContent=`${answered}/${questions.length} câu đã trả lời`;});
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
      btn.textContent='Đang phát...';
      audio.addEventListener('ended',()=>{btn.textContent='Đã phát audio';},{once:true});
      audio.addEventListener('seeking',()=>{if(audio.currentTime>0.5)audio.currentTime=Math.max(0,audio.currentTime-0.25);});
      await audio.play();
    }catch(error){
      sessionStorage.removeItem(key);
      btn.disabled=false;
      btn.textContent='Phát audio';
      notify('Không phát được audio. Hãy kiểm tra kết nối hoặc tệp âm thanh.');
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
    try{sessionStorage.setItem(key,'1');btn.disabled=true;btn.textContent='Đang phát...';audio.addEventListener('ended',()=>{btn.textContent='Đã phát audio';},{once:true});await audio.play();}
    catch{sessionStorage.removeItem(key);btn.disabled=false;btn.textContent='Phát audio';notify('Không phát được audio này.');}
  });
}

function bindSectionAudio(attempt,{preview}){
  const root=app.querySelector('[data-section-audio]');if(!root)return;
  const button=root.querySelector('.section-audio-play'),status=root.querySelector('.section-audio-status');
  const progress=root.querySelector('.section-audio-progress'),progressFill=progress?.querySelector('i');
  const audios=[...root.querySelectorAll('.section-audio-segment')],repeat=Math.max(1,Number(root.dataset.repeat)||1);
  if(!button||!audios.length)return;
  const setProgress=value=>{
    const percent=Math.max(0,Math.min(100,Number(value)||0));
    if(progressFill)progressFill.style.width=`${percent}%`;
    progress?.setAttribute('aria-valuenow',String(Math.round(percent)));
  };
  button.onclick=async()=>{
    if(button.disabled)return;
    button.disabled=true;
    let locked=false;
    try{
      const durations=await Promise.all(audios.map(readAudioDuration));
      const totalDuration=durations.reduce((sum,duration)=>sum+duration*repeat,0);
      if(!preview){
        await templateRequest('/actions/startPartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:root.dataset.sectionAudio}});
      }
      locked=true;
      if(!preview)sessionStorage.setItem(root.dataset.storageKey,'1');
      progress.hidden=false;root.classList.add('is-playing');
      let completedDuration=0;
      for(let index=0;index<audios.length;index++)for(let turn=0;turn<repeat;turn++){
        status.textContent=`Đang phát câu ${index+1}/${audios.length}${repeat>1?` · lần ${turn+1}/${repeat}`:''}`;
        await playSectionSegment(audios[index],currentTime=>setProgress((completedDuration+currentTime)/totalDuration*100));
        completedDuration+=durations[index];setProgress(completedDuration/totalDuration*100);
      }
      if(!preview)await templateRequest('/actions/completePartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:root.dataset.sectionAudio}});
      root.classList.remove('is-playing');progress.hidden=true;
      if(preview){setProgress(0);status.textContent='Chỉ được nghe một lần';button.disabled=false;}
      else{setProgress(100);status.textContent='Đã hết lượt nghe';}
    }catch(error){
      if(!locked){sessionStorage.removeItem(root.dataset.storageKey);button.disabled=false;}
      root.classList.remove('is-playing');progress.hidden=true;
      status.textContent=locked&&!preview?'Đã hết lượt nghe':'Không thể tải audio';
      if(preview)button.disabled=false;
      notify(error?.message||'Không phát được audio.');
    }
  };
}

function readAudioDuration(audio){
  if(Number.isFinite(audio.duration)&&audio.duration>0)return Promise.resolve(audio.duration);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);};
    const ready=()=>{if(!Number.isFinite(audio.duration)||audio.duration<=0)return failed();cleanup();resolve(audio.duration);};
    const failed=()=>{cleanup();reject(new Error('Không đọc được thời lượng audio.'));};
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
  const text=app.querySelector('.answer-text');
  if(text&&ui.attemptId)await act(()=>repo.transaction(st=>saveAnswer(st,user,ui.attemptId,text.dataset.q,text.value)),null,{rerender:false});
}

function startExamTimer(attempt,exam,sectionIndex){
  const section=exam.sections[sectionIndex],el=document.getElementById('examTimer'),summary=document.getElementById('examTimeSummary');
  if(section.showTimer===false){if(el)el.textContent='—';if(summary)summary.textContent='—';return;}
  const tick=async()=>{
    const left=getSectionRemainingSeconds(attempt,exam,sectionIndex);
    const display=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
    if(el)el.textContent=display;
    if(summary)summary.textContent=display;
    if(left<=0&&!timerBusy){
      timerBusy=true;
      clearTimer();
      document.querySelectorAll('.answer-one,.answer-match,.answer-text,.play-audio').forEach(x=>x.disabled=true);
      if(section.autoSubmit!==false){
        await flushTextAnswers();
        if(sectionIndex<exam.sections.length-1){
          await act(()=>repo.transaction(st=>setAttemptSection(st,user,attempt.id,sectionIndex+1)),null,{rerender:false});
          ui.view='exam';
          render();
        }else await submitCurrentExam(false);
      }else notify('Phần thi đã hết thời gian.');
    }
  };
  tick();
  timerHandle=setInterval(tick,1000);
}

async function submitCurrentExam(confirmFirst=true){
  if(confirmFirst&&!confirm('Nộp bài thi? Sau khi nộp bạn sẽ không thể sửa câu trả lời.'))return;
  await flushTextAnswers();
  const result=await act(()=>repo.transaction(st=>submitAttempt(st,user,ui.attemptId)),null,{rerender:false});
  if(result){data=await repo.getState();ui.view='submitted';render();}
}

function adminView(){
  let content='';
  if(ui.adminTab==='exams')content=examAdminHtml({data,user});
  else if(ui.adminTab==='grading')content=gradingAdminHtml({data,user});
  else if(ui.adminTab==='grades')content=gradesAdminHtml({data,ui});
  else if(ui.adminTab==='teachers')content=teachersAdminHtml({data,user});
  else if(ui.adminTab==='trash')content=trashAdminHtml({data});
  app.innerHTML=layout(adminShellHtml({content,user,ui}));
}

function examBuilderView(){
  const exam=byId(data.exams,ui.builderExamId);
  if(!exam||!canEditExam(user,exam)){ui.view='admin';render();return;}
  const section=exam.sections.find(s=>s.id===ui.builderSectionId)||exam.sections[0];
  if(section)ui.builderSectionId=section.id;
  const readOnly=Boolean(exam.locked&&!isMaster(user));
  app.innerHTML=layout(examBuilderHtml({data,user,exam,section,readOnly}));
}

function gradingDetailView(){
  const attempt=byId(data.attempts,ui.gradeAttemptId),exam=attempt&&byId(data.exams,attempt.examId);
  if(!attempt||!exam||!canGradeExam(data,user,exam)){ui.view='admin';render();return;}
  app.innerHTML=layout(gradingDetailHtml({data,user,attempt,exam}));
  bindGradeCalculator(attempt);
}

function bindGradeCalculator(attempt){
  app.querySelectorAll('.manual-score').forEach(input=>input.oninput=()=>{
    let total=Number(attempt.autoScore)||0;
    app.querySelectorAll('.manual-score').forEach(x=>total+=Number(x.value)||0);
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

function previewExamModal(ex){app.insertAdjacentHTML('beforeend',previewExamModalHtml(ex));bindModalClose();}
function previewQuestionModal(q){app.insertAdjacentHTML('beforeend',previewQuestionModalHtml(q));bindModalClose();}
function studentGradeModal(studentId){app.insertAdjacentHTML('beforeend',studentGradeModalHtml({data,studentId}));bindModalClose();}
function closeModal(){document.getElementById('modal')?.remove();}
function bindModalClose(){app.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);}

function render(){
  clearTimer();
  if(!user){ui.view='login';loginView();return;}
  if(ui.view==='student-home')studentHomeView();
  else if(ui.view==='student-results')studentResultsView();
  else if(ui.view==='exam')examView();
  else if(ui.view==='preview-exam')previewExamView();
  else if(ui.view==='submitted')submittedView();
  else if(ui.view==='builder')examBuilderView();
  else if(ui.view==='grading-detail')gradingDetailView();
  else adminView();
  bindGlobal();
  bindViewSpecific();
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
    const audioUrls=new Map(),audioNames=new Map(),choiceImageUrls=new Map(),questionInstructionImageUrls=new Map(),rubricImageUrls=new Map();
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
        updateSection(st,user,exam.id,section.id,{instruction:document.getElementById('sectionInstruction')?.value||'',instructionImageUrl:sectionImageUrl??(imageControl?.dataset.removeSectionImage==='true'?'':section.instructionImageUrl||'')});
        app.querySelectorAll('.part-question[data-question-id]').forEach(card=>{
          const id=card.dataset.questionId;
          const mode=card.dataset.editorMode||'choices';
          let rubric;
          if(mode==='form-fields'||mode==='mixed-form'){
            const previousQuestion=byId(st.questions,id),previousRubric=previousQuestion?.rubric||[];
            rubric=[...card.querySelectorAll('[data-rubric-index]')].map(row=>({
              type:row.querySelector('[data-rubric-type]')?.value||'text',
              label:row.querySelector('[data-rubric-label]')?.value.trim()||'',
              answers:row.querySelector('[data-rubric-answer]')?.value.trim()||'',
              maxScore:Math.max(0,Number(row.querySelector('[data-rubric-score]')?.value)||0),
              hidden:row.dataset.rubricHidden==='true',
              imageUrl:rubricImageUrls.get(`${id}:${row.dataset.rubricIndex}`)??(previousRubric[Number(row.dataset.rubricIndex)]?.imageUrl||''),
            }));
            if(mode==='form-fields'){
              const rawTotal=rubric.reduce((sum,row)=>sum+(row.hidden?0:row.maxScore),0),maxScore=Math.abs(rawTotal-Math.round(rawTotal))<0.02?Math.round(rawTotal):rawTotal;
              updateQuestion(st,user,id,{rubric,maxScore});
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
            return {text:card.querySelector(`[data-choice="${index}"]`)?.value.trim()||'Nháp',imageUrl:(choiceImageUrls.get(`${id}:${index}`)??(typeof existing==='object'?existing.imageUrl:''))||''};
          });
          const previousInstructionBlocks=Array.isArray(previousQuestion?.instructionBlocks)
            ?previousQuestion.instructionBlocks
            :[{text:previousQuestion?.prompt||'',imageUrl:previousQuestion?.instructionImageUrl||''}];
          const instructionBlocks=[...card.querySelectorAll('[data-question-instruction-block]')].map((control,index)=>{
            const previousBlock=previousInstructionBlocks[index]||{};
            return {text:control.querySelector('[data-instruction-prompt]')?.value.trim()||'',imageUrl:questionInstructionImageUrls.get(`${id}:${index}`)??(control.dataset.removeQuestionImage==='true'?'':previousBlock.imageUrl||'')};
          });
          const firstInstruction=instructionBlocks[0]||{text:'',imageUrl:''};
          updateQuestion(st,user,id,{title:titleField?.value.trim()||'Nháp',prompt:firstInstruction.text,choices,correctAnswer:Number(correct?.value??0),maxScore:Math.max(0,Number(scoreField?.value)||0),audioUrl:(audioUrls.get(id)??previousQuestion?.audioUrl)||'',audioName:(audioNames.get(id)??previousQuestion?.audioName)||'',rubric:(rubric??previousQuestion?.rubric)||[],instructionImageUrl:firstInstruction.imageUrl,instructionBlocks});
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
    setBuilderSaveStatus('error','Chưa lưu được · Kiểm tra kết nối');
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
  app.querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=async()=>{await repo.signOut();user=null;ui.view='login';render();});
  app.querySelectorAll('[data-action="student-home"]').forEach(b=>b.onclick=()=>{ui.view='student-home';render();});
  app.querySelectorAll('[data-action="student-results"]').forEach(b=>b.onclick=()=>{ui.view='student-results';render();});
}

function bindViewSpecific(){
  app.querySelectorAll('[data-action="start"]').forEach(b=>b.onclick=()=>beginAttempt(b.dataset.exam,false));
  app.querySelectorAll('[data-action="resume"]').forEach(b=>b.onclick=()=>{ui.attemptId=b.dataset.attempt;ui.view='exam';render();});
  app.querySelectorAll('[data-action="restart"]').forEach(b=>b.onclick=()=>{if(confirm('Bỏ lượt đang làm và bắt đầu lại từ đầu?'))beginAttempt(b.dataset.exam,true);});
  app.querySelectorAll('[data-action="prev-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(-1));
  app.querySelectorAll('[data-action="next-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(1));
  app.querySelectorAll('[data-action="submit-exam"]').forEach(b=>b.onclick=()=>submitCurrentExam(true));
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
  app.querySelectorAll('[data-action="delete-question"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa câu hỏi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteQuestion(st,user,b.dataset.id)),'Đã chuyển câu hỏi vào Thùng rác.');});
  app.querySelectorAll('[data-action="new-exam"]').forEach(b=>b.onclick=()=>createNewExam());
  app.querySelectorAll('[data-action="edit-exam"]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.id));
  app.querySelectorAll('[data-action="view-exam"]').forEach(b=>b.onclick=()=>previewExamModal(byId(data.exams,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-exam"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa bài thi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteExam(st,user,b.dataset.id)),'Đã chuyển bài thi vào Thùng rác.');});
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
  app.querySelectorAll('[data-action="request-grade"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>requestGrading(st,user,b.dataset.id)),'Đã gửi yêu cầu xin chấm.'));
  app.querySelectorAll('[data-action="resolve-request"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>resolveGradingRequest(st,user,b.dataset.id,b.dataset.status)),b.dataset.status==='approved'?'Đã duyệt quyền chấm.':'Đã từ chối yêu cầu.'));
  app.querySelectorAll('[data-action="grade-attempt"]').forEach(b=>b.onclick=()=>{ui.gradeAttemptId=b.dataset.id;ui.view='grading-detail';render();});
  app.querySelectorAll('[data-action="grade-mode"]').forEach(b=>b.onclick=()=>{ui.gradeMode=b.dataset.mode;render();});
  app.querySelectorAll('[data-action="student-grade-detail"]').forEach(b=>b.onclick=()=>studentGradeModal(b.dataset.id));
  app.querySelectorAll('[data-action="toggle-teacher"]').forEach(b=>b.onclick=()=>toggleTeacher(b.dataset.id));
  app.querySelectorAll('[data-action="restore-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreExam(st,user,b.dataset.id)),'Đã khôi phục bài thi.'));
  app.querySelectorAll('[data-action="restore-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreQuestion(st,user,b.dataset.id)),'Đã khôi phục câu hỏi.'));
  app.querySelectorAll('[data-action="permanent-exam"]').forEach(b=>b.onclick=()=>{if(confirm('Xóa vĩnh viễn bài thi? Hành động không thể hoàn tác.'))act(()=>repo.transaction(st=>permanentlyDeleteExam(st,user,b.dataset.id)),'Đã xóa vĩnh viễn.');});
  app.querySelectorAll('[data-action="permanent-question"]').forEach(b=>b.onclick=()=>{if(confirm('Xóa vĩnh viễn câu hỏi? Hành động không thể hoàn tác.'))act(()=>repo.transaction(st=>permanentlyDeleteQuestion(st,user,b.dataset.id)),'Đã xóa vĩnh viễn.');});
  bindBuilder();
  bindGrading();
}

async function beginAttempt(examId,restart){
  const attempt=await act(()=>repo.transaction(st=>startAttempt(st,user,examId,{restart})),null,{rerender:false});
  if(attempt){data=await repo.getState();ui.attemptId=attempt.id;ui.view='exam';render();}
}

async function moveAttemptSection(delta){
  await flushTextAnswers();
  const attempt=byId(data.attempts,ui.attemptId),exam=attempt&&byId(data.exams,attempt.examId);
  if(!attempt||!exam)return;
  const next=Math.max(0,Math.min(exam.sections.length-1,(attempt.currentSectionIndex||0)+delta));
  const result=await act(()=>repo.transaction(st=>setAttemptSection(st,user,attempt.id,next)),null,{rerender:false});
  if(result){data=await repo.getState();ui.view='exam';render();}
}

async function createNewExam(){
  const setup=await new Promise(resolve=>{
    const modal=document.createElement('div');
    modal.className='hop-chon';
    modal.innerHTML=`<div class="noi-hop exam-setup"><div class="dau-hop"><div><div class="nhan-muc">TẠO BÀI THI</div><h2>Thông tin đề thi</h2></div><button class="nut nho" data-close>×</button></div><div class="exam-setup-grid"><div class="choice-field"><b>Trình độ</b><div class="choice-buttons" id="newExamLevels"><button type="button" data-level="A1">A1</button><button type="button" data-level="A2">A2</button><button type="button" data-level="B1">B1</button><button type="button" data-level="B2">B2</button></div></div><div class="choice-field"><b>Loại đề</b><div class="choice-buttons" id="newExamProviders"><button type="button" data-provider="TELC">TELC</button><button type="button" data-provider="GOETHE">Goethe</button></div></div><label class="exam-setup-name">Tên đề thi<input id="newExamTitle" placeholder="Ví dụ: TELC B1 – Đề thi thử 01"></label></div><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-close>Hủy</button><button class="nut chinh" id="confirmNewExam">Tạo đề</button></div></div></div>`;
    document.body.append(modal);
    const title=modal.querySelector('#newExamTitle');
    let provider='TELC',level='B1';
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
  const changed=await repo.transaction(st=>{
    const migrated=ensureExamMatchesConfiguredSpec(st,user,id);
    const populated=repo.mode==='local'&&populateGoetheA1TestFixture(st,user,id);
    return migrated||populated;
  });
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
  app.querySelectorAll('[data-action="remove-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(confirm('Bỏ phần này khỏi bài thi?'))act(()=>repo.transaction(st=>removeSection(st,user,exam.id,b.dataset.id)),'Đã bỏ phần.');});
  app.querySelectorAll('[data-action="move-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>moveQuestion(st,user,exam.id,ui.builderSectionId,b.dataset.id,b.dataset.dir))));
  app.querySelectorAll('[data-action="remove-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã bỏ câu khỏi phần.'));
  app.querySelectorAll('[data-action="add-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>{
    const section=exam.sections.find(item=>item.id===ui.builderSectionId);
    if(!section)return;
    const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
    const profile=section.questionProfile||{};
    const choices=Array.isArray(profile.choices)&&profile.choices.length>=2?[...profile.choices]:['Nháp','Nháp','Nháp'];
    const question=createQuestion(st,user,{level:exam.level,skill:section.skill||section.name,part:section.name,type:profile.type||'single',title:'Nháp',choices,correctAnswer:0,maxScore:defaultScore});
    addQuestionsToSection(st,user,exam.id,section.id,[question.id]);
    if(b.dataset.after){
      const ids=[...section.questionIds];
      const from=ids.indexOf(question.id),after=ids.indexOf(b.dataset.after);
      if(from>=0&&after>=0){ids.splice(from,1);ids.splice(after+1,0,question.id);updateSection(st,user,exam.id,section.id,{questionIds:ids});}
    }
  }),'Đã thêm câu hỏi.'));
  app.querySelectorAll('[data-action="remove-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã xóa câu hỏi.'));
  app.querySelectorAll('[data-action="remove-rubric-row"]').forEach(b=>b.onclick=async()=>{
    await saveBuilderDraft({silent:true});
    await act(()=>repo.transaction(st=>{
      const question=byId(st.questions,b.dataset.id);if(!question)return;
      const rubric=[...(question.rubric||[])],index=Number(b.dataset.index),type=rubric[index]?.type||'text';
      const activeOfType=rubric.filter(row=>(row.type||'text')===type&&!row.hidden).length;
      if(activeOfType<=1)rubric[index]={...rubric[index],hidden:true};else rubric.splice(index,1);
      updateQuestion(st,user,question.id,{rubric});
    }),'Đã cập nhật form.');
  });
  app.querySelectorAll('[data-action="add-rubric-row"]').forEach(b=>b.onclick=async()=>{
    await saveBuilderDraft({silent:true});
    await act(()=>repo.transaction(st=>{
      const question=byId(st.questions,b.dataset.id);if(!question)return;
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
  app.querySelectorAll('[data-action="back-grading"]').forEach(b=>b.onclick=()=>{ui.view='admin';ui.adminTab='grading';render();});
  app.querySelectorAll('[data-action="save-grade"]').forEach(b=>b.onclick=()=>saveGrade(false));
  app.querySelectorAll('[data-action="publish-result"]').forEach(b=>b.onclick=()=>saveGrade(true));
}

async function saveGrade(andPublish){
  const attempt=byId(data.attempts,ui.gradeAttemptId);
  if(!attempt)return;
  const scores={};
  app.querySelectorAll('.manual-score').forEach(i=>{if(i.value!=='')scores[i.dataset.skill]=Number(i.value);});
  const feedback=document.getElementById('gradeFeedback')?.value||'';
  const saved=await act(()=>repo.transaction(st=>saveManualScore(st,user,attempt.id,{scores,feedback})),andPublish?null:'Đã lưu điểm tạm.',{rerender:false});
  if(!saved)return;
  data=await repo.getState();
  const fresh=byId(data.attempts,attempt.id);
  if(andPublish){
    if(fresh.status!==ATTEMPT_STATUS.READY){notify('Cần chấm đủ các phần trước khi công bố.');render();return;}
    const published=await act(()=>repo.transaction(st=>publishAttempt(st,user,attempt.id)),'Đã công bố kết quả và xếp email thông báo.',{rerender:false});
    if(published){data=await repo.getState();ui.view='admin';ui.adminTab='grading';render();}
  }else render();
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

const directBuilderId=new URL(window.location.href).searchParams.get('edit');
const directBuilderExam=directBuilderId&&byId(data.exams,directBuilderId);
if(directBuilderExam&&user&&!isStudent(user)&&canEditExam(user,directBuilderExam))await openBuilder(directBuilderId);
else render();
