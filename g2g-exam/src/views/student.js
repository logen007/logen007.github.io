import {sectionLabel} from '../ui/section-label.js';
import {partUsesSplit} from '../ui/part-display.js';
import {sectionInstructions,supportsInstructionPositions,instructionPosition,instructionSlotCount,instructionExampleCount} from '../domain/section-instructions.js';
import {sectionQuestionOffset} from '../domain/question-numbering.js';
import {isPrefilledQuestion,imageMaxWidth,shortChoiceColumns,compactBinaryChoices} from '../domain/question-display.js';
import {answerPresent,MIN_COMPLETION_PERCENT} from '../domain/exam-completion.js';
export {answerPresent} from '../domain/exam-completion.js';
import {getExamSpec} from '../exam-specs/index.js';
import {inlineGapsHtml} from '../ui/inline-gaps.js';
import {headingMatchHtml,headingOptionsHtml} from '../ui/heading-match.js';
import {readingBlocksHtml} from '../ui/reading-blocks.js';
import {letterAnswersHtml} from '../ui/letter-answers.js';
import {partAudioSegments,effectiveAudioPolicy} from '../domain/part-audio.js';
import {examDurationSeconds} from '../domain/exam-clock.js';
import {
  ATTEMPT_STATUS,byId,getPublishedExams,getStudentResults,getLatestPublishedAttempt,
  getBestPublishedAttempt,summarizeExam
} from '../core.js';
import {textHtml,instructionTextHtml,esc,fmtDate,statusClass,statusText,countWords} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {writingPointLayout,isScoredWritingField,isRequiredWritingField} from '../domain/writing-form.js';
import {writingFormDisplay} from '../ui/writing-form.js';
import {resultClass,resultLabel} from '../domain/gradebook.js';
import {STUDENT_LEVELS,examLearningLevel} from '../domain/student-profile.js';
import {studentProfileCardHtml} from './student-profile-card.js';

export {loginHtml} from './login.js';

export function studentHomeHtml({data,user,filter='all',levelFilter=''}){
  const exams=getPublishedExams(data);
  const attempts=getStudentResults(data,user.id);
  const latest=getLatestPublishedAttempt(data,user.id),best=getBestPublishedAttempt(data,user.id);
  const latestExam=latest&&byId(data.exams,latest.examId);
  const types=['GOETHE','TELC','FID'];
  const visible=exams.filter(ex=>(filter==='all'||ex.provider===filter)&&(!levelFilter||examLearningLevel(ex)===levelFilter));
  return `<main class="khung student-catalog">${studentProfileCardHtml(data,user)}<div class="exam-filter" aria-label="Lọc đề thi"><label class="filter-field"><select aria-label="Loại đề" data-exam-provider-filter><option value="all">Loại đề</option>${types.map(type=>`<option value="${esc(type)}" ${filter===type?'selected':''}>${esc(type)}</option>`).join('')}</select></label><label class="filter-field"><select aria-label="Trình độ" data-exam-level-filter><option value="">Trình độ</option>${STUDENT_LEVELS.map(level=>`<option ${levelFilter===level?'selected':''}>${level}</option>`).join('')}</select></label><button class="nut" data-action="enter-code">Nhập mã đề</button></div><section class="danh-sach-de">${visible.map(ex=>studentExamCardHtml(ex,attempts,data)).join('')||'<p>Chưa có đề luyện thuộc loại này.</p>'}</section></main>`;
}

export function studentExamCardHtml(ex,attempts,data){
  const mine=attempts.filter(a=>a.examId===ex.id);
  const published=mine.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const latest=[...published].sort((a,b)=>String(b.publishedAt||b.submittedAt||b.startedAt).localeCompare(String(a.publishedAt||a.submittedAt||a.startedAt)))[0];
  const sum=ex.questionCount!=null?{sections:ex.sections?.length||0,questions:ex.questionCount}:summarizeExam(ex,data);
  const mins=(ex.durationSeconds??examDurationSeconds(ex))/60;
  const provider=String(ex.provider||'').trim();
  const latestResult=resultLabel(latest?.result)||'Chưa đạt';
  const latestLine=latest?`Lần thi gần nhất <strong>${esc(latest.totalScore??'—')}</strong> điểm - <span class="exam-latest-result ${resultClass(latestResult)}">${esc(latestResult)}</span>`:'';
  return `<article class="the the-de"><h3 title="${esc(ex.title)}">${textHtml(ex.title)}</h3><div class="exam-card-details"><div class="exam-card-tags">${provider?`<span class="nhan exam-provider" data-provider="${esc(provider.toUpperCase())}">${esc(provider==='FID'?'FID':provider.charAt(0).toUpperCase()+provider.slice(1).toLowerCase())}</span>`:''}<span class="nhan exam-level" data-level="${esc(ex.level)}">${esc(ex.level)}</span></div><span class="meta">${mine.some(a=>a.status!==ATTEMPT_STATUS.ABANDONED)?'':'<span class="the-de-new">Mới</span>'}${sum.sections} phần · ${ex.questionCount??sum.questions} câu</span></div><div class="exam-card-footer">${latestLine?`<span class="exam-card-status">${latestLine}</span>`:''}${ex.hidden?`<button class="nut chinh" data-action="enter-code" data-exam="${esc(ex.id)}" ${ex.hasActiveCodes&&!ex.allCodesUsed?'':'disabled'}><span>${ex.allCodesUsed?'Đã sử dụng lượt thi':ex.hasActiveCodes?'Nhập mã':'Không có mã thi'}</span>${iconHtml('arrowRight')}</button>`:`<button class="nut chinh" data-action="start" data-exam="${esc(ex.id)}"><span>Bắt đầu thi · ${mins} phút</span>${iconHtml('arrowRight')}</button>`}</div></article>`;
}

export {studentResultsHtml} from './student-results.js';

export {attemptResultHtml as studentAttemptDetailHtml} from './attempt-result.js';

export function examHtml({attempt,exam,sectionIndex,questions,allQuestions=[],online,preview=false,previewSummary=null}){
  const sec=exam.sections[sectionIndex];
  const configuredPart=getExamSpec(exam.provider,exam.level)?.skills
    .find(skill=>skill.key===sec.skillKey||skill.label===sec.skill)?.parts.find(part=>part.name===sec.name);
  const compactGaps=String(exam.provider).toUpperCase()==='TELC'&&exam.level==='B1'&&sec.name==='Đọc 4';
  const compactHeadings=String(exam.provider).toUpperCase()==='TELC'&&exam.level==='B1'&&sec.questionProfile?.layout==='heading-match';
  const splitWriting=partUsesSplit(exam,sec)&&(sec.skillKey==='writing'||sec.skill==='Viết');
  const splitLayout=sec.displaySplit??(splitWriting||(!compactHeadings&&!compactGaps&&(configuredPart?.questionProfile?.splitLayout??sec.questionProfile?.splitLayout)));
  const orderedQuestions=questions.map((q,originalIndex)=>({q,originalIndex})).sort((a,b)=>Number(Boolean(isPrefilledQuestion(b.q)))-Number(Boolean(isPrefilledQuestion(a.q))));
  const requiredQuestions=questions.filter(q=>!isPrefilledQuestion(q));
  const answered=requiredQuestions.filter(q=>answerPresent(attempt.answers?.[q.id],q)).length;
  const previousAction=preview?'preview-prev-section':'prev-section';
  const nextAction=preview?(sectionIndex===exam.sections.length-1?'close-preview':'preview-next-section'):(sectionIndex===exam.sections.length-1?'submit-exam':'next-section');
  const nextLabel=sectionIndex===exam.sections.length-1?(preview?'Kết thúc':'Abgeben'):'Weiter';
  const splitHeadings=splitLayout&&sec.questionProfile?.layout==='heading-match';
  const positioned=supportsInstructionPositions(sec),promptAt=position=>sectionPromptHtml(sec,{position,questionCount:instructionSlotCount(sec,questions.length),exampleCount:instructionExampleCount(sec,questions)});
  const afterPrompt=position=>{const content=positioned&&sec.displaySplit!==true?promptAt(position):'';return content?`<section class="exam-instruction positioned-section-prompt">${content}</section>`:'';};
const sectionInstruction=sec.instruction||sec.instructionImageUrl||sec.additionalInstructions?.length||sec.readingBlocks?.length||splitHeadings?`<section class="exam-instruction">${positioned&&sec.displaySplit!==true?promptAt(0):sectionPromptHtml(sec)}${readingBlocksHtml(sec)}${splitHeadings?headingOptionsHtml(sec):''}</section>`:'';
  const sectionAudio=sectionAudioHtml(sec,orderedQuestions.map(item=>item.q),attempt,{preview,startNumber:sectionQuestionOffset(exam,sec,[...allQuestions,...questions])});
  const currentCount=`<span data-current-answer-count aria-label="Beantwortete Aufgaben">${answered}/${requiredQuestions.length}</span>`;
  let questionNumber=sectionQuestionOffset(exam,sec,[...allQuestions,...questions]);
  const exampleCount=orderedQuestions.length-requiredQuestions.length;
  const stimulusGroups=[{left:sectionInstruction,right:sectionAudio}];
  const writingPrompts=[sectionInstruction];
  const groupStimuli=splitLayout&&!splitWriting&&!['heading-match','inline-gaps','letter-select'].includes(sec.questionProfile?.layout)&&!sec.questionProfile?.uniqueLetters&&(sec.displaySplit===true||questions.some(q=>q.instructionBlocks?.length));
  const questionList=sec.questionProfile?.layout==='heading-match'?headingMatchHtml(sec,questions,attempt.answers||{},questionNumber,{separateOptions:splitHeadings||compactHeadings,afterQuestion:afterPrompt}):sec.questionProfile?.layout==='inline-gaps'?inlineGapsHtml(sec,questions,attempt.answers||{},questionNumber,{compact:compactGaps,splitLayout:typeof sec.displaySplit==='boolean'?false:(configuredPart?.questionProfile?.gapSplitLayout??sec.questionProfile?.gapSplitLayout)})+afterPrompt(1):(sec.questionProfile?.uniqueLetters||sec.questionProfile?.layout==='letter-select')?letterAnswersHtml(sec,orderedQuestions.map(item=>item.q),attempt.answers||{},questionNumber,{afterQuestion:afterPrompt})+(sec.questionProfile?.layout==='letter-table'?afterPrompt(1):''):`<section class="to-thi" aria-label="Aufgaben">${orderedQuestions.map(({q,originalIndex},displayIndex)=>{
    const example=isPrefilledQuestion(q),scoredIndex=displayIndex-exampleCount;
    const hasStimulus=Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length>0;
    const paired=sec.questionProfile?.pairedQuestions;
    const pairStart=example?(displayIndex===0?'<div class="exam-question-pair exam-question-pair--example" role="group" aria-label="Beispiel"><div class="question-example-title">Beispiel</div>':''):paired&&scoredIndex%2===0?`<div class="exam-question-pair" role="group" aria-label="Aufgabenpaar ${Math.floor(scoredIndex/2)+1}">`:'';
    const pairEnd=(example?displayIndex===exampleCount-1:paired&&(scoredIndex%2===1||displayIndex===orderedQuestions.length-1))?'</div>':'';
    const movedStimulus=groupStimuli&&hasStimulus;
    if(movedStimulus){
      if(displayIndex>0&&!example&&(!paired||scoredIndex%2===0))stimulusGroups.push({left:'',right:''});
      stimulusGroups.at(-1).left+=questionStimulusHtml(q);
    }
    const followingPrompt=afterPrompt(displayIndex+1);
    const rendered=pairStart+renderQuestionHtml(q,attempt.answers?.[q.id],attempt,{singleQuestion:questions.filter(q=>!isPrefilledQuestion(q)).length===1,linedPaper:sec.questionProfile?.linedPaper,wordRange:sec.questionProfile?.wordRange,sectionInstruction:sec.instruction||'',preview,hideAudio:Boolean(sectionAudio),hasStimulus,hideStimulus:movedStimulus,questionNumber:example?null:++questionNumber,showExampleTitle:false,formFrame:sec.questionProfile?.formFrame===true,mobileThreeChoices:sec.templateType==='A1_LISTENING_PART_1',captureWritingPrompt:splitWriting?html=>writingPrompts.push(html):null})+pairEnd+(splitWriting?'':followingPrompt);
    if(splitWriting&&followingPrompt)writingPrompts.push(followingPrompt);
    if(groupStimuli)stimulusGroups.at(-1).right+=rendered;
    return rendered;
  }).join('')||'<div class="rong">Dieser Teil enthält noch keine Aufgaben.</div>'}</section>`;
  const context=preview
    ?`<div class="exam-context"><div class="exam-title-block"><h1 id="preview-section-title" tabindex="-1">${esc(germanSectionName(sectionLabel(exam,sec)))}</h1></div></div>`
    :`<div class="exam-context"><div class="exam-title-block"><div class="nhan-muc">${esc(exam.level)} · ${textHtml(exam.title)}</div><h1>${esc(germanSectionName(sectionLabel(exam,sec)))}</h1></div></div>`;
  const paperContent=splitWriting?`<div class="exam-reading-split exam-writing-split"><div class="exam-writing-prompt">${writingPrompts.join('')}</div><div class="exam-writing-response">${sectionAudio}${questionList}</div></div>`:groupStimuli?`<div class="exam-reading-split exam-stimulus-group" data-responsive-stimuli><div>${stimulusGroups.map((group,i)=>`<div data-stimulus-order="${i*2}">${group.left}</div>`).join('')}</div><section class="to-thi" aria-label="Aufgaben">${stimulusGroups.map((group,i)=>`<div data-stimulus-order="${i*2+1}">${group.right}</div>`).join('')}</section></div>`:splitLayout?`<div class="exam-reading-split">${sectionInstruction}<div>${sectionAudio}${questionList}</div></div>`:sectionInstruction+sectionAudio+questionList;
const body=`<main class="noi-dung-thi">${context}${preview?'':`<div class="exam-free-navigation"><span>Prüfungszeit: <strong id="examMainTime">--:--</strong></span><button class="nut" data-action="submit-exam">Prüfung abgeben</button></div>`}<div class="exam-paper">${paperContent}</div><nav class="dieu-huong-thi" aria-label="Prüfungsnavigation"><button class="nut section-arrow" aria-label="Vorheriger Teil" title="Vorheriger Teil" data-action="${previousAction}" ${sectionIndex===0?'disabled':''}>${iconHtml('arrowLeft')}</button>${preview?'':`<span class="tien-do" id="saveState">${currentCount} - <b id="examTimeSummary">--:--</b></span>`}<button class="nut chinh ${sectionIndex<exam.sections.length-1?'section-arrow':''}" aria-label="${nextLabel}" title="${nextLabel}" data-action="${nextAction}">${sectionIndex<exam.sections.length-1?iconHtml('arrowRight'):nextLabel}</button></nav></main>`;
  const header=preview
    ?`<header class="thanh-thi thanh-thi--preview"><div class="preview-header-row"><button class="text-link navigation-arrow" aria-label="Zurück" title="Zurück" data-action="close-preview">${iconHtml('arrowLeft')}</button><strong class="preview-exam-title" title="${esc(exam.title)}">${textHtml(exam.title)}</strong>${previewOutlineHtml(previewSummary,sectionIndex,exam)}</div></header>`
    :`<header class="thanh-thi"><span class="exam-mobile-brand"><img src="/brand/favicon" alt=""><strong>Deutschprüfung</strong></span><div class="thong-tin-thi"><span>Teil ${sectionIndex+1}/${exam.sections.length}</span></div></header>`;
  const offline=!online?`<div class="offline" role="status">${preview?'Sie sind offline. Vorschauantworten werden nur in dieser Sitzung gespeichert; Audio und Bilder sind möglicherweise nicht verfügbar.':'Sie sind offline. Lassen Sie diese Seite geöffnet; Ihre Antworten werden weiterhin auf diesem Gerät gespeichert.'}</div>`:'';
  return `<div class="thi ${preview?'thi--preview':''}">${header}${offline}${preview?`<div class="preview-shell">${body}</div>`:body}</div>`;
}

function previewOutlineHtml(summary,sectionIndex,exam){
  const {sections=[]}=summary||{};
  return `<div class="preview-outline"><label class="preview-section-picker" for="previewSectionSelect"><span class="sr-only">Teil auswählen</span><select id="previewSectionSelect" class="truong" style="--picker-width:18ch" aria-label="Teil auswählen" data-action="preview-select-section" ${sections.length?'':'disabled'}>${sections.map((item,index)=>`<option value="${index}" ${index===sectionIndex?'selected':''}>${esc(germanSectionName(sectionLabel(exam,item)))}</option>`).join('')}</select></label></div>`;
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

function sectionAudioHtml(section,questions,attempt,{preview=false,startNumber=0}={}){
  const policy=effectiveAudioPolicy(section),audioQuestions=questions.filter(question=>String(question.audioUrl||'').trim());
  const policyEnabled=section.skillKey==='listening'&&policy.mode==='per_question_segment';
  const hasSpecialAudio=audioQuestions.some(question=>question.example)||questions.some(q=>q.instructionBlocks?.some(block=>block.audioUrl));
  if(!sectionInstructions(section).some(block=>block.audioUrl)&&(!hasSpecialAudio&&(!audioQuestions.length||!policyEnabled)))return '';
  const repeat=Math.max(1,Number(policy.segmentRepeat)||1),key=`g2g.section-audio.${attempt.id}.${section.id}`;
  const used=!preview&&(Boolean(attempt.audioSessions?.[section.id]?.startedAt)||Boolean(sessionStorage.getItem(key)));
  const segments=partAudioSegments(section,questions,{startNumber});
  const audios=segments.map((segment,index)=>`<audio class="section-audio-segment" data-order="${index}" data-repeat="${segment.repeat}" data-label="${esc(segment.label)}" preload="metadata" src="${esc(segment.url)}"></audio>`).join('');
  return `<section class="section-audio" data-section-audio="${esc(section.id)}" data-storage-key="${esc(key)}">${audios}<button type="button" class="section-audio-play" aria-label="Audio abspielen" ${used?'disabled':''}>${iconHtml('play')}</button><div class="section-audio-body"><span class="section-audio-progress" role="progressbar" aria-label="Audiofortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i></i></span><span class="section-audio-status" aria-live="polite">${used?'Audio wurde bereits abgespielt':'Audio kann nur einmal abgespielt werden'}</span></div></section>`;
}

const questionImageUrl=q=>String((Array.isArray(q.instructionBlocks)?q.instructionBlocks[0]?.imageUrl:'')||q.instructionImageUrl||'').trim();

export function sectionPromptHtml(section,{position=null,questionCount=0,exampleCount=0}={}){
  return sectionInstructions(section).map((block,index)=>{
  if(position!==null&&instructionPosition(block,questionCount,exampleCount)!==position)return '';
  return promptBlockHtml(block,{appendImage:index>0||block.afterQuestion>0||section.questionProfile?.layout!=='inline-gaps'});
  }).join('');
}

function promptBlockHtml(block,{appendImage=true,hideImage=false}={}){
  const text=block.text||'',hasMarker=/\[img\]/i.test(text);
  const image=!hideImage&&block.imageUrl?`<img ${imageMaxWidth(block.imageMaxWidth)?`style="max-width:${imageMaxWidth(block.imageMaxWidth)}px"`:''} src="${esc(block.imageUrl)}" alt="Abbildung zur Aufgabenstellung">`:'';
  let inserted=false;
  const formatted=instructionTextHtml(text).replace(/\[img\]/gi,()=>{if(inserted)return '';inserted=true;return image;});
  const content=text?`<div><p>${formatted}</p></div>`:'';
  return content+(!hasMarker&&appendImage?image:'');
}

function questionStimulusHtml(q,{hideImage=false}={}){
  const blocks=Array.isArray(q.instructionBlocks)&&q.instructionBlocks.length?q.instructionBlocks:[{text:q.prompt||'',imageUrl:q.instructionImageUrl||''}];
  return blocks.map(block=>block?.text||(!hideImage&&block?.imageUrl)?`<section class="question-stimulus">${promptBlockHtml(block,{hideImage})}</section>`:'').join('');
}

function questionPromptHtml(text,q){
  const imageUrl=questionImageUrl(q);
  return String(text||'').split(/(\[img\])/gi).map(part=>/^\[img\]$/i.test(part)
    ?(imageUrl?`<span class="question-inline-image"><img src="${esc(imageUrl)}" alt="Abbildung zur Aufgabe"></span>`:'')
    :instructionTextHtml(part)).join('');
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

export function renderQuestionHtml(q,answer,attempt,{singleQuestion=false,linedPaper=false,wordRange=null,sectionInstruction='',preview=false,hideAudio=false,hasStimulus=false,hideStimulus=false,questionNumber=null,showExampleTitle=true,formFrame=false,mobileThreeChoices=false,captureWritingPrompt=null}={}){
  const isExample=Boolean(isPrefilledQuestion(q)),exampleTitle=isExample&&showExampleTitle?'<div class="question-example-title">Beispiel</div>':'';
  if(isExample){answer=exampleAnswer(q);questionNumber=null;}
  if(q.type==='writing'&&singleQuestion)questionNumber=null;
  if(q.type==='writing'&&(formFrame||q.writingFormVersion===1))return `<div class="cau-thi writing-form-question ${isExample?'is-example':''}" data-q="${esc(q.id)}">${exampleTitle}${writingFormDisplay(q,answer,{readOnly:isExample})}</div>`;
  const played=sessionStorage.getItem(`g2g.audio.${attempt.id}.${q.id}`);
  const audio=!hideAudio&&q.audioUrl?`<div class="audio-thi"><audio id="audio-${q.id}" preload="metadata" src="${esc(q.audioUrl)}"></audio><button class="nut nho chinh play-audio" data-q="${q.id}" title="Das Audio wird gemäß den Prüfungsregeln abgespielt." ${played?'disabled':''}>${played?'Audio abgespielt':'Audio abspielen'}</button>${preview?'':'<span class="phu-de">Das Audio wird gemäß den Prüfungsregeln abgespielt.</span>'}</div>`:'';
  const publicTitle=q.type==='writing'&&q.aiGradingRules&&q.title===q.aiGradingRules?'':q.title||'';
  const rawPrompt=String(hasStimulus?publicTitle:q.prompt||publicTitle).trim();
  const normalizedPrompt=rawPrompt.toLocaleLowerCase(),normalizedSection=String(sectionInstruction||'').toLocaleLowerCase();
  const isSharedInstruction=normalizedPrompt.length>12&&normalizedSection.includes(normalizedPrompt);
  const questionText=rawPrompt==='Nháp'||isSharedInstruction?'':rawPrompt;
  const questionAriaText=questionText.replace(/\[img\]/gi,' ').replace(/\s+/g,' ').trim();
  const prompt=`${q.instruction?`<div class="question-instruction">${instructionTextHtml(q.instruction)}</div>`:''}${questionText||questionNumber?`<div class="noi">${questionNumber?`<strong class="question-number">${questionNumber}${questionNumber==='_'?'':'.'}</strong> `:''}${questionPromptHtml(hideStimulus?questionText.replace(/\[img\]/gi,''):questionText,q)}</div>`:''}`;
  const stimulus=hasStimulus&&!hideStimulus?questionStimulusHtml(q,{hideImage:/\[img\]/i.test(questionText)}):'';
  const head=exampleTitle+stimulus+(prompt||audio?`<div class="preview-question-heading">${prompt?`<div class="preview-question-prompt">${prompt}</div>`:''}${audio}</div>`:'');
  const root=`cau-thi ${isExample?'is-example ':''}${answerPresent(answer,q)?'is-answered':''}`;
  if(['single','cloze','truefalse'].includes(q.type)){
    const choices=(q.choices||[]).map((choice,index)=>({choice,index})).filter(({choice})=>{const text=String(typeof choice==='object'?choice?.text||'':choice||'').trim();return Boolean((text&&text!=='Nháp')||String(typeof choice==='object'?choice?.imageUrl||'':'').trim());});
    const compact=compactBinaryChoices(choices.map(({choice})=>choice));
    const shortColumns=shortChoiceColumns(choices.map(({choice})=>choice));
    const illustrated=choices.some(({choice})=>choice?.imageUrl);
    return `<div class="${root}${compact?' cau-thi--binary':''}" data-q="${q.id}">${head}<div style="--answer-columns:${shortColumns||1}" class="answer-options ${shortColumns?'answer-options--short ':!illustrated?'answer-options--long ':''}${choices.some(({choice})=>choice?.imageUrl)?'answer-options--illustrated':''}${mobileThreeChoices?' answer-options--mobile-three':''}" role="radiogroup" aria-label="${esc(questionAriaText||'Antwort auswählen')}">${choices.map(({choice,index})=>{const rawText=typeof choice==='object'?choice.text:choice,text=String(rawText||'').trim()==='Nháp'?'':rawText,imageUrl=typeof choice==='object'?choice.imageUrl||'':'',letter=String.fromCharCode(65+index);return `<label class="answer-option"><input class="${isExample?'':'answer-one'}" type="radio" name="answer-${q.id}" data-q="${q.id}" aria-label="${esc(compact?text||'':`${letter}. ${text||''}`)}" value="${index}" ${String(answer)===String(index)?'checked':''} ${isExample?'disabled':''}><span class="answer-option-body">${imageUrl?`<img src="${esc(imageUrl)}" alt="">`:''}<span>${compact?'':`<strong class="answer-letter">${letter}.</strong> `}${textHtml(text)}</span></span></label>`;}).join('')}</div></div>`;
  }
  if(q.type==='matching')return `<div class="${root}" data-q="${q.id}">${head}${(q.pairs||[]).map((p,i)=>`<div class="matching-row"><b>${esc(p[0])}</b><select class="dap-an ${isExample?'':'answer-match'}" data-q="${q.id}" data-i="${i}" ${isExample?'disabled':''}><option value="">Antwort auswählen</option>${[...new Set((q.pairs||[]).map(x=>x[1]))].map(v=>`<option value="${esc(v)}" ${Array.isArray(answer)&&answer[i]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if(q.type==='writing'){
    if(captureWritingPrompt)captureWritingPrompt(head);
    return `<div class="${root}" data-q="${q.id}">${captureWritingPrompt?'':head}${Array.isArray(q.rubric)&&q.rubric.length?writingFieldsHtml(q,answer,{framed:formFrame}):`<textarea class="viet ${q.handwriting!==false?'lined-writing-paper ':''}${isExample?'':'answer-text'}" data-q="${q.id}" aria-label="Schriftliche Antwort${questionNumber?` ${esc(questionNumber)}`:''}" placeholder="Schreiben Sie hier..." ${isExample?'disabled':''}>${esc(answer||'')}</textarea><div class="phu-de" style="text-align:right"><span class="word-count">${countWords(answer||'')}</span> Wörter</div>`}</div>`;
  }
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
    if(type==='heading')control=`<strong class="writing-form-heading">${textHtml(row.answers||row.label||'')}</strong>`;
    else if(type==='static')control=`<span class="writing-static-value">${textHtml(row.answers||'')}</span>`;
    else if(type==='image')control=row.imageUrl?`<img class="writing-form-image" src="${esc(row.imageUrl)}" alt="${esc(row.label||'Abbildung')}">`:'';
    else if(type==='truefalse')control=`<div class="writing-binary"><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Richtig" ${value==='Richtig'?'checked':''} ${readOnly?'disabled':''}>Richtig</label><label><input class="${readOnly?'':'answer-form-field'}" type="radio" name="writing-${q.id}-${row.index}" data-q="${q.id}" data-field-index="${row.index}" value="Falsch" ${value==='Falsch'?'checked':''} ${readOnly?'disabled':''}>Falsch</label></div>`;
    else if(type==='choice')control=`<select class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" ${readOnly?'disabled':''}><option value="">Antwort auswählen</option>${options.map(option=>`<option value="${esc(option)}" ${String(value)===option?'selected':''}>${esc(option)}</option>`).join('')}</select>`;
    else control=`<input class="${readOnly?'':'answer-form-field '}truong" data-q="${q.id}" data-field-index="${row.index}" value="${esc(value)}" autocomplete="off" ${readOnly?'disabled':''}>`;
    const field=`<div class="writing-display-field writing-display-field--${esc(type)}">${marker?`<span class="writing-point">${marker}</span>`:''}${control}</div>`;
    if(type==='heading'||type==='image'){groups.push({label:'',fields:[field],full:true});lastLabel=null;continue;}
    if(groups.length&&lastLabel===String(row.label||''))groups[groups.length-1].fields.push(field);
    else{groups.push({label:String(row.label||''),fields:[field]});lastLabel=String(row.label||'');}
  }
  return `<div class="writing-response-form${framed?' writing-response-form--framed':''}">${groups.map(group=>`<div class="writing-display-group${group.full?' is-full':''}">${group.label?`<span class="writing-display-label">${textHtml(group.label)}</span>`:''}<div>${group.fields.join('')}</div></div>`).join('')}</div>`;
}

export function submittedHtml(attempt={}){
  if(attempt.status===ATTEMPT_STATUS.INCOMPLETE)return `<main class="khung"><section class="the ket-qua-cho"><h1>Không hoàn thành</h1><p>Đã hết giờ. Bạn mới trả lời ${esc(attempt.completion?.answered??0)}/${esc(attempt.completion?.total??0)} câu; cần ít nhất ${esc(attempt.completion?.minimum??0)} câu (${MIN_COMPLETION_PERCENT}%). Bài làm được lưu để xem lại, không được chấm điểm.</p><button class="nut" data-action="student-results">Xem bài làm</button><button class="nut" data-action="student-home">Về danh sách đề</button></section></main>`;
  const duration=Number(attempt?.durationSeconds);
  const elapsed=Number.isFinite(duration)?`<p>Thời gian làm bài: <strong>${Math.floor(duration/60)} phút ${duration%60} giây</strong></p>`:'';
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong thanh-cong">✓</div><h1>Đã nộp bài</h1>${elapsed}<span class="nhan vang">ĐANG CHỜ CHẤM</span><p>Điểm tạm tính có tại trang kết quả. Kết quả chính thức sẽ có sau khi giáo viên chấm và công bố.</p><button class="nut" data-action="student-attempt-detail" data-id="${esc(attempt.id)}">Xem kết quả</button><button class="nut navigation-arrow" aria-label="Về danh sách bài thi" title="Về danh sách bài thi" data-action="student-home" style="margin-top:18px">${iconHtml('arrowLeft')}</button></section></main>`;
}

export function expiredHtml(){
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong">!</div><h1>Zeit abgelaufen</h1><p>Leider konnten Sie diesen Prüfungsteil nicht rechtzeitig abschließen.</p><button class="nut chinh navigation-arrow" aria-label="Zur Startseite" title="Zur Startseite" data-action="student-home" style="margin-top:18px">${iconHtml('arrowLeft')}</button></section></main>`;
}
