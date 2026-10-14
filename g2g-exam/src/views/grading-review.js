import {esc,fmtDate} from '../ui/format.js';
import {buildAttemptReview,reviewCounts} from '../domain/attempt-review.js';
import {isAutomaticWritingForm} from '../domain/writing-form.js';
import {questionHtml,resultOutcomeHtml,bar,resultStatsHtml} from './attempt-result.js';
import {SKILL_LABELS} from '../domain/result-summary.js';
import {animateResultBadge} from '../ui/result-badge-motion.js';

const animatedBadges=new WeakSet();

// Teacher-only presentation: the caller already loaded the authorized grading detail.
// Do not change the student review projection or its publication gate.
export function gradingAutomaticHtml(exam,questions,attempt){
  const automatic=new Set((exam.sections||[]).flatMap(section=>(section.questionIds||[]).filter(id=>{
    const q=questions.find(q=>q.id===id);
    return q&&(q.autoGrade||isAutomaticWritingForm(exam,section,q));
  })));
  const review=buildAttemptReview({exam,questions,attempt:{...attempt,status:'published'}});
  const sections=review.sections.map(s=>({...s,questions:s.questions.filter(q=>automatic.has(q.id))})).filter(s=>s.questions.length);
  const skills=[...new Set(sections.map(s=>s.skill))];
  if(!skills.length)return '<p class="phu-de">Không có câu trắc nghiệm.</p>';
  return `<div data-grade-tabs><div class="result-tabs" role="tablist" aria-label="Trắc nghiệm">${skills.map((skill,i)=>{
    const counts=reviewCounts(sections.filter(s=>s.skill===skill).flatMap(s=>s.questions));
    return `<button class="nut" role="tab" id="grade-auto-tab-${i}" aria-controls="grade-auto-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${esc(skill==='grammar'?'SB':SKILL_LABELS[skill]||skill)}${counts.objective?` <small>${counts.correct}/${counts.objective}</small>`:''}</button>`;
  }).join('')}</div>${skills.map((skill,i)=>`<section role="tabpanel" id="grade-auto-panel-${i}" aria-labelledby="grade-auto-tab-${i}" ${i?'hidden':''}><div class="result-filter" role="group" aria-label="Lọc câu trả lời"><button class="nut" data-grade-filter="all" aria-pressed="true">Tất cả</button><button class="nut" data-grade-filter="wrong" aria-pressed="false">Câu sai (${reviewCounts(sections.filter(s=>s.skill===skill).flatMap(s=>s.questions)).wrong})</button><button class="nut" data-grade-filter="blank" aria-pressed="false">Chưa trả lời (${reviewCounts(sections.filter(s=>s.skill===skill).flatMap(s=>s.questions)).blank})</button></div>${sections.filter(s=>s.skill===skill).map(s=>`<div class="result-part"><h3>${esc(s.name)}</h3><div class="grading-question-grid">${s.questions.map(q=>questionHtml(q,true,'Học viên trả lời')).join('')}</div></div>`).join('')}<p class="phu-de" data-grade-empty hidden>Không có câu phù hợp.</p></section>`).join('')}</div>`;
}

export function gradingIdentityHtml(data,attempt){
  const student=(data.users||[]).find(u=>u.id===attempt.studentId);
  const classroom=(data.classes||[]).find(c=>c.id===student?.classId);
  const name=student?.name||attempt.studentName||'Học viên';
  const picture=/^https?:\/\//i.test(student?.picture||'')?student.picture:null;
  const initials=name.trim().split(/\s+/).slice(-2).map(p=>p[0]).join('').toUpperCase();
  return `<div class="grading-identity"><span class="result-avatar">${picture?`<img src="${esc(picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><div><h1>${esc(name)}</h1><span class="grading-class">${esc(classroom&&classroom.code!=='Extend'?classroom.code:'Chưa có lớp')}</span></div></div>`;
}

export function gradingOutcomeHtml(summary,attempt){return resultOutcomeHtml(summary,attempt.status);}

export function gradingStatsHtml(exam,questions,attempt,summary){
  const review=buildAttemptReview({exam,questions,attempt:{...attempt,status:'published'}});
  const counts=reviewCounts(review.sections.flatMap(s=>s.questions));
  const max=summary.complete?Object.values(summary.skills||{}).reduce((sum,s)=>sum+Number(s.max||0),0):null;
  return resultStatsHtml({counts,total:summary.total,max,totalId:'gradeHeaderTotal'});
}

export function gradingScoreBarsHtml(summary){
  return `<section class="the grading-panel grading-scores"><h2>Điểm từng phần</h2><div class="grading-score-grid">${['reading','grammar','listening','writing','speaking'].filter(key=>summary.skills?.[key]).map(key=>bar(SKILL_LABELS[key],summary.skills[key],{showBand:true})).join('')}</div></section>`;
}

export function gradingPanelsHtml(items,prefix,{actions='',wrap=html=>html}={}){
  if(actions)return `<div data-grade-tabs><div class="grading-toolbar"><div class="result-tabs" role="tablist" aria-label="Bài cần chấm">${items.map((item,i)=>`<button class="nut" role="tab" id="${prefix}-tab-${i}" aria-controls="${prefix}-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${esc(item.label)}</button>`).join('')}</div><div class="nhom-nut">${actions}</div></div>${wrap(items.map((item,i)=>`<section role="tabpanel" id="${prefix}-panel-${i}" aria-labelledby="${prefix}-tab-${i}" ${i?'hidden':''}>${item.html}</section>`).join(''))}</div>`;
  if(items.length<2)return items.map(item=>item.html).join('');
  return `<div data-grade-tabs><div class="result-tabs" role="tablist" aria-label="Bài cần chấm">${items.map((item,i)=>`<button class="nut" role="tab" id="${prefix}-tab-${i}" aria-controls="${prefix}-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${esc(item.label)}</button>`).join('')}</div>${items.map((item,i)=>`<section role="tabpanel" id="${prefix}-panel-${i}" aria-labelledby="${prefix}-tab-${i}" ${i?'hidden':''}>${item.html}</section>`).join('')}</div>`;
}

export function gradingHistory(data,exam,attempt){
  return (data.attempts||[]).filter(a=>a.studentId===attempt.studentId&&a.status==='published').map(a=>{
    const source=a.resultSummary||a.examSnapshot||(data.exams||[]).find(e=>e.id===a.examId);
    const summary=a.resultSummary;
    if(source?.provider!==exam.provider||source?.level!==exam.level||!summary?.complete)return null;
    const max=Object.values(summary.skills||{}).reduce((sum,s)=>sum+Number(s.max||0),0);
    if(!(max>0)||!Number.isFinite(Number(summary.total)))return null;
    return {id:a.id,date:a.submittedAt||a.startedAt,score:Number(summary.total),max,percent:Math.min(100,Math.max(0,Number(summary.total)/max*100))};
  }).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

export function gradingHistoryHtml(data,exam,attempt){
  const points=gradingHistory(data,exam,attempt);
  const label=`Lịch sử điểm · ${exam.provider||''} ${exam.level||''}`;
  if(!points.length)return `<section class="the grading-history"><h2>${esc(label)}</h2><p class="phu-de">Chưa có kết quả đã công bố.</p></section>`;
  // Scroll-free chart plus an accessible list of exact scores; no simulated history.
  const shown=points.slice(-8),x=i=>shown.length===1?300:42+i*516/(shown.length-1),y=p=>112-p*.85;
  return `<section class="the grading-history"><h2>${esc(label)}</h2><svg viewBox="0 0 600 140" role="img" aria-label="${esc(shown.map((p,i)=>`Lần ${points.length-shown.length+i+1}: ${p.score}/${p.max}`).join(', '))}"><line class="history-axis" x1="42" y1="112" x2="558" y2="112"/><text x="6" y="30">100%</text><text x="16" y="116">0%</text>${shown.length>1?`<polyline class="history-line" points="${shown.map((p,i)=>`${x(i)},${y(p.percent)}`).join(' ')}"/>`:''}${shown.map((p,i)=>`<circle class="history-point" cx="${x(i)}" cy="${y(p.percent)}" r="4"><title>${esc(fmtDate(p.date))}: ${p.score}/${p.max}</title></circle><text text-anchor="middle" x="${x(i)}" y="${y(p.percent)-10}">${Math.round(p.percent)}%</text><text text-anchor="middle" x="${x(i)}" y="135">${points.length-shown.length+i+1}</text>`).join('')}</svg><div class="grading-history-values">${shown.map((p,i)=>`<span title="${esc(fmtDate(p.date))}">Lần ${points.length-shown.length+i+1} <b>${p.score}/${p.max}</b></span>`).join('')}</div></section>`;
}

export function bindGradingReview(root){
  root.querySelectorAll('.grading-hero .result-medal').forEach(badge=>{
    if(animatedBadges.has(badge))return;
    animatedBadges.add(badge);
    animateResultBadge(badge);
  });
  root.querySelectorAll('.manual-score').forEach(input=>input.addEventListener('invalid',()=>{
    let panel=input.closest('[role="tabpanel"]');
    while(panel){root.querySelector('#'+panel.getAttribute('aria-labelledby'))?.click();panel=panel.parentElement.closest('[role="tabpanel"]');}
  }));
  root.querySelectorAll('[data-grade-tabs]').forEach(group=>{
    const tabs=[...group.querySelectorAll('[role="tab"]')].filter(t=>t.closest('[data-grade-tabs]')===group);
    const activate=tab=>tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;group.querySelector('#'+t.getAttribute('aria-controls')).hidden=!active;});
    tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next===null)return;e.preventDefault();activate(tabs[next]);tabs[next].focus();});});
  });
  root.querySelectorAll('[data-grade-filter]').forEach(button=>button.addEventListener('click',()=>{
    const panel=button.closest('[role="tabpanel"]'),filter=button.dataset.gradeFilter;
    panel.querySelectorAll('[data-grade-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    let visible=0;panel.querySelectorAll('[data-result-verdict]').forEach(q=>{q.hidden=filter!=='all'&&q.dataset.resultVerdict!==filter;if(!q.hidden)visible++;});
    panel.querySelectorAll('.result-part').forEach(part=>part.hidden=![...part.querySelectorAll('[data-result-verdict]')].some(q=>!q.hidden));
    panel.querySelector('[data-grade-empty]').hidden=visible>0;
  }));
}
