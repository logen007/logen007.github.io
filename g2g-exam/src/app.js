import {createRepository} from './repository.js';
import {
  ATTEMPT_STATUS,byId,isMaster,isStudent,canEditExam,canGradeExam,
  createQuestion,updateQuestion,softDeleteQuestion,restoreQuestion,permanentlyDeleteQuestion,
  createExam,updateExam,softDeleteExam,restoreExam,permanentlyDeleteExam,
  addSection,removeSection,moveSection,updateSection,addQuestionsToSection,
  removeQuestionFromSection,moveQuestion,requestGrading,resolveGradingRequest,
  startAttempt,saveAnswer,setAttemptSection,getSectionRemainingSeconds,submitAttempt,
  saveManualScore,publishAttempt,publishExam
} from './core.js';
import {uploadQuestionAudio} from './media.js';
import {countWords} from './ui/format.js';
import {topbarHtml} from './ui/layout.js';
import {
  loginHtml,studentHomeHtml,studentResultsHtml,examHtml,submittedHtml
} from './views/student.js';
import {
  adminShellHtml,examAdminHtml,bankAdminHtml,gradingAdminHtml,gradesAdminHtml,
  teachersAdminHtml,trashAdminHtml
} from './views/admin.js';
import {examBuilderHtml,gradingDetailHtml} from './views/builder.js';
import {
  questionModalHtml,bankPickerHtml,previewExamModalHtml,previewQuestionModalHtml,
  studentGradeModalHtml
} from './views/modals.js';

const app=document.getElementById('app');
const toast=document.getElementById('toast');
const repo=await createRepository();
let data=await repo.getState();
let user=await repo.getCurrentUser();
let timerHandle=null;
let timerBusy=false;
let realtimeRenderTimer=null;
const saveTimers=new Map();
const GOETHE_A1_PARTS=[
  ['Nghe 1','Nghe',6,20],['Nghe 2','Nghe',4,20],['Nghe 3','Nghe',5,20],
  ['Đọc 1','Đọc',5,25],['Đọc 2','Đọc',5,25],['Đọc 3','Đọc',5,25],
  ['Viết 1','Viết',1,20],['Viết 2','Viết',1,20]
];

const ui={
  view:user?(isStudent(user)?'student-home':'admin'):'login',
  adminTab:'exams',examId:null,attemptId:null,builderExamId:null,builderSectionId:null,
  gradeAttemptId:null,gradeMode:'best',online:navigator.onLine,
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
  return topbarHtml({user,mode:repo.mode,online:ui.online})+content;
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
  startExamTimer(attempt,exam,sectionIndex);
}

function bindExamInputs(attempt,questions){
  app.querySelectorAll('.answer-one').forEach(el=>el.onchange=()=>queueAnswer(attempt.id,el.dataset.q,el.value===''?null:Number(el.value),0));
  app.querySelectorAll('.answer-match').forEach(el=>el.onchange=()=>{
    const qid=el.dataset.q,q=questions.find(x=>x.id===qid),values=Array(q?.pairs?.length||0).fill('');
    app.querySelectorAll(`.answer-match[data-q="${qid}"]`).forEach(x=>values[Number(x.dataset.i)]=x.value);
    queueAnswer(attempt.id,qid,values,0);
  });
  app.querySelectorAll('.answer-text').forEach(el=>{
    el.oninput=()=>{
      const counter=el.parentElement?.querySelector('.word-count');
      if(counter)counter.textContent=countWords(el.value);
      queueAnswer(attempt.id,el.dataset.q,el.value,700);
    };
    el.onblur=()=>queueAnswer(attempt.id,el.dataset.q,el.value,0);
  });
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

function queueAnswer(attemptId,qid,value,delay){
  const key=`${attemptId}:${qid}`;
  clearTimeout(saveTimers.get(key));
  const saveState=document.getElementById('saveState');
  if(saveState)saveState.textContent='Đang lưu...';
  saveTimers.set(key,setTimeout(async()=>{
    await act(()=>repo.transaction(st=>saveAnswer(st,user,attemptId,qid,value)),null,{rerender:false});
    const el=document.getElementById('saveState');
    if(el)el.textContent='Đã lưu';
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
  const section=exam.sections[sectionIndex],el=document.getElementById('examTimer');
  if(section.showTimer===false){if(el)el.textContent='—';return;}
  const tick=async()=>{
    const left=getSectionRemainingSeconds(attempt,exam,sectionIndex);
    if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
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
  else if(ui.adminTab==='bank')content=bankAdminHtml({data,user});
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

function bankPicker(){
  const exam=byId(data.exams,ui.builderExamId),section=exam?.sections.find(s=>s.id===ui.builderSectionId);
  if(!section)return;
  app.insertAdjacentHTML('beforeend',bankPickerHtml({data,user,exam,section}));
  bindModalClose();
  const items=[...app.querySelectorAll('.bank-pick')],rows=[...app.querySelectorAll('.dong-chon')];
  const all=document.getElementById('selectAllBank'),count=document.getElementById('pickCount'),search=document.getElementById('pickerSearch'),level=document.getElementById('pickerLevel'),skill=document.getElementById('pickerSkill');
  const visibleRows=()=>rows.filter(r=>r.style.display!=='none');
  const syncCount=()=>{
    const n=items.filter(x=>x.checked).length,vis=visibleRows(),visInputs=vis.map(r=>r.querySelector('.bank-pick'));
    count.textContent=`Đã chọn ${n} câu`;
    all.checked=visInputs.length>0&&visInputs.every(x=>x.checked);
    all.indeterminate=visInputs.some(x=>x.checked)&&!visInputs.every(x=>x.checked);
  };
  const filter=()=>{
    const q=search.value.toLowerCase().trim();
    rows.forEach(r=>{r.style.display=(!q||r.dataset.search.includes(q))&&(!level.value||r.dataset.level===level.value)&&(!skill.value||r.dataset.skill===skill.value)?'':'none';});
    syncCount();
  };
  all.onchange=()=>{visibleRows().forEach(r=>r.querySelector('.bank-pick').checked=all.checked);syncCount();};
  items.forEach(x=>x.onchange=syncCount);
  search.oninput=filter;level.onchange=filter;skill.onchange=filter;
  filter();
  document.getElementById('addPicked').onclick=async()=>{
    const ids=items.filter(x=>x.checked).map(x=>x.value);
    const result=await act(()=>repo.transaction(st=>updateSection(st,user,exam.id,section.id,{questionIds:ids})),'Đã cập nhật câu hỏi trong phần.',{rerender:false});
    if(result!==null){closeModal();data=await repo.getState();render();}
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
  else if(ui.view==='submitted')submittedView();
  else if(ui.view==='builder')examBuilderView();
  else if(ui.view==='grading-detail')gradingDetailView();
  else adminView();
  bindGlobal();
  bindViewSpecific();
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
  app.querySelectorAll('[data-action="admin-tab"]').forEach(b=>b.onclick=()=>{ui.adminTab=b.dataset.tab;ui.view='admin';render();});
  app.querySelectorAll('[data-action="new-question"]').forEach(b=>b.onclick=()=>questionModal(null,ui.view==='builder'?async q=>{const ex=byId(data.exams,ui.builderExamId),sec=ex?.sections.find(s=>s.id===ui.builderSectionId);if(ex&&sec)await act(()=>repo.transaction(st=>addQuestionsToSection(st,user,ex.id,sec.id,[q.id])),'Đã thêm câu vào phần.');}:null));
  app.querySelectorAll('[data-action="edit-a1-group"]').forEach(b=>b.onclick=async()=>{
    const exam=byId(data.exams,ui.builderExamId),section=exam?.sections.find(s=>s.id===ui.builderSectionId);
    if(!exam||!section)return;
    if((exam.provider&&exam.provider!=='GOETHE')||exam.level!=='A1'){
      notify('Template cụm này hiện chỉ áp dụng cho Goethe A1 · Nghe · Phần 1.');
      return;
    }
    const existingId=section.questionIds.map(id=>byId(data.questions,id)?.groupId).find(Boolean)||null;
    const {openA1ListeningPart1Editor}=await import('./question-groups/bootstrap.js');
    const commit=ops=>repo.transaction(st=>{for(const op of ops){st[op.collection]||=[];const i=st[op.collection].findIndex(x=>x.id===op.id);if(i>=0)st[op.collection][i]=op.item;else st[op.collection].push(op.item);}});
    await openA1ListeningPart1Editor({groupId:existingId,state:data,user,commit,onSaved:async group=>{
      await act(()=>repo.transaction(st=>updateSection(st,user,exam.id,section.id,{questionIds:group.questionIds||[]})),'Đã lưu cụm A1 Nghe Phần 1.');
    }});
  });
  app.querySelectorAll('[data-action="edit-question"]').forEach(b=>b.onclick=()=>questionModal(byId(data.questions,b.dataset.id)));
  app.querySelectorAll('[data-action="preview-question"]').forEach(b=>b.onclick=()=>previewQuestionModal(byId(data.questions,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-question"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa câu hỏi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteQuestion(st,user,b.dataset.id)),'Đã chuyển câu hỏi vào Thùng rác.');});
  app.querySelectorAll('[data-action="new-exam"]').forEach(b=>b.onclick=()=>createNewExam());
  app.querySelectorAll('[data-action="edit-exam"]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.id));
  app.querySelectorAll('[data-action="view-exam"]').forEach(b=>b.onclick=()=>previewExamModal(byId(data.exams,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-exam"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa bài thi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteExam(st,user,b.dataset.id)),'Đã chuyển bài thi vào Thùng rác.');});
  app.querySelectorAll('[data-action="publish-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>publishExam(st,user,b.dataset.id)),'Đã xuất bản bài thi.'));
  app.querySelectorAll('[data-action="save-exam"]').forEach(b=>b.onclick=()=>{
    const exam=byId(data.exams,ui.builderExamId),title=document.getElementById('examTitle')?.value.trim();
    const section=exam?.sections.find(item=>item.id===ui.builderSectionId);
    if(!exam||!title)return;
    act(()=>repo.transaction(st=>{
      updateExam(st,user,exam.id,{title});
      if(section&&exam.provider==='GOETHE'&&exam.level==='A1'){
        updateSection(st,user,exam.id,section.id,{instruction:document.getElementById('sectionInstruction')?.value||''});
        app.querySelectorAll('.goethe-question[data-question-id]').forEach(card=>{
          const id=card.dataset.questionId;
          const titleField=card.querySelector('[data-field="title"]');
          const scoreField=card.querySelector('[data-field="maxScore"]');
          const correct=card.querySelector('[data-field="correct"]:checked');
          const audio=card.querySelector('[data-field="audio"]');
          const choices=[0,1,2].map(index=>card.querySelector(`[data-choice="${index}"]`)?.value.trim()||'Nháp');
          updateQuestion(st,user,id,{title:titleField?.value.trim()||'Nháp',choices,correctAnswer:Number(correct?.value??0),maxScore:Math.max(0,Number(scoreField?.value)||0),audioUrl:audio?.files?.[0]?.name||byId(st.questions,id)?.audioUrl||''});
        });
      }
    }),'Đã lưu bài thi.');
  });
  app.querySelectorAll('[data-action="open-exam-settings"]').forEach(b=>b.onclick=()=>{
    const exam=byId(data.exams,ui.builderExamId);if(!exam)return;
    const modal=document.createElement('div');modal.className='hop-chon';
    modal.innerHTML=`<div class="noi-hop exam-setup"><div class="dau-hop"><div><div class="nhan-muc">CÀI ĐẶT CHUNG</div><h2>${exam.provider||''} ${exam.level||''}</h2></div><button class="nut nho" data-close>×</button></div><div class="exam-setup-grid"><label>Điểm mặc định mỗi câu<input id="defaultQuestionScore" type="number" min="0" value="${Number(exam.settings?.defaultQuestionScore??1)}"></label><label>Thời gian Nghe (phút)<input id="listeningTime" type="number" min="1" value="${Number(exam.settings?.skillTimes?.listening??20)}"></label><label>Thời gian Đọc (phút)<input id="readingTime" type="number" min="1" value="${Number(exam.settings?.skillTimes?.reading??25)}"></label><label>Thời gian Viết (phút)<input id="writingTime" type="number" min="1" value="${Number(exam.settings?.skillTimes?.writing??20)}"></label></div><div class="chan-hop"><span></span><div class="nhom-nut"><button class="nut" data-close>Hủy</button><button class="nut chinh" id="saveExamSettings">Lưu</button></div></div></div>`;
    document.body.append(modal);modal.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modal.remove());
    modal.querySelector('#saveExamSettings').onclick=()=>{const n=id=>Math.max(1,Number(modal.querySelector(id).value)||1);act(()=>repo.transaction(st=>updateExam(st,user,exam.id,{settings:{defaultQuestionScore:Math.max(0,Number(modal.querySelector('#defaultQuestionScore').value)||0),skillTimes:{listening:n('#listeningTime'),reading:n('#readingTime'),writing:n('#writingTime')}}})),'Đã lưu cài đặt chung.');modal.remove();};
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
  bindFilters();
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
      const available=provider==='TELC'?['B1','B2']:['A1','A2','B1','B2'];
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
  const isGoetheA1=provider.toUpperCase()==='GOETHE'&&level==='A1';
  const stamp=Date.now();
  const sections=isGoetheA1?GOETHE_A1_PARTS.map(([name,skill,questionLimit,timeMinutes],index)=>({id:`sec-${stamp}-${index+1}`,name,skill,questionLimit,timeMinutes,maxScore:0,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]})):[{id:`sec-${stamp}-1`,name:'Phần 1',timeMinutes:30,maxScore:0,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]}];
  const exam=await act(()=>repo.transaction(st=>{
    const created=createExam(st,user,{title,level,provider:provider.toUpperCase(),sections});
    if(isGoetheA1){
      for(const section of created.sections){
        const ids=[];
        for(let index=0;index<Number(section.questionLimit)||0;index++){
          const question=createQuestion(st,user,{level,skill:section.skill,part:section.name,type:'single',title:'Nháp',choices:['Nháp','Nháp','Nháp'],correctAnswer:0,maxScore:1});
          ids.push(question.id);
        }
        addQuestionsToSection(st,user,created.id,section.id,ids);
      }
    }
    return created;
  }),null,{rerender:false});
  if(exam){data=await repo.getState();openBuilder(exam.id);}
}

async function openBuilder(id){
  let exam=byId(data.exams,id);
  const needsGoetheA1Migration=exam?.provider==='GOETHE'&&exam.level==='A1'&&GOETHE_A1_PARTS.some(([name])=>!exam.sections.some(section=>section.name===name));
  if(needsGoetheA1Migration){
    await repo.transaction(st=>{
      const stored=byId(st.exams,id);
      const legacyFirst=stored.sections?.[0];
      const parts=GOETHE_A1_PARTS.map(([name,skill,questionLimit,timeMinutes],index)=>({
        id:index===0&&legacyFirst?.id?legacyFirst.id:`sec-${Date.now()}-${index+1}`,
        name,skill,questionLimit,timeMinutes,maxScore:0,showTimer:true,autoSubmit:true,shuffle:false,
        instruction:index===0?legacyFirst?.instruction||'':'',questionIds:index===0?legacyFirst?.questionIds||[]:[]
      }));
      updateExam(st,user,stored.id,{sections:parts});
      for(const section of byId(st.exams,id).sections){
        const required=Number(section.questionLimit)||0;
        const additions=[];
        for(let index=section.questionIds.length;index<required;index++){
          additions.push(createQuestion(st,user,{level:stored.level,skill:section.skill,part:section.name,type:'single',title:'Nháp',choices:['Nháp','Nháp','Nháp'],correctAnswer:0,maxScore:1}).id);
        }
        if(additions.length)addQuestionsToSection(st,user,stored.id,section.id,additions);
      }
    });
    data=await repo.getState();
    exam=byId(data.exams,id);
  }
  ui.builderExamId=id;
  ui.builderSectionId=exam?.sections?.[0]?.id||null;
  ui.view='builder';
  render();
}

function bindBuilder(){
  const exam=byId(data.exams,ui.builderExamId);
  if(!exam)return;
  app.querySelectorAll('[data-action="edit-a1-group"]').forEach(button=>{
    if((exam.provider&&exam.provider!=='GOETHE')||exam.level!=='A1'){
      button.disabled=true;
      button.textContent='Template phần này sẽ cấu hình riêng';
    }
  });
  app.querySelectorAll('[data-action="back-admin"]').forEach(b=>b.onclick=()=>{ui.view='admin';ui.adminTab='exams';render();});
  app.querySelectorAll('[data-action="select-section"]').forEach(b=>b.onclick=e=>{if(e.target.closest('.phan-tool'))return;ui.builderSectionId=b.dataset.id;render();});
  app.querySelectorAll('[data-action="add-section"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>addSection(st,user,exam.id,{name:'Phần mới',timeMinutes:30})),'Đã thêm phần.'));
  app.querySelectorAll('[data-action="move-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();act(()=>repo.transaction(st=>moveSection(st,user,exam.id,b.dataset.id,b.dataset.dir)));});
  app.querySelectorAll('[data-action="remove-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(confirm('Bỏ phần này khỏi bài thi?'))act(()=>repo.transaction(st=>removeSection(st,user,exam.id,b.dataset.id)),'Đã bỏ phần.');});
  app.querySelectorAll('[data-action="move-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>moveQuestion(st,user,exam.id,ui.builderSectionId,b.dataset.id,b.dataset.dir))));
  app.querySelectorAll('[data-action="remove-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã bỏ câu khỏi phần.'));
  app.querySelectorAll('[data-action="add-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>{
    const section=exam.sections.find(item=>item.id===ui.builderSectionId);
    if(!section)return;
    const question=createQuestion(st,user,{level:exam.level,skill:section.skill||section.name,part:section.name,type:'single',title:'Nháp',choices:['Nháp','Nháp','Nháp'],correctAnswer:0,maxScore:Number(exam.settings?.defaultQuestionScore??1)});
    addQuestionsToSection(st,user,exam.id,section.id,[question.id]);
    if(b.dataset.after){
      const ids=[...section.questionIds];
      const from=ids.indexOf(question.id),after=ids.indexOf(b.dataset.after);
      if(from>=0&&after>=0){ids.splice(from,1);ids.splice(after+1,0,question.id);updateSection(st,user,exam.id,section.id,{questionIds:ids});}
    }
  }),'Đã thêm câu hỏi.'));
  app.querySelectorAll('[data-action="remove-inline-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,exam.id,ui.builderSectionId,b.dataset.id)),'Đã xóa câu hỏi.'));
  app.querySelectorAll('[data-action="open-bank-picker"]').forEach(b=>b.onclick=bankPicker);
  const title=document.getElementById('examTitle');
  if(title)title.onchange=()=>act(()=>repo.transaction(st=>updateExam(st,user,exam.id,{title:title.value})),'Đã đổi tên bài thi.');
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

function bindFilters(){
  const search=document.getElementById('bankSearch'),level=document.getElementById('bankLevel'),skill=document.getElementById('bankSkill');
  if(!search||!level||!skill)return;
  const filter=()=>app.querySelectorAll('#bankRows tr[data-search]').forEach(row=>{
    row.style.display=(!search.value||row.dataset.search.includes(search.value.toLowerCase()))&&(!level.value||row.dataset.level===level.value)&&(!skill.value||row.dataset.skill===skill.value)?'':'none';
  });
  search.oninput=filter;level.onchange=filter;skill.onchange=filter;
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

render();
