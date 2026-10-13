import {esc,textHtml,fmtDate} from '../ui/format.js';
import {animateResult} from '../ui/result-motion.js';
import {iconHtml} from '../ui/icons.js';
import {resultClass,isStandardTelc,gradeBand,resultLabel} from '../domain/gradebook.js';
import {SKILL_LABELS} from '../domain/result-summary.js';
import {reviewCounts,questionVerdict} from '../domain/attempt-review.js';
import {TELC_SCORING} from '../../specs/telc/scoring.js';

const labels={correct:'Đúng',wrong:'Sai',blank:'Chưa trả lời'};
const display=value=>value==null||value===''?'Chưa trả lời':typeof value==='object'?Object.values(value).join(' · '):String(value);
const safePicture=value=>/^https?:\/\//i.test(String(value||''))?value:'';
const safeImage=value=>safePicture(value)||(/^\/(?!\/)/.test(String(value||''))?value:'');
const keys=['reading','grammar','listening','writing','speaking'];
export function bar(label,entry,{showBand=true,hideLabel=false}={}){
  if(!entry)return `<div class="result-bar-label"><span${hideLabel?' class="sr-only"':''}>${esc(label)}</span><span class="phu-de">Chờ điểm</span></div>`;
  const percent=entry.max>0?Math.max(0,Math.min(100,entry.score/entry.max*100)):0;
  const band=showBand?gradeBand(entry.score,entry.max):null;
  return `<div class="result-bar"><div class="result-bar-label"><span${hideLabel?' class="sr-only"':''}>${esc(label)}</span><span class="result-bar-score"><strong>${esc(entry.score)}<small> / ${esc(entry.max)}</small></strong>${band?`<span class="score-badge score-${band.key}">${esc(band.label)}</span>`:''}</span></div><div class="result-track${band?' result-track--'+band.key:''}" role="img" aria-label="${esc(label)}: ${esc(entry.score)}/${esc(entry.max)} điểm${band?' · '+esc(band.label):''}"><span style="width:${percent}%"></span></div></div>`;
}
function option(q,index){
  if(index==null||index==='')return 'Chưa trả lời';
  const item=q.choices?.[Number(index)];
  if(!item)return esc(String(index));
  const text=typeof item==='object'?item.text:item;
  const image=typeof item==='object'?safeImage(item.imageUrl):'';
  return `${esc(text||String.fromCharCode(65+Number(index)))}${image?`<img class="result-answer-image" src="${esc(image)}" alt="Đáp án ${esc(String.fromCharCode(65+Number(index)))}" loading="lazy" referrerpolicy="no-referrer">`:''}`;
}
export function questionHtml(q,published,answerLabel='Bạn trả lời'){
  const verdict=published?questionVerdict(q):null;
  let body;
  if(q.fields?.length)body=q.fields.filter(f=>!['heading','note','image','signature'].includes(f.type)).map(f=>`<div class="result-answer"><strong>${esc(f.label||'Ô trả lời')}</strong><div>${textHtml(display(q.answer?.[f.index]))}</div>${published&&f.expected?`<div class="result-correct">Đáp án đúng: ${esc(display(f.expected))}</div>`:''}</div>`).join('');
  else if(q.type==='matching')body=(q.pairs||[]).map((pair,i)=>`<div class="result-answer">${esc(pair[0])}: ${esc(display(q.answer?.[i]))}${published?`<div class="result-correct">Đáp án đúng: ${esc(pair[1])}</div>`:''}</div>`).join('');
  else{
    const choice=['single','truefalse','cloze'].includes(q.type);
    body=`<div class="result-answer ${verdict==='wrong'?'result-wrong':''}"><span class="phu-de">${esc(answerLabel)}</span><div>${choice?option(q,q.answer):textHtml(display(q.answer))}</div></div>${published&&q.correct!=null?`<div class="result-answer result-answer--correct"><span>Đáp án đúng</span><div>${choice?option(q,q.correct):esc(display(q.correct))}</div></div>`:''}`;
  }
  return `<article class="result-question" data-result-verdict="${verdict||'manual'}"><div class="result-question-heading"><strong>Câu ${esc(q.number||'')} ${q.title?`· ${textHtml(q.title)}`:''}</strong>${verdict?`<span class="result-${verdict}">${labels[verdict]}</span>`:''}</div>${body}</article>`;
}
export function resultOutcomeHtml(summary,status='published',pendingLabel='Chờ chấm'){
  const result=status==='published'?resultLabel(summary?.result):null,tone=resultClass(result);
  const outcome=status!=='published'?pendingLabel:tone==='passed'?'Đạt':tone==='failed'?'Chưa đạt':result||'Chờ điểm';
  const band=['Xuất sắc','Giỏi','Khá','Đạt'].includes(result)?result:null;
  return `<div class="result-outcome ${tone}">${iconHtml(tone==='passed'?'example':tone==='failed'?'close':'grading')}<strong>${esc(outcome)}</strong>${band?`<span>${esc(band)}</span>`:''}</div>`;
}
function feedback(score){return `<div class="result-feedback"><h3>Nhận xét của cô</h3><p>${textHtml(score.feedback||'Chưa có nhận xét.')}</p>${score.reviewerName?`<div class="result-reviewer">${iconHtml('teacher')}<span>${esc(score.reviewerName)}</span></div>`:''}</div>`;}
export function resultStatsHtml({counts,total,max,visible=true,totalId='',speaking,showSpeaking=false}){
  const stat=(n,label)=>`<div><strong>${n}</strong><span>${label}</span></div>`;
  return `<div class="result-stats">${stat(visible?`${totalId?`<span id="${esc(totalId)}">${esc(total)}</span>`:esc(total)}${max?`<small>/${esc(max)}</small>`:''}`:'—','Tổng điểm')}${stat(visible?`${counts.correct}<small>/${counts.objective}</small>`:'—','Câu đúng')}${stat(visible?counts.wrong:'—','Câu sai')}${showSpeaking?stat(visible&&speaking?`${esc(speaking.score)}<small>/${esc(speaking.max)}</small>`:'—','Điểm nói'):stat(visible?counts.blank:'—','Bỏ trống')}</div>`;
}
export function attemptResultHtml({review,user={}}){
  const a=review.attempt||{},score=a.status==='published'?review.score:null,summary=score?.summary;
  const sections=review.sections||[],questions=sections.flatMap(s=>s.questions||[]),counts=reviewCounts(questions);
  const skills=keys.filter(k=>sections.some(s=>s.skill===k)||summary?.skills?.[k]||k==='speaking');
  const name=a.studentName||user.name||'Học viên',picture=safePicture(a.studentPicture||user.picture);
  const initials=name.trim().split(/\s+/).slice(-2).map(p=>p[0]).join('').toUpperCase();
  const max=summary?.complete?Object.values(summary.skills||{}).reduce((n,s)=>n+Number(s.max||0),0):null;
  const accuracy=counts.objective?Math.round(counts.correct/counts.objective*100):null;
  const total=summary?.total??score?.total??'—';
  const scoreBars=summary?keys.filter(k=>summary.skills[k]).map(k=>bar(SKILL_LABELS[k],summary.skills[k])).join(''):'<p class="phu-de">Điểm sẽ hiển thị sau khi công bố.</p>';
  const telc=summary&&isStandardTelc(summary);
  const passRow=(name,entry,min)=>`<div class="result-pass-row"><span>${name} <strong>${entry?`${esc(entry.score)}/${esc(entry.max)}`:'—'}</strong></span><span class="${entry?(entry.score>=min?'result-correct':'result-wrong'):''}">${entry?(entry.score>=min?'Đạt':'Chưa đạt'):'Chờ điểm'} · ≥${min}</span></div>`;
  return `<main class="khung result-page"><section class="the result-hero"><div class="result-heading"><div><div class="result-identity"><span class="result-avatar">${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><div><div class="phu-de">Kết quả thi ${esc(a.level||summary?.level||'')}</div><div class="result-name"><h1>${esc(name)}</h1>${score?`<button class="icon-btn" data-result-share aria-label="Chia sẻ kết quả" title="Chia sẻ kết quả">${iconHtml('share')}</button>`:''}</div></div></div><span class="result-provider">${esc(a.provider||summary?.provider||'')}</span><h2>${textHtml(a.examTitle||'Bài thi')}</h2><p class="phu-de">${esc(fmtDate(a.submittedAt||a.startedAt))} · Lần ${esc(a.attemptNo||1)}</p></div>${a.status==='incomplete'?`<div class="result-outcome"><strong>Không hoàn thành</strong></div>`:resultOutcomeHtml({...summary,result:score?.result||summary?.result},a.status)}</div>${resultStatsHtml({counts,total,max,visible:Boolean(score),speaking:summary?.skills?.speaking,showSpeaking:true})}<span class="phu-de" data-result-share-status role="status"></span></section>
  ${a.status==='incomplete'?'<p class="the">Bài thi không hoàn thành và không được chấm điểm.</p>':''}
  <div class="result-tabs" role="tablist" aria-label="Chi tiết kết quả">${['overview',...skills].map((k,i)=>`<button class="nut" role="tab" id="result-tab-${k}" data-result-tab="${k}" aria-controls="result-panel-${k}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${SKILL_LABELS[k]||'Tổng quan'}</button>`).join('')}</div>
  <section id="result-panel-overview" role="tabpanel" aria-labelledby="result-tab-overview"><div class="result-columns"><section class="the"><h2>Điểm từng phần</h2>${scoreBars}${telc?passRow('Khối viết',summary.written,TELC_SCORING.writtenPass)+passRow('Nói',summary.skills.speaking,TELC_SCORING.oralPass):summary?`<p class="phu-de">${esc(summary.condition)}</p>`:''}${summary&&!summary.skills.speaking?bar('Nói',null):''}</section><section class="the"><h2>Câu trắc nghiệm</h2>${score&&counts.objective?`<div class="result-donut" style="--correct-angle:${counts.correct/counts.objective*360}deg;--wrong-angle:${(counts.correct+counts.wrong)/counts.objective*360}deg" role="img" aria-label="${counts.correct} câu đúng, ${counts.wrong} câu sai, ${counts.blank} chưa trả lời"><div><strong>${accuracy}%</strong><span>${counts.correct}/${counts.objective} câu đúng</span></div></div><div class="result-legend"><span class="result-correct">● Đúng ${counts.correct}</span><span class="result-wrong">● Sai ${counts.wrong}</span><span>○ Bỏ trống ${counts.blank}</span></div>`:`<p class="phu-de">${score?'Không có câu trắc nghiệm.':'Chờ công bố kết quả.'}</p>`}${score?feedback(score):''}</section></div></section>
  ${skills.map(k=>`<section id="result-panel-${k}" role="tabpanel" aria-labelledby="result-tab-${k}" hidden><div class="the">${bar(SKILL_LABELS[k],summary?.skills[k],{hideLabel:true})}${score&&['reading','grammar','listening'].includes(k)?'<div class="result-filter" role="group" aria-label="Lọc câu trả lời"><button class="nut" data-result-filter="all" aria-pressed="true">Tất cả</button><button class="nut" data-result-filter="review" aria-pressed="false">Cần xem lại</button></div>':''}${sections.filter(s=>s.skill===k).map(s=>`<div class="result-part"><h3>${esc(s.name)}${score?.sections?.[s.name]!=null?` <span class="phu-de">· ${esc(score.sections[s.name])} điểm</span>`:''}</h3>${s.questions.map(q=>questionHtml(q,Boolean(score))).join('')}</div>`).join('')}${['writing','speaking'].includes(k)&&score?feedback(score):''}<p data-result-empty hidden class="phu-de">Không có câu cần xem lại.</p></div></section>`).join('')}</main>`;
}

export function resultShareText(review,user={}){
  if(review.attempt?.status!=='published'||!review.score)return null;
  const a=review.attempt,s=review.score,summary=s.summary;
  return [`${a.studentName||user.name||'Học viên'} · Kết quả thi ${a.level||summary?.level||''}`,
    `${a.provider||summary?.provider||''} · ${a.examTitle||'Bài thi'}`,
    `${summary?.total??s.total??'—'} điểm · ${resultLabel(summary?.result||s.result)||'Đã chấm'}`,
    ...Object.entries(summary?.skills||{}).map(([k,v])=>`${SKILL_LABELS[k]||k}: ${v.score}/${v.max}`),'G2G Career'].join('\n');
}
export function bindAttemptResult(root,{review,user,notify=()=>{}}){
  animateResult(root,review);
  const tabs=[...root.querySelectorAll('[data-result-tab]')];
  const activate=tab=>{tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;root.querySelector(`#result-panel-${b.dataset.resultTab}`).hidden=!active;});};
  tabs.forEach((tab,i)=>{tab.onclick=()=>activate(tab);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();activate(tabs[n]);tabs[n].focus();};});
  root.querySelectorAll('[data-result-filter]').forEach(b=>b.onclick=()=>{const panel=b.closest('[role="tabpanel"]'),filtered=b.dataset.resultFilter==='review';panel.querySelectorAll('[data-result-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));let shown=0;panel.querySelectorAll('[data-result-verdict]').forEach(q=>{q.hidden=filtered&&!['wrong','blank'].includes(q.dataset.resultVerdict);if(!q.hidden)shown++;});panel.querySelectorAll('.result-part').forEach(part=>part.hidden=![...part.querySelectorAll('[data-result-verdict]')].some(q=>!q.hidden));panel.querySelector('[data-result-empty]').hidden=shown>0;});
  const share=root.querySelector('[data-result-share]');
  if(share)share.onclick=async()=>{const text=resultShareText(review,user);if(!text)return;try{if(navigator.share)await navigator.share({title:'Kết quả thi · G2G',text});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);notify('Đã sao chép kết quả để chia sẻ.');}else notify('Trình duyệt chưa hỗ trợ chia sẻ.');}catch(e){if(e.name!=='AbortError')notify('Chưa chia sẻ được. Vui lòng thử lại.');}};
}
