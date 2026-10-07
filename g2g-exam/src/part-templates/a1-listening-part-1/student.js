import {templateRequest} from '../shared/api.js';
import {getA1ListeningPart1Spec,audioPolicyFromSpec} from './spec.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const choiceText=choice=>choice&&typeof choice==='object'?String(choice.text||''):String(choice||'');
const choiceImage=choice=>choice&&typeof choice==='object'?String(choice.imageUrl||''):'';

export async function mountStudentRuntime({state:initialState=null,examRoot:initialRoot=null}={}){
  const examRoot=initialRoot||document.querySelector('.thi');
  if(!examRoot||examRoot.dataset.a1ListeningPart1Enhanced==='1')return;
  let state=initialState;if(!state){try{state=await templateRequest('/state');}catch{return;}}
  const spec=await getA1ListeningPart1Spec(),policy=audioPolicyFromSpec(spec);
  const visibleIds=[...examRoot.querySelectorAll('.cau-thi[data-q]')].map(node=>node.dataset.q);
  const attempt=(state.attempts||[]).find(item=>item.status==='in_progress'&&visibleIds.some(id=>(item.currentQuestionIds||[]).includes(id)));
  if(!attempt)return;
  const exam=(state.exams||[]).find(item=>item.id===attempt.examId);if(!exam)return;
  const section=(exam.sections||[]).find(item=>item.id===attempt.currentSectionId)||(exam.sections||[]).find(item=>(item.questionIds||[]).some(id=>visibleIds.includes(id)));
  if(!section||section.templateType!==spec.template)return;
  const partQuestions=(section.questionIds||[]).map(id=>(state.questions||[]).find(q=>q.id===id)).filter(q=>q&&visibleIds.includes(q.id));
  if(!partQuestions.length)return;
  examRoot.dataset.a1ListeningPart1Enhanced='1';
  const firstNode=examRoot.querySelector(`.cau-thi[data-q="${CSS.escape(partQuestions[0].id)}"]`);if(!firstNode)return;
  const intro=document.createElement('div');intro.className='qg-listen-intro';
  const sectionSession=attempt.audioSessions?.[section.id];
  const started=sectionSession?.startedAt;
  const instruction=section.instruction||'';
  intro.innerHTML=`<h3>Đề bài</h3><div>${esc(instruction)}</div><div style="margin-top:12px"><button class="nut chinh tpl-start-listen" ${started?'disabled':''}>${started?'Audio đã được sử dụng':'Bắt đầu nghe'}</button><div class="qg-listen-status">${started?'Phiên nghe đã bắt đầu trước đó và không thể phát lại.':`Khi bắt đầu, audio chạy liên tục. Mỗi mảnh phát ${policy.segmentRepeat} lần.`}</div></div>`;
  firstNode.insertAdjacentElement('beforebegin',intro);
  const audioElements=[];
  for(const question of partQuestions){
    const node=examRoot.querySelector(`.cau-thi[data-q="${CSS.escape(question.id)}"]`);if(!node)continue;
    const wrap=node.querySelector('.audio-thi');if(wrap){wrap.style.display='none';const audio=wrap.querySelector('audio');if(audio){audio.controls=Boolean(policy.controls);audioElements.push({question,audio});}}
    const select=node.querySelector('.answer-one');
    if(select&&Array.isArray(question.choices)&&question.choices.some(choice=>typeof choice==='object')){
      const list=document.createElement('div');list.className='qg-choice-list';
      question.choices.slice(0,3).forEach((choice,index)=>{const label=document.createElement('label');label.className='qg-answer';const image=choiceImage(choice);label.innerHTML=`<div><input type="radio" name="tpl-${esc(question.id)}" value="${index}" ${String(attempt.answers?.[question.id])===String(index)?'checked':''}><b>${String.fromCharCode(65+index)}.</b> ${esc(choiceText(choice))}</div>${image?`<img src="${esc(image)}" alt="Đáp án ${String.fromCharCode(65+index)}">`:''}`;label.querySelector('input').onchange=async()=>{await templateRequest('/actions/saveAnswers',{method:'POST',body:{attemptId:attempt.id,answers:{[question.id]:index}}});const save=document.getElementById('saveState');if(save)save.textContent='Đã lưu';};list.appendChild(label);});
      select.replaceWith(list);
    }
  }
  const button=intro.querySelector('.tpl-start-listen'),status=intro.querySelector('.qg-listen-status');
  if(button&&!started)button.onclick=async()=>{
    button.disabled=true;
    try{
      await templateRequest('/actions/startPartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:section.id}});
      for(let index=0;index<audioElements.length;index++)for(let repeat=0;repeat<Math.max(1,policy.segmentRepeat);repeat++){
        status.textContent=`Đang nghe mảnh ${index+1}/${audioElements.length} · lượt ${repeat+1}/${policy.segmentRepeat}`;
        await playLocked(audioElements[index].audio,policy);
      }
      await templateRequest('/actions/completePartAudio',{method:'POST',body:{attemptId:attempt.id,sectionId:section.id}});
      status.textContent='Đã nghe hết audio. Phiên nghe đã khóa.';button.textContent='Đã hoàn thành audio';
    }catch(error){status.textContent=`Audio đã khóa. ${error.message}`;button.textContent='Không thể phát lại';}
  };
}

function playLocked(audio,policy){
  return new Promise((resolve,reject)=>{
    let active=true;const cleanup=()=>{active=false;audio.onended=null;audio.onerror=null;audio.onpause=null;audio.onseeking=null;};
    audio.controls=Boolean(policy.controls);audio.currentTime=0;
    audio.onseeking=()=>{if(active&&!policy.replayAllowed&&audio.currentTime<0)audio.currentTime=0;};
    audio.onpause=()=>{if(active&&!policy.pauseAllowed&&!audio.ended)setTimeout(()=>audio.play().catch(()=>{}),0);};
    audio.onended=()=>{cleanup();resolve();};audio.onerror=()=>{cleanup();reject(new Error('Không phát được một mảnh audio.'));};
    audio.play().catch(error=>{cleanup();reject(error);});
  });
}
