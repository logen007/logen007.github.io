import {isPrefilledQuestion,imageMaxWidth} from '../domain/question-display.js';
import {letterAnswersHtml} from '../ui/letter-answers.js';
import {partAudioSegments} from '../domain/part-audio.js';
import {examDurationSeconds} from '../domain/exam-clock.js';
import {
  ATTEMPT_STATUS,byId,getPublishedExams,getStudentResults,getLatestPublishedAttempt,
  getBestPublishedAttempt,summarizeExam
} from '../core.js';
import {esc,fmtDate,statusClass,statusText,countWords} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {writingPointLayout,isScoredWritingField,isRequiredWritingField} from '../domain/writing-form.js';
import {writingFormDisplay} from '../ui/writing-form.js';
import {resultClass} from '../domain/gradebook.js';
import {STUDENT_LEVELS,examLearningLevel,normalizeStudentLevel} from '../domain/student-profile.js';
import {resultSummaryHtml} from './result-summary.js';
import {studentProfileCardHtml} from './student-profile-card.js';

export function loginHtml({mode}){
  const demo=mode==='local'?`<div class="che-do-demo"><div class="phu-de">Tài khoản thử nghiệm</div><div class="chon-demo"><button class="nut full demo-login" data-id="student-a">Vào vai Học viên</button><button class="nut full demo-login" data-id="teacher-lan">Vào vai Cô Lan</button><button class="nut full demo-login" data-id="master-1">Vào vai Quản trị cấp cao</button></div></div>`:'';
  return `<main class="landing"><div class="landing-main"><section class="landing-copy"><span class="landing-kicker">LUYỆN THI TIẾNG ĐỨC · G2G CAREER</span><h1>Thi thử trước.<br>Tự tin khi thi thật.</h1><p>Luyện tập với các bộ đề mô phỏng trải nghiệm thi thật, theo dõi kết quả và cải thiện từng kỹ năng.</p><span class="landing-free">✓ Hoàn toàn miễn phí</span><button class="dang-nhap-google landing-cta" id="googleLogin">Bắt đầu luyện thi ngay</button>${demo}</section><div class="landing-mockup" aria-label="Minh họa giao diện làm bài"><div class="mockup-bar"><span></span><span></span><span></span><b>Goethe A1 · Thi thử</b></div><div class="mockup-body"><small>ĐỌC · BÀI 2</small><h2>Sie suchen einen Deutschkurs.</h2><div class="mockup-choice"><i></i><span>Deutsch am Vormittag</span></div><div class="mockup-choice selected"><i></i><span>Deutsch am Abend</span></div><div class="mockup-progress"><span></span></div><small>Câu 6 / 10</small></div></div></div><section class="landing-bottom"><div><h2>Đề luyện hiện có</h2><div class="landing-types" id="landingTypes"><span>Đang tải đề luyện...</span></div></div><div class="landing-metrics" id="landingMetrics" aria-live="polite"></div></section><footer>Được phát triển bởi G2G Career – Phát triển Nhân lực Quốc Tế</footer></main>`;
}

export function studentHomeHtml({data,user,filter='all',levelFilter=''}){
  const exams=getPublishedExams(data);
  const attempts=getStudentResults(data,user.id);
  const latest=getLatestPublishedAttempt(data,user.id),best=getBestPublishedAttempt(data,user.id);
  const latestExam=latest&&byId(data.exams,latest.examId);
  const types=['GOETHE','TELC'];
  const visible=exams.filter(ex=>(filter==='all'||ex.provider===filter)&&(!levelFilter||examLearningLevel(ex)===levelFilter));
  return `<main class="khung">${studentProfileCardHtml(data,user)}<div class="exam-filter" aria-label="Lọc đề thi"><label class="filter-field">Loại đề<select data-exam-provider-filter><option value="all">Tất cả</option>${types.map(type=>`<option value="${esc(type)}" ${filter===type?'selected':''}>${esc(type)}</option>`).join('')}</select></label><label class="filter-field">Trình độ<select data-exam-level-filter><option value="">Tất cả</option>${STUDENT_LEVELS.map(level=>`<option ${levelFilter===level?'selected':''}>${level}</option>`).join('')}</select></label><button class="nut" data-action="enter-code">Nhập mã đề</button></div><section class="danh-sach-de">${visible.map(ex=>studentExamCardHtml(ex,attempts,data)).join('')||'<p>Chưa có đề luyện thuộc loại này.</p>'}</section></main>`;
}

export function studentExamCardHtml(ex,attempts,data){
  const mine=attempts.filter(a=>a.examId===ex.id);
  const published=mine.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const latest=[...published].sort((a,b)=>String(b.publishedAt||b.submittedAt||b.startedAt).localeCompare(String(a.publishedAt||a.submittedAt||a.startedAt)))[0];
  const sum=summarizeExam(ex,data);
  const mins=examDurationSeconds(ex)/60;
  const provider=String(ex.provider||'').trim();
  const latestResult=latest?.result||'Chưa đạt';
  const latestLine=latest?`Lần thi gần nhất <strong>${esc(latest.totalScore??'—')}</strong> điểm - <span class="exam-latest-result ${resultClass(latestResult)}">${esc(latestResult)}</span>`:'Chưa từng thi';
  return `<article class="the the-de"><span class="nhan">${esc(provider?`${provider.charAt(0).toUpperCase()}${provider.slice(1).toLowerCase()} ${ex.level}`:ex.level)}</span>${published.length?'':'<span class="the-de-new">Mới</span>'}<h3>${esc(ex.title)}</h3><div class="meta">${sum.sections} phần · ${ex.questionCount??sum.questions} câu · ${mins} phút</div><div class="day"></div><div class="chan"><span>${latestLine}</span></div><div class="hanh-dong">${ex.hidden?`<button class="nut chinh" data-action="enter-code" data-exam="${esc(ex.id)}" ${ex.hasActiveCodes&&!ex.allCodesUsed?'':'disabled'}>${ex.allCodesUsed?'Đã sử dụng lượt thi':ex.hasActiveCodes?'Nhập mã':'Không có mã thi'}</button>`:`<button class="nut chinh" data-action="start" data-exam="${ex.id}">Bắt đầu thi</button>`}</div></article>`;
}

export {studentResultsHtml} from './student-results.js';

export function studentAttemptDetailHtml({review}){
  const attempt=review.attempt||{},score=review.score;
  const text=value=>value&&typeof value==='object'?JSON.stringify(value):String(value??'Chưa trả lời');
  const option=(q,index)=>{if(index==null||index==='')return 'Chưa trả lời';const value=q.choices?.[Number(index)];return typeof value==='object'?value.text||String(index):value||String(index);};
  const answer=q=>{
    if(q.fields?.length){
      return q.fields.filter(field=>!['heading','note','image','signature'].includes(field.type)).map(field=>`<div class="review-field"><b>${esc(field.label||'Ô trả lời')}</b><span>${esc(text(q.answer?.[field.index]))}</span>${score&&field.expected?`<small>Đáp án: ${esc(field.expected)}</small>`:''}</div>`).join('');
    }
    const given=['single','truefalse','cloze'].includes(q.type)?option(q,q.answer):text(q.answer);
    const expected=score&&q.correct!=null?option(q,q.correct):null;
    const verdict=expected!=null&&q.answer!=null?(String(q.answer)===String(q.correct)?'Đúng':'Sai'):null;
    return `<span>Bạn trả lời: ${esc(given)} ${verdict?`· ${verdict}`:''}</span>${expected!=null?`<span>Đáp án đúng: ${esc(expected)}</span>`:''}`;
  };
  return `<main class="khung grading-detail"><div class="tieu-de-trang"><div><h1>${esc(attempt.examTitle||'Bài làm')}</h1><p>Lần #${attempt.attemptNo} · ${fmtDate(attempt.submittedAt||attempt.startedAt)}</p></div><button class="nut" data-action="student-results">Quay lại</button></div>${resultSummaryHtml(score?.summary)}${score?.promotion?`<section class="the"><h2>Chúc mừng bạn đã đạt trình độ ${esc(normalizeStudentLevel(score.promotion.toLevel))}!</h2><p>${esc(normalizeStudentLevel(score.promotion.fromLevel))} → ${esc(normalizeStudentLevel(score.promotion.toLevel))}</p></section>`:''}${score?`<section class="the review-summary"><b>Điểm: ${esc(score.total??'—')}</b><span>${esc(score.result==='Chưa đạt'?'Trượt':score.result||'—')}</span><span>Người chấm: ${esc(score.reviewerName||'—')}</span>${score.feedback?`<p>Nhận xét: ${esc(score.feedback)}</p>`:''}</section>`:'<div class="the">Bài đã lưu. Điểm và nhận xét sẽ hiển thị sau khi giáo viên chấm xong.</div>'}${(review.sections||[]).map(section=>`<section class="the review-section"><h2>${esc(section.name)}</h2>${score&&score.sections?.[section.name]!=null?`<p>${esc(score.sections[section.name])} điểm</p>`:''}${section.questions.map(q=>`<div class="grading-answer"><b>${esc(q.title)}</b>${answer(q)}</div>`).join('')}</section>`).join('')}</main>`;
}

export function examHtml({attempt,exam,sectionIndex,questions,allQuestions=[],online,preview=false,previewSummary=null}){
  const sec=exam.sections[sectionIndex];
  const orderedQuestions=questions.map((q,originalIndex)=>({q,originalIndex})).sort((a,b)=>Number(Boolean(isPrefilledQuestion(b.q)))-Number(Boolean(isPrefilledQuestion(a.q))));
  const requiredQuestions=questions.filter(q=>!isPrefilledQuestion(q));
  const answered=requiredQuestions.filter(q=>answerPresent(attempt.answers?.[q.id],q)).length;
  const previousAction=preview?'preview-prev-section':'prev-section';
  const nextAction=preview?(sectionIndex===exam.sections.length-1?'close-preview':'preview-next-section'):(sectionIndex===exam.sections.length-1?'submit-exam':'next-section');
  const nextLabel=sectionIndex===exam.sections.length-1?(preview?'Zur Bearbeitung':'Abgeben'):'Weiter';
  const sectionInstruction=sec.instruction||sec.instructionImageUrl?`<section class="exam-instruction">${sec.instruction?`<div><p>${esc(sec.instruction)}</p></div>`:''}${sec.instructionImageUrl?`<img ${imageMaxWidth(sec.instructionImageMaxWidth)?`style="max-width:${imageMaxWidth(sec.instructionImageMaxWidth)}px"`:''} src="${esc(sec.instructionImageUrl)}" alt="Abbildung zur Aufgabenstellung">`:''}</section>`:'';
  const sectionAudio=sectionAudioHtml(sec,orderedQuestions.map(item=>item.q),attempt,{preview});
  const currentCount=`<span data-current-answer-count aria-label="Beantwortete Aufgaben">${answered}/${requiredQuestions.length}</span>`;
  const knownQuestions=new Map((allQuestions||[]).map(question=>[question.id,question]));
  let questionNumber=exam.sections.slice(0,sectionIndex).filter(item=>!sec.questionProfile?.numberWithinSkill||item.skillKey===sec.skillKey).reduce((total,item)=>total+(item.questionIds||[]).filter(id=>!isPrefilledQuestion(knownQuestions.get(id))).length,0);
  let exampleTitleShown=false;
  const questionList=sec.questionProfile?.uniqueLetters?letterAnswersHtml(sec,orderedQuestions.map(item=>item.q),attempt.answers||{},questionNumber):`<section class="to-thi" aria-label="Aufgaben">${orderedQuestions.map(({q,originalIndex})=>{
    const showExampleTitle=Boolean(isPrefilledQuestion(q)&&!exampleTitleShown);if(showExampleTitle)exampleTitleShown=true;
    const hasStimulus=Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length>0;
    return renderQuestionHtml(q,attempt.answers?.[q.id],attempt,{wordRange:sec.questionProfile?.wordRange,sectionInstruction:sec.instruction||'',preview,hideAudio:Boolean(sectionAudio),hasStimulus,questionNumber:isPrefilledQuestion(q)?'_':++questionNumber,showExampleTitle,formFrame:sec.questionProfile?.formFrame===true,mobileThreeChoices:sec.templateType==='A1_LISTENING_PART_1'});
  }).join('')||'<div class="rong">Dieser Teil enthält noch keine Aufgaben.</div>'}</section>`;
  const context=preview
    ?`<div class="exam-context"><div class="exam-title-block"><h1 id="preview-section-title" tabindex="-1">${esc(germanSectionName(sec.name))}</h1></div></div>`
    :`<div class="exam-context"><div class="exam-title-block"><div class="nhan-muc">${esc(exam.level)} · ${esc(exam.title)}</div><h1>${esc(germanSectionName(sec.name))}</h1></div></div>`;
  const body=`<main class="noi-dung-thi">${context}${preview?'':`<div class="exam-free-navigation"><span>Prüfungszeit: <strong id="examMainTime">--:--</strong></span><button class="nut" data-action="submit-exam">Prüfung abgeben</button></div>`}<div class="exam-paper">${sec.questionProfile?.splitLayout?`<div class="exam-reading-split">${sectionInstruction}<div>${sectionAudio}${questionList}</div></div>`:sectionInstruction+sectionAudio+questionList}</div><nav class="dieu-huong-thi" aria-label="Prüfungsnavigation"><button class="nut" data-action="${previousAction}" ${sectionIndex===0?'disabled':''}>${preview?'Vorheriger Teil':'Zurück'}</button>${preview?'':`<span class="tien-do" id="saveState">${currentCount} - <b id="examTimeSummary">--:--</b></span>`}<button class="nut chinh" data-action="${nextAction}">${nextLabel}</button></nav></main>`;
  const header=preview
    ?`<header class="thanh-thi thanh-thi--preview"><strong>${esc(exam.title)}</strong><div class="preview-header-row"><button class="text-link" data-action="close-preview"><span aria-hidden="true">←</span> Zurück</button>${previewOutlineHtml(previewSummary,sectionIndex)}</div></header>`
    :`<header class="thanh-thi"><span class="exam-mobile-brand"><img src="/brand/favicon" alt=""><strong>Deutschprüfung</strong></span><div class="thong-tin-thi"><span>Teil ${sectionIndex+1}/${exam.sections.length}</span></div></header>`;
  const offline=!online?`<div class="offline" role="status">${preview?'Sie sind offline. Vorschauantworten werden nur in dieser Sitzung gespeichert; Audio und Bilder sind möglicherweise nicht verfügbar.':'Sie sind offline. Lassen Sie diese Seite geöffnet; Ihre Antworten werden weiterhin auf diesem Gerät gespeichert.'}</div>`:'';
  return `<div class="thi ${preview?'thi--preview':''}">${header}${offline}${preview?`<div class="preview-shell">${body}</div>`:body}</div>`;
}

function previewOutlineHtml(summary,sectionIndex){
  const {sections=[]}=summary||{};
  return `<div class="preview-outline"><label class="preview-section-picker" for="previewSectionSelect"><span class="sr-only">Teil auswählen</span><select id="previewSectionSelect" class="truong" style="--picker-width:18ch" aria-label="Teil auswählen" data-action="preview-select-section" ${sections.length?'':'disabled'}>${sections.map((item,index)=>`<option value="${index}" ${index===sectionIndex?'selected':''}>${esc(germanSectionName(item.name))}</option>`).join('')}</select></label></div>`;
}

const germanSectionName=name=>String(name||'')
  .replace(/^Nghe\b/i,'Hören').replace(/^Đọc\b/i,'Lesen')
  .replace(/^Viết\b/i,'Schreiben').replace(/^Nói\b/i,'Sprechen')
  .replace(/^(Hören|Lesen|Schreiben|Sprechen)\s+(?!Teil\b)(\d+)$/i,'$1 Teil $2');

export function unansweredExamQuestions(exam,questions,answers){
  const byQuestion=new Map(questions.map(q=>[q.id,q]));
  let number=0;
  return (exam.sections||[]).flatMap(section=>(section.questionIds||[]).flatMap(id=>{
    const q=byQuestion.get(id);
    if(!q||isPrefilledQuestion(q))return [];
    number++;
    return q.type!=='speaking'&&!answerPresent(answers[id],q)?[{id,number,sectionId:section.id}]:[];
  }));
}

export function answerPresent(answer,q){
  if(q.type==='writing'){
    if(Array.isArray(q.rubric)&&q.rubric.length)return q.rubric.every((row,index)=>!isRequiredWritingField(row)||Boolean(String(answer?.[index]??'').trim()));
    return Boolean(String(answer??'').trim());
  }
  if(q.type==='matching')return Array.isArray(answer)&&(q.pairs||[]).every((_,index)=>Boolean(String(answer[index]??'').trim()));
  return answer!==undefined&&answer!==null&&answer!=='';
}

function sectionAudioHtml(section,questions,attempt,{preview=false}={}){
  const policy=section.audioPolicy||{},audioQuestions=questions.filter(question=>String(question.audioUrl||'').trim());
  const policyEnabled=section.skillKey==='listening'&&policy.mode==='per_question_segment';
  const hasSpecialAudio=audioQuestions.some(question=>question.example);
  if(!audioQuestions.length||(!policyEnabled&&!hasSpecialAudio))return '';
  const repeat=Math.max(1,Number(policy.segmentRepeat)||1),key=`g2g.section-audio.${attempt.id}.${section.id}`;
  const used=!preview&&(Boolean(attempt.audioSessions?.[section.id]?.startedAt)||Boolean(sessionStorage.getItem(key)));
  const segments=partAudioSegments(section,questions);
  const audios=segments.map((segment,index)=>`<audio class="section-audio-segment" data-order="${index}" data-repeat="${segment.repeat}" data-label="${esc(segment.label)}" preload="metadata" src="${esc(segment.url)}"></audio>`).join('');
  return `<section class="section-audio" data-section-audio="${esc(section.id)}" data-storage-key="${esc(key)}">${audios}<button type="button" class="section-audio-play" aria-label="Audio abspielen" ${used?'disabled':''}>${iconHtml('play')}</button><div class="section-audio-body"><span class="section-audio-progress" role="progressbar" aria-label="Audiofortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></span><span class="section-audio-status" aria-live="polite">${used?'Audio wurde bereits abgespielt':'Audio kann nur einmal abgespielt werden'}</span></div></section>`;
}

const questionImageUrl=q=>String((Array.isArray(q.instructionBlocks)?q.instructionBlocks[0]?.imageUrl:'')||q.instructionImageUrl||'').trim();

function questionStimulusHtml(q,{hideImage=false}={}){
  const blocks=Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length?q.instructionBlocks:[{text:q.prompt||'',imageUrl:q.instructionImageUrl||''}];
  return blocks.map(block=>{const text=block?.text||'',imageUrl=hideImage?'':String(block?.imageUrl||'').trim();return text||imageUrl?`<section class="question-stimulus">${text?`<div><p>${esc(text)}</p></div>`:''}${imageUrl?`<img src="${esc(imageUrl)}" alt="Abbildung zur Aufgabenstellung">`:''}</section>`:'';}).join('');
}

function questionPromptHtml(text,q){
  const imageUrl=questionImageUrl(q);
  return String(text||'').split(/(\[img\])/gi).map(part=>/^\[img\]$/i.test(part)
    ?(imageUrl?`<span class="question-inline-image"><img src="${esc(imageUrl)}" alt="Abbildung zur Aufgabe"></span>`:'')
    :esc(part)).join('');
}

function exampleAnswer(q){
  if(['single','cloze','truefalse'].includes(q.type))return q.correctAnswer;
  if(q.type==='matching')return (q.pairs||[]).map(pair=>pair[1]);
  if(q.type==='writing'&&Array.isArray(q.rubric))return Object.fromEntries(q.rubric.map((row,index)=>{
    const options=String(row.answers||'').split('|').map(item=>item.trim()).filter(Boolean);
    const value=['choice','truefalse'].includes(row.type)?options[Number(row.correctIndex)||0]||'':options[0]||row.value||'';
    return [index,value];
  }));
  return '';
}

export function renderQuestionHtml(q,answer,attempt,{wordRange=null,sectionInstruction='',preview=false,hideAudio=false,hasStimulus=false,questionNumber=null,showExampleTitle=true,formFrame=false,mobileThreeChoices=false}={}){
  const isExample=Boolean(isPrefilledQuestion(q)),exampleTitle=isExample&&showExampleTitle?'<div class="question-example-title">Beispiel</div>':'';
  if(isExample)answer=exampleAnswer(q);
  if(q.type==='writing'&&(formFrame||q.writingFormVersion===1))return `<div class="cau-thi writing-form-question ${isExample?'is-example':''}" data-q="${esc(q.id)}">${exampleTitle}${writingFormDisplay(q,answer,{readOnly:isExample})}</div>`;
  const played=sessionStorage.getItem(`g2g.audio.${attempt.id}.${q.id}`);
  const audio=!hideAudio&&q.audioUrl?`<div class="audio-thi"><audio id="audio-${q.id}" preload="metadata" src="${esc(q.audioUrl)}"></audio><button class="nut nho chinh play-audio" data-q="${q.id}" title="Das Audio wird gemäß den Prüfungsregeln abgespielt." ${played?'disabled':''}>${played?'Audio abgespielt':'Audio abspielen'}</button>${preview?'':'<span class="phu-de">Das Audio wird gemäß den Prüfungsregeln abgespielt.</span>'}</div>`:'';
  const rawPrompt=String(hasStimulus?q.title||'':q.prompt||q.title||'').trim();
  const normalizedPrompt=rawPrompt.toLocaleLowerCase(),normalizedSection=String(sectionInstruction||'').toLocaleLowerCase();
  const isSharedInstruction=normalizedPrompt.length>12&&normalizedSection.includes(normalizedPrompt);
  const questionText=rawPrompt==='Nháp'||isSharedInstruction?'':rawPrompt;
  const questionAriaText=questionText.replace(/\[img\]/gi,' ').replace(/\s+/g,' ').trim();
  const prompt=`${q.instruction?`<div class="question-instruction">${esc(q.instruction)}</div>`:''}${questionText||questionNumber?`<div class="noi">${questionNumber?`<strong class="question-number">${questionNumber}${questionNumber==='_'?'':'.'}</strong> `:''}${questionPromptHtml(questionText,q)}</div>`:''}`;
  const stimulus=hasStimulus?questionStimulusHtml(q,{hideImage:/\[img\]/i.test(questionText)}):'';
  const head=exampleTitle+stimulus+(prompt||audio?`<div class="preview-question-heading">${prompt?`<div class="preview-question-prompt">${prompt}</div>`:''}${audio}</div>`:'');
  const root=`cau-thi ${isExample?'is-example ':''}${answerPresent(answer,q)?'is-answered':''}`;
  if(['single','cloze','truefalse'].includes(q.type)){
    const choices=(q.choices||[]).map((choice,index)=>({choice,index})).filter(({choice})=>{const text=String(typeof choice==='object'?choice?.text||'':choice||'').trim();return Boolean((text&&text!=='Nháp')||String(typeof choice==='object'?choice?.imageUrl||'':'').trim());});
    return `<div class="${root}" data-q="${q.id}">${head}<div class="answer-options ${choices.some(({choice})=>choice?.imageUrl)?'answer-options--illustrated':''}${mobileThreeChoices?' answer-options--mobile-three':''}" role="radiogroup" aria-label="${esc(questionAriaText||'Antwort auswählen')}">${choices.map(({choice,index})=>{const rawText=typeof choice==='object'?choice.text:choice,text=String(rawText||'').trim()==='Nháp'?'':rawText,imageUrl=typeof choice==='object'?choice.imageUrl||'':'',letter=String.fromCharCode(65+index);return `<label class="answer-option"><input class="${isExample?'':'answer-one'}" type="radio" name="answer-${q.id}" data-q="${q.id}" aria-label="${esc(`${letter}. ${text||''}`)}" value="${index}" ${String(answer)===String(index)?'checked':''} ${isExample?'disabled':''}><span class="answer-option-body">${imageUrl?`<img src="${esc(imageUrl)}" alt="">`:''}<span><strong class="answer-letter">${letter}.</strong> ${esc(text)}</span></span></label>`;}).join('')}</div></div>`;
  }
  if(q.type==='matching')return `<div class="${root}" data-q="${q.id}">${head}${(q.pairs||[]).map((p,i)=>`<div class="matching-row"><b>${esc(p[0])}</b><select class="dap-an ${isExample?'':'answer-match'}" data-q="${q.id}" data-i="${i}" ${isExample?'disabled':''}><option value="">Antwort auswählen</option>${[...new Set((q.pairs||[]).map(x=>x[1]))].map(v=>`<option value="${esc(v)}" ${Array.isArray(answer)&&answer[i]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if(q.type==='writing')return `<div class="${root}" data-q="${q.id}">${head}${wordRange?`<p class="phu-de">Schreiben Sie ${wordRange[0]}–${wordRange[1]} Wörter.</p>`:''}${Array.isArray(q.rubric)&&q.rubric.length?writingFieldsHtml(q,answer,{framed:formFrame}):`<textarea class="viet ${isExample?'':'answer-text'}" data-q="${q.id}" placeholder="Schreiben Sie hier..." ${isExample?'disabled':''}>${esc(answer||'')}</textarea><div class="phu-de" style="text-align:right"><span class="word-count">${countWords(answer||'')}</span> Wörter</div>`}</div>`;
  if(q.type==='speaking')return `<div class="cau-thi" data-q="${q.id}">${head}<div class="goi-y">Der mündliche Teil wird nach den Anweisungen der Lehrkraft oder des Prüfungsraums durchgeführt und manuell bewertet.</div></div>`;
  return `<div class="cau-thi">${head}</div>`;
}

function writingFieldsHtml(q,answer,{framed=false}={}){
  const readOnly=Boolean(isPrefilledQuestion(q)),values=answer&&typeof answer==='object'?answer:{},rows=(q.rubric||[]).map((row,index)=>({...row,index})).filter(row=>!row.hidden);
  const {markers}=writingPointLayout(q.rubric);
  let lastLabel=null,groups=[];
  for(const row of rows){
    const marker=markers[row.index];
    const type=row.type||'text',value=values[row.index]??'',options=String(row.answers||'').split('|').map(item=>item.trim()).filter(Boolean);
    let control='';
    if(type==='heading')control=`<strong class="writing-form-heading">${esc(row.answers||row.label||'')}</strong>`;
    else if(type==='static')control=`<span class="writing-static-value">${esc(row.answers||'')}</span>`;
    else if(type==='image')control=row.imageUrl?`<img class="writing-form-image" src="${esc(row.imageUrl)}" alt="${esc(row.label||'Abbildung')}">`:'';
    else if(type==='truefalse')control=`<div class="writing-binary"><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Richtig" ${value==='Richtig'?'checked':''} ${readOnly?'disabled':''}>Richtig</label><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Falsch" ${value==='Falsch'?'checked':''} ${readOnly?'disabled':''}>Falsch</label></div>`;
    else if(type==='choice')control=`<select class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" ${readOnly?'disabled':''}><option value="">Antwort auswählen</option>${options.map(option=>`<option value="${esc(option)}" ${String(value)===option?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
    else control=`<input class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" value="${esc(value)}" autocomplete="off" ${readOnly?'disabled':''}>`;
    const field=`<div class="writing-display-field writing-display-field--${esc(type)}">${marker?`<span class="writing-point">${marker}</span>`:''}${control}</div>`;
    if(type==='heading'||type==='image'){groups.push({label:'',fields:[field],full:true});lastLabel=null;continue;}
    if(groups.length&&lastLabel===String(row.label||''))groups[groups.length-1].fields.push(field);
    else{groups.push({label:String(row.label||''),fields:[field]});lastLabel=String(row.label||'');}
  }
  return `<div class="writing-response-form${framed?' writing-response-form--framed':''}">${groups.map(group=>`<div class="writing-display-group${group.full?' is-full':''}">${group.label?`<span class="writing-display-label">${esc(group.label)}</span>`:''}<div>${group.fields.join('')}</div></div>`).join('')}</div>`;
}

export function submittedHtml(attempt={}){
  const duration=Number(attempt?.durationSeconds);
  const elapsed=Number.isFinite(duration)?`<p>Thời gian làm bài: <strong>${Math.floor(duration/60)} phút ${duration%60} giây</strong></p>`:'';
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong thanh-cong">✓</div><h1>Đã nộp bài</h1>${elapsed}<span class="nhan vang">ĐANG CHỜ CHẤM</span><p>Khi giáo viên chấm xong, điểm số sẽ được thông báo qua email và hiển thị tại trang kết quả.</p><button class="nut" data-action="student-home" style="margin-top:18px">Về danh sách bài thi</button></section></main>`;
}

export function expiredHtml(){
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong">!</div><h1>Zeit abgelaufen</h1><p>Leider konnten Sie diesen Prüfungsteil nicht rechtzeitig abschließen.</p><button class="nut chinh" data-action="student-home" style="margin-top:18px">Zur Startseite</button></section></main>`;
}
