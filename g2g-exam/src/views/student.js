import {
  ATTEMPT_STATUS,byId,getPublishedExams,getStudentResults,getLatestPublishedAttempt,
  getBestPublishedAttempt,summarizeExam
} from '../core.js';
import {esc,fmtDate,statusClass,statusText,countWords} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {writingPointLayout,isScoredWritingField} from '../domain/writing-form.js';
import {writingFormDisplay} from '../ui/writing-form.js';

export function loginHtml({mode}){
  const demo=mode==='local'?`<div class="che-do-demo"><div class="phu-de">Tài khoản thử nghiệm</div><div class="chon-demo"><button class="nut full demo-login" data-id="student-a">Vào vai Học viên</button><button class="nut full demo-login" data-id="teacher-lan">Vào vai Cô Lan</button><button class="nut full demo-login" data-id="master-1">Vào vai Quản trị cấp cao</button></div></div>`:'';
  return `<main class="landing"><div class="landing-main"><section class="landing-copy"><span class="landing-kicker">LUYỆN THI TIẾNG ĐỨC · G2G CAREER</span><h1>Thi thử trước.<br>Tự tin khi thi thật.</h1><p>Luyện tập với các bộ đề mô phỏng trải nghiệm thi thật, theo dõi kết quả và cải thiện từng kỹ năng.</p><span class="landing-free">✓ Hoàn toàn miễn phí</span><button class="dang-nhap-google landing-cta" id="googleLogin">Bắt đầu luyện thi ngay</button>${demo}</section><div class="landing-mockup" aria-label="Minh họa giao diện làm bài"><div class="mockup-bar"><span></span><span></span><span></span><b>Goethe A1 · Thi thử</b></div><div class="mockup-body"><small>ĐỌC · BÀI 2</small><h2>Sie suchen einen Deutschkurs.</h2><div class="mockup-choice"><i></i><span>Deutsch am Vormittag</span></div><div class="mockup-choice selected"><i></i><span>Deutsch am Abend</span></div><div class="mockup-progress"><span></span></div><small>Câu 6 / 10</small></div></div></div><section class="landing-bottom"><div><h2>Đề luyện hiện có</h2><div class="landing-types" id="landingTypes"><span>Đang tải đề luyện...</span></div></div><div class="landing-metrics" id="landingMetrics" aria-live="polite"></div></section><footer>Được phát triển bởi G2G Career – Phát triển Nhân lực Quốc Tế</footer></main>`;
}

export function studentHomeHtml({data,user,filter='all'}){
  const exams=getPublishedExams(data);
  const attempts=getStudentResults(data,user.id);
  const latest=getLatestPublishedAttempt(data,user.id),best=getBestPublishedAttempt(data,user.id);
  const latestExam=latest&&byId(data.exams,latest.examId);
  const types=[...new Set(exams.map(ex=>[ex.provider,ex.level].filter(Boolean).join(' ')).filter(Boolean))].sort();
  const visible=filter==='all'?exams:exams.filter(ex=>[ex.provider,ex.level].filter(Boolean).join(' ')===filter);
  return `<main class="khung"><div class="tieu-de-trang"><div><h1>Xin chào, ${esc(user.name)}</h1><p>Chọn bài thi để bắt đầu.</p></div><button class="nut" data-action="student-results">Xem toàn bộ kết quả</button></div>${latest?`<section class="the tong-quan-hv"><div class="o"><span>Bài thi gần nhất</span><b>${esc(latestExam?.title||latest.examTitle)}</b><small class="phu-de">${fmtDate(latest.submittedAt)} · Lần #${latest.attemptNo}</small></div><div class="o"><span>Điểm gần nhất</span><b>${latest.totalScore??'—'}</b></div><div class="o"><span>Điểm cao nhất</span><b>${best?.totalScore??'—'}</b></div><div class="o"><span>Số lần thi</span><b>${attempts.length}</b></div><div class="o"><span>Kết quả</span><b class="dat">${esc(latest.result||'—')}</b></div></section>`:''}<div class="exam-filter" aria-label="Lọc loại đề"><button class="nut ${filter==='all'?'chinh':''}" data-action="exam-filter" data-filter="all">Tất cả</button>${types.map(type=>`<button class="nut ${filter===type?'chinh':''}" data-action="exam-filter" data-filter="${esc(type)}">${esc(type)}</button>`).join('')}</div><section class="danh-sach-de">${visible.map(ex=>studentExamCardHtml(ex,attempts,data)).join('')||'<p>Chưa có đề luyện thuộc loại này.</p>'}</section></main>`;
}

export function studentExamCardHtml(ex,attempts,data){
  const mine=attempts.filter(a=>a.examId===ex.id);
  const current=mine.find(a=>a.status===ATTEMPT_STATUS.IN_PROGRESS);
  const waiting=mine.find(a=>a.status===ATTEMPT_STATUS.GRADING||a.status===ATTEMPT_STATUS.READY);
  const published=mine.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const best=[...published].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0];
  const sum=summarizeExam(ex,data);
  const mins=(ex.sections||[]).reduce((n,s)=>n+(Number(s.timeMinutes)||0),0);
  const provider=String(ex.provider||'').trim();
  return `<article class="the the-de"><span class="nhan">${esc(provider?`${provider.charAt(0).toUpperCase()}${provider.slice(1).toLowerCase()} ${ex.level}`:ex.level)}</span>${mine.length?'':'<span class="the-de-new">Mới</span>'}<h3>${esc(ex.title)}</h3><div class="meta">${sum.sections} phần · ${sum.questions} câu · ${mins} phút</div><div class="day"></div><div class="chan"><span>${current?'Đang làm dở':waiting?'Có bài đang chờ chấm':mine.length?`Đã thi ${mine.length} lần`:'Chưa từng thi'}</span>${best?`<b>Cao nhất ${best.totalScore}</b>`:''}</div><div class="hanh-dong">${current?`<button class="nut chinh" data-action="resume" data-exam="${ex.id}" data-attempt="${current.id}">Tiếp tục</button><button class="nut" data-action="restart" data-exam="${ex.id}">Làm lại từ đầu</button>`:`<button class="nut chinh" data-action="start" data-exam="${ex.id}">${mine.length?'Thi lại':'Bắt đầu thi'}</button>`}</div></article>`;
}

export function studentResultsHtml({data,user}){
  const attempts=getStudentResults(data,user.id);
  return `<main class="khung"><div class="tieu-de-trang"><div><h1>Toàn bộ kết quả</h1><p>Bài chưa được giáo viên công bố sẽ không hiển thị điểm.</p></div><button class="nut" data-action="student-home">Quay lại</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Lần thi</th><th>Ngày</th><th>Điểm</th><th>Kết quả</th><th>Người chấm</th><th>Trạng thái</th></tr></thead><tbody>${attempts.map(a=>`<tr><td><button class="table-link" data-action="student-attempt-detail" data-id="${esc(a.id)}">${esc(a.examTitle)}</button></td><td>#${a.attemptNo}</td><td>${fmtDate(a.submittedAt||a.startedAt)}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?(a.totalScore??'—'):'—'}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?esc(a.result==='Chưa đạt'?'Trượt':a.result||'—'):'—'}</td><td>${esc(a.status===ATTEMPT_STATUS.PUBLISHED?a.reviewerName||'—':'—')}</td><td><span class="nhan ${statusClass(a.status)}">${statusText(a.status)}</span></td></tr>`).join('')||'<tr><td colspan="7" class="rong">Chưa có lần thi nào.</td></tr>'}</tbody></table></div></main>`;
}

export function studentAttemptDetailHtml({review}){
  const attempt=review.attempt||{},score=review.score;
  const text=value=>value&&typeof value==='object'?JSON.stringify(value):String(value??'Chưa trả lời');
  const option=(q,index)=>{const value=q.choices?.[Number(index)];return typeof value==='object'?value.text||String(index):value||String(index);};
  const answer=q=>{
    if(q.fields?.length){
      return q.fields.filter(field=>!['heading','note','image','signature'].includes(field.type)).map(field=>`<div class="review-field"><b>${esc(field.label||'Ô trả lời')}</b><span>${esc(text(q.answer?.[field.index]))}</span>${score&&field.expected?`<small>Đáp án: ${esc(field.expected)}</small>`:''}</div>`).join('');
    }
    const given=['single','truefalse','cloze'].includes(q.type)?option(q,q.answer):text(q.answer);
    const expected=score&&q.correct!=null?option(q,q.correct):null;
    const verdict=expected!=null&&q.answer!=null?(String(q.answer)===String(q.correct)?'Đúng':'Sai'):null;
    return `<span>Bạn trả lời: ${esc(given)} ${verdict?`· ${verdict}`:''}</span>${expected!=null?`<span>Đáp án đúng: ${esc(expected)}</span>`:''}`;
  };
  return `<main class="khung grading-detail"><div class="tieu-de-trang"><div><h1>${esc(attempt.examTitle||'Bài làm')}</h1><p>Lần #${attempt.attemptNo} · ${fmtDate(attempt.submittedAt||attempt.startedAt)}</p></div><button class="nut" data-action="student-results">Quay lại</button></div>${score?`<section class="the review-summary"><b>Điểm: ${esc(score.total??'—')}</b><span>${esc(score.result==='Chưa đạt'?'Trượt':score.result||'—')}</span><span>Người chấm: ${esc(score.reviewerName||'—')}</span>${score.feedback?`<p>Nhận xét: ${esc(score.feedback)}</p>`:''}</section>`:'<div class="the">Bài đã lưu. Điểm và nhận xét sẽ hiển thị sau khi giáo viên chấm xong.</div>'}${(review.sections||[]).map(section=>`<section class="the review-section"><h2>${esc(section.name)}</h2>${score&&score.sections?.[section.name]!=null?`<p>${esc(score.sections[section.name])} điểm</p>`:''}${section.questions.map(q=>`<div class="grading-answer"><b>${esc(q.title)}</b>${answer(q)}</div>`).join('')}</section>`).join('')}</main>`;
}

export function examHtml({attempt,exam,sectionIndex,questions,allQuestions=[],online,preview=false,previewSummary=null}){
  const sec=exam.sections[sectionIndex];
  const orderedQuestions=questions.map((q,originalIndex)=>({q,originalIndex})).sort((a,b)=>Number(Boolean(b.q.example))-Number(Boolean(a.q.example)));
  const requiredQuestions=questions.filter(q=>!q.example);
  const answered=requiredQuestions.filter(q=>answerPresent(attempt.answers?.[q.id],q)).length;
  const previousAction=preview?'preview-prev-section':'prev-section';
  const nextAction=preview?(sectionIndex===exam.sections.length-1?'close-preview':'preview-next-section'):(sectionIndex===exam.sections.length-1?'submit-exam':'next-section');
  const nextLabel=sectionIndex===exam.sections.length-1?(preview?'Về chỉnh sửa':'Nộp bài'):'Tiếp theo';
  const sectionInstruction=sec.instruction||sec.instructionImageUrl?`<section class="exam-instruction">${sec.instruction?`<div><p>${esc(sec.instruction)}</p></div>`:''}${sec.instructionImageUrl?`<img src="${esc(sec.instructionImageUrl)}" alt="Hình minh họa đề bài">`:''}</section>`:'';
  const sectionAudio=sectionAudioHtml(sec,orderedQuestions.map(item=>item.q),attempt,{preview});
  const currentCount=`<span data-current-answer-count aria-label="Số câu đã trả lời">${answered}/${requiredQuestions.length}</span>`;
  const stimulusStarts=new Set((sec.questionProfile?.stimulusStarts||[]).map(Number));
  const knownQuestions=new Map((allQuestions||[]).map(question=>[question.id,question]));
  let questionNumber=exam.sections.slice(0,sectionIndex).reduce((total,item)=>total+(item.questionIds||[]).filter(id=>!knownQuestions.get(id)?.example).length,0);
  let exampleTitleShown=false;
  const questionList=`<section class="to-thi" aria-label="Câu hỏi">${orderedQuestions.map(({q,originalIndex})=>{
    const showExampleTitle=Boolean(q.example&&!exampleTitleShown);if(showExampleTitle)exampleTitleShown=true;
    return renderQuestionHtml(q,attempt.answers?.[q.id],attempt,{sectionInstruction:sec.instruction||'',preview,hideAudio:Boolean(sectionAudio),hasStimulus:stimulusStarts.has(originalIndex),questionNumber:q.example?null:++questionNumber,showExampleTitle,formFrame:sec.questionProfile?.formFrame===true,mobileThreeChoices:sec.templateType==='A1_LISTENING_PART_1'});
  }).join('')||'<div class="rong">Phần này chưa có câu hỏi.</div>'}</section>`;
  const context=preview
    ?`<div class="exam-context"><div class="exam-title-block"><h1 id="preview-section-title" tabindex="-1">${esc(sec.name)}</h1></div></div>`
    :`<div class="exam-context"><div class="exam-title-block"><div class="nhan-muc">${esc(exam.level)} · ${esc(exam.title)}</div><h1>${esc(sec.name)}</h1></div></div>`;
  const body=`<main class="noi-dung-thi">${context}<div class="exam-paper">${sectionInstruction}${sectionAudio}${questionList}</div><nav class="dieu-huong-thi" aria-label="Điều hướng bài thi"><button class="nut" data-action="${previousAction}" ${sectionIndex===0?'disabled':''}>${preview?'Phần trước':'Quay lại'}</button>${preview?'':`<span class="tien-do" id="saveState">${currentCount} - <b id="examTimeSummary">--:--</b></span>`}<button class="nut chinh" data-action="${nextAction}">${nextLabel}</button></nav></main>`;
  const header=preview
    ?`<header class="thanh-thi thanh-thi--preview"><strong>${esc(exam.title)}</strong><div class="preview-header-row"><button class="text-link" data-action="close-preview"><span aria-hidden="true">←</span> Quay lại</button>${previewOutlineHtml(previewSummary,sectionIndex)}</div></header>`
    :`<header class="thanh-thi"><span class="exam-mobile-brand"><img src="/brand/favicon" alt=""><strong>Luyện thi tiếng Đức</strong></span><div class="thong-tin-thi"><span>Phần ${sectionIndex+1}/${exam.sections.length}</span><b id="examTimer">--:--</b></div></header>`;
  const offline=!online?`<div class="offline" role="status">${preview?'Đang ngoại tuyến. Câu trả lời xem thử chỉ giữ trong phiên này; audio và ảnh có thể không tải được.':'Đang ngoại tuyến. Hãy giữ trang mở; câu trả lời sẽ tiếp tục được lưu trên thiết bị.'}</div>`:'';
  return `<div class="thi ${preview?'thi--preview':''}">${header}${offline}${preview?`<div class="preview-shell">${body}</div>`:body}</div>`;
}

function previewOutlineHtml(summary,sectionIndex){
  const {sections=[]}=summary||{};
  const width=Math.max(12,...sections.map(item=>String(item.name||'').length+6));
  return `<div class="preview-outline"><label class="preview-section-picker" for="previewSectionSelect"><span class="sr-only">Chọn phần</span><select id="previewSectionSelect" class="truong" style="--picker-width:${width}ch" aria-label="Chọn phần" data-action="preview-select-section" ${sections.length?'':'disabled'}>${sections.map((item,index)=>`<option value="${index}" ${index===sectionIndex?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label></div>`;
}

export function answerPresent(answer,q){
  if(q.type==='writing'){
    if(Array.isArray(q.rubric)&&q.rubric.length)return q.rubric.every((row,index)=>!isScoredWritingField(row)||Boolean(String(answer?.[index]??'').trim()));
    return Boolean(String(answer??'').trim());
  }
  if(q.type==='matching')return Array.isArray(answer)&&(q.pairs||[]).every((_,index)=>Boolean(String(answer[index]??'').trim()));
  return answer!==undefined&&answer!==null&&answer!=='';
}

function sectionAudioHtml(section,questions,attempt,{preview=false}={}){
  const policy=section.audioPolicy||{},audioQuestions=questions.filter(question=>String(question.audioUrl||'').trim());
  const policyEnabled=section.skillKey==='listening'&&policy.mode==='per_question_segment';
  const hasSpecialAudio=Boolean(String(section.instructionAudioUrl||'').trim())||audioQuestions.some(question=>question.example);
  if(!policyEnabled&&!hasSpecialAudio)return '';
  const repeat=Math.max(1,Number(policy.segmentRepeat)||1),key=`g2g.section-audio.${attempt.id}.${section.id}`;
  const used=!preview&&(Boolean(attempt.audioSessions?.[section.id]?.startedAt)||Boolean(sessionStorage.getItem(key)));
  const segments=[];
  if(section.instructionAudioUrl)segments.push({url:section.instructionAudioUrl,repeat:1,label:'Đề bài'});
  audioQuestions.forEach((question,index)=>segments.push({url:question.audioUrl,repeat:question.example?1:repeat,label:question.example?'Ví dụ':`Câu ${index+1}`}));
  const audios=segments.map((segment,index)=>`<audio class="section-audio-segment" data-order="${index}" data-repeat="${segment.repeat}" data-label="${esc(segment.label)}" preload="metadata" src="${esc(segment.url)}"></audio>`).join('');
  return `<section class="section-audio" data-section-audio="${esc(section.id)}" data-storage-key="${esc(key)}">${audios}<button type="button" class="section-audio-play" aria-label="Phát audio của phần" ${used?'disabled':''}>${iconHtml('play')}</button><div class="section-audio-body"><span class="section-audio-progress" role="progressbar" aria-label="Tiến độ audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></span><span class="section-audio-status" aria-live="polite">${used?'Đã hết lượt nghe':'Chỉ có thể bấm nghe một lần'}</span></div></section>`;
}

const questionImageUrl=q=>String((Array.isArray(q.instructionBlocks)?q.instructionBlocks[0]?.imageUrl:'')||q.instructionImageUrl||'').trim();

function questionStimulusHtml(q,{hideImage=false}={}){
  const block=Array.isArray(q.instructionBlocks)?q.instructionBlocks[0]:null,text=block?.text||q.prompt||'',imageUrl=hideImage?'':questionImageUrl(q);
  if(!text&&!imageUrl)return '';
  return `<section class="question-stimulus">${text?`<div><p>${esc(text)}</p></div>`:''}${imageUrl?`<img src="${esc(imageUrl)}" alt="Hình minh họa đề bài">`:''}</section>`;
}

function questionPromptHtml(text,q){
  const imageUrl=questionImageUrl(q);
  return String(text||'').split(/(\[img\])/gi).map(part=>/^\[img\]$/i.test(part)
    ?(imageUrl?`<span class="question-inline-image"><img src="${esc(imageUrl)}" alt="Hình minh họa câu hỏi"></span>`:'')
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

export function renderQuestionHtml(q,answer,attempt,{sectionInstruction='',preview=false,hideAudio=false,hasStimulus=false,questionNumber=null,showExampleTitle=true,formFrame=false,mobileThreeChoices=false}={}){
  const isExample=Boolean(q.example),exampleTitle=isExample&&showExampleTitle?'<div class="question-example-title">Beispiel</div>':'';
  if(isExample)answer=exampleAnswer(q);
  if(q.type==='writing'&&(formFrame||q.writingFormVersion===1))return `<div class="cau-thi writing-form-question ${isExample?'is-example':''}" data-q="${esc(q.id)}">${exampleTitle}${writingFormDisplay(q,answer,{readOnly:isExample})}</div>`;
  const played=sessionStorage.getItem(`g2g.audio.${attempt.id}.${q.id}`);
  const audio=!hideAudio&&q.audioUrl?`<div class="audio-thi"><audio id="audio-${q.id}" preload="metadata" src="${esc(q.audioUrl)}"></audio><button class="nut nho chinh play-audio" data-q="${q.id}" title="Audio chỉ phát theo quy định của đề thi." ${played?'disabled':''}>${played?'Đã phát audio':'Phát audio'}</button>${preview?'':'<span class="phu-de">Audio chỉ phát theo quy định của đề thi.</span>'}</div>`:'';
  const rawPrompt=String(hasStimulus?q.title||'':q.prompt||q.title||'').trim();
  const normalizedPrompt=rawPrompt.toLocaleLowerCase(),normalizedSection=String(sectionInstruction||'').toLocaleLowerCase();
  const isSharedInstruction=normalizedPrompt.length>12&&normalizedSection.includes(normalizedPrompt);
  const questionText=rawPrompt==='Nháp'||isSharedInstruction?'':rawPrompt;
  const questionAriaText=questionText.replace(/\[img\]/gi,' ').replace(/\s+/g,' ').trim();
  const prompt=`${q.instruction?`<div class="question-instruction">${esc(q.instruction)}</div>`:''}${questionText||questionNumber?`<div class="noi">${questionNumber?`<strong class="question-number">${questionNumber}.</strong> `:''}${questionPromptHtml(questionText,q)}</div>`:''}`;
  const stimulus=hasStimulus?questionStimulusHtml(q,{hideImage:/\[img\]/i.test(questionText)}):'';
  const head=exampleTitle+stimulus+(prompt||audio?`<div class="preview-question-heading">${prompt?`<div class="preview-question-prompt">${prompt}</div>`:''}${audio}</div>`:'');
  const root=`cau-thi ${isExample?'is-example ':''}${answerPresent(answer,q)?'is-answered':''}`;
  if(['single','cloze','truefalse'].includes(q.type)){
    const choices=(q.choices||[]).map((choice,index)=>({choice,index})).filter(({choice})=>{const text=String(typeof choice==='object'?choice?.text||'':choice||'').trim();return Boolean((text&&text!=='Nháp')||String(typeof choice==='object'?choice?.imageUrl||'':'').trim());});
    return `<div class="${root}" data-q="${q.id}">${head}<div class="answer-options ${choices.some(({choice})=>choice?.imageUrl)?'answer-options--illustrated':''}${mobileThreeChoices?' answer-options--mobile-three':''}" role="radiogroup" aria-label="${esc(questionAriaText||'Chọn đáp án')}">${choices.map(({choice,index})=>{const rawText=typeof choice==='object'?choice.text:choice,text=String(rawText||'').trim()==='Nháp'?'':rawText,imageUrl=typeof choice==='object'?choice.imageUrl||'':'',letter=String.fromCharCode(65+index);return `<label class="answer-option"><input class="${isExample?'':'answer-one'}" type="radio" name="answer-${q.id}" data-q="${q.id}" aria-label="${esc(`${letter}. ${text||''}`)}" value="${index}" ${String(answer)===String(index)?'checked':''} ${isExample?'disabled':''}><span class="answer-option-body">${imageUrl?`<img src="${esc(imageUrl)}" alt="">`:''}<span><strong class="answer-letter">${letter}.</strong> ${esc(text)}</span></span></label>`;}).join('')}</div></div>`;
  }
  if(q.type==='matching')return `<div class="${root}" data-q="${q.id}">${head}${(q.pairs||[]).map((p,i)=>`<div class="matching-row"><b>${esc(p[0])}</b><select class="dap-an ${isExample?'':'answer-match'}" data-q="${q.id}" data-i="${i}" ${isExample?'disabled':''}><option value="">Chọn đáp án</option>${[...new Set((q.pairs||[]).map(x=>x[1]))].map(v=>`<option value="${esc(v)}" ${Array.isArray(answer)&&answer[i]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if(q.type==='writing')return `<div class="${root}" data-q="${q.id}">${head}${Array.isArray(q.rubric)&&q.rubric.length?writingFieldsHtml(q,answer,{framed:formFrame}):`<textarea class="viet ${isExample?'':'answer-text'}" data-q="${q.id}" placeholder="Viết bài tại đây..." ${isExample?'disabled':''}>${esc(answer||'')}</textarea><div class="phu-de" style="text-align:right"><span class="word-count">${countWords(answer||'')}</span> từ</div>`}</div>`;
  if(q.type==='speaking')return `<div class="cau-thi" data-q="${q.id}">${head}<div class="goi-y">Phần Nói được thực hiện theo hướng dẫn của giáo viên/phòng thi thử và được chấm thủ công.</div></div>`;
  return `<div class="cau-thi">${head}</div>`;
}

function writingFieldsHtml(q,answer,{framed=false}={}){
  const readOnly=Boolean(q.example),values=answer&&typeof answer==='object'?answer:{},rows=(q.rubric||[]).map((row,index)=>({...row,index})).filter(row=>!row.hidden);
  const {markers}=writingPointLayout(q.rubric);
  let lastLabel=null,groups=[];
  for(const row of rows){
    const marker=markers[row.index];
    const type=row.type||'text',value=values[row.index]??'',options=String(row.answers||'').split('|').map(item=>item.trim()).filter(Boolean);
    let control='';
    if(type==='heading')control=`<strong class="writing-form-heading">${esc(row.answers||row.label||'')}</strong>`;
    else if(type==='static')control=`<span class="writing-static-value">${esc(row.answers||'')}</span>`;
    else if(type==='image')control=row.imageUrl?`<img class="writing-form-image" src="${esc(row.imageUrl)}" alt="${esc(row.label||'Hình minh họa')}">`:'';
    else if(type==='truefalse')control=`<div class="writing-binary"><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Richtig" ${value==='Richtig'?'checked':''} ${readOnly?'disabled':''}>Richtig</label><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Falsch" ${value==='Falsch'?'checked':''} ${readOnly?'disabled':''}>Falsch</label></div>`;
    else if(type==='choice')control=`<select class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" ${readOnly?'disabled':''}><option value="">Chọn phương án</option>${options.map(option=>`<option value="${esc(option)}" ${String(value)===option?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
    else control=`<input class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" value="${esc(value)}" autocomplete="off" ${readOnly?'disabled':''}>`;
    const field=`<div class="writing-display-field writing-display-field--${esc(type)}">${marker?`<span class="writing-point">${marker}</span>`:''}${control}</div>`;
    if(type==='heading'||type==='image'){groups.push({label:'',fields:[field],full:true});lastLabel=null;continue;}
    if(groups.length&&lastLabel===String(row.label||''))groups[groups.length-1].fields.push(field);
    else{groups.push({label:String(row.label||''),fields:[field]});lastLabel=String(row.label||'');}
  }
  return `<div class="writing-response-form${framed?' writing-response-form--framed':''}">${groups.map(group=>`<div class="writing-display-group${group.full?' is-full':''}">${group.label?`<span class="writing-display-label">${esc(group.label)}</span>`:''}<div>${group.fields.join('')}</div></div>`).join('')}</div>`;
}

export function submittedHtml(){
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong">✓</div><h1>Đã nộp bài</h1><span class="nhan vang">ĐANG CHỜ CHẤM</span><p>Khi giáo viên chấm xong, điểm số sẽ được thông báo qua email và hiển thị tại trang kết quả.</p><button class="nut" data-action="student-home" style="margin-top:18px">Về danh sách bài thi</button></section></main>`;
}

export function expiredHtml(){
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong">!</div><h1>Đã hết thời gian</h1><p>Rất tiếc bạn đã không hoàn thành phần thi vì đã hết thời gian.</p><button class="nut chinh" data-action="student-home" style="margin-top:18px">Quay lại trang chính</button></section></main>`;
}
