import {esc} from '../ui/format.js';
import {SKILL_LABELS} from '../domain/result-summary.js';
import {resultClass,gradeBand} from '../domain/gradebook.js';

export function resultSummaryHtml(summary,{title}={}){
  if(!summary)return '';
  const keys=['reading','grammar','listening','writing','speaking'].filter(key=>summary.skills[key]);
  return `<section class="the result-breakdown"><h2>${title?esc(title):`${esc(summary.provider||'')} ${esc(summary.level||'')} · Kết quả theo kỹ năng`}</h2>${title?`<p class="phu-de">${esc(summary.provider==='GOETHE'?'Goethe':summary.provider)} ${esc(summary.level||'')}</p>`:''}<div class="table-wrap"><table class="bang"><thead><tr><th>Kỹ năng</th><th>Điểm</th><th>Tỷ lệ</th><th>Kết quả</th></tr></thead><tbody>${keys.map(key=>{const entry=summary.skills[key],band=gradeBand(entry.score,entry.max);return `<tr><td>${SKILL_LABELS[key]}</td><td>${entry.score}/${entry.max}</td><td>${entry.max?Math.round(entry.score/entry.max*100):0}%</td><td>${band?`<span class="score-badge score-${band.key}">${band.label}</span>`:'—'}</td></tr>`;}).join('')}${summary.provider==='TELC'?`<tr><td>Tổng phần viết</td><td>${summary.written.score}/${summary.written.max}</td><td></td><td></td></tr>`:''}</tbody></table></div><p>${esc(summary.condition)}</p><p>Tổng điểm: <strong>${summary.total}</strong> · <span class="exam-latest-result ${resultClass(summary.result)}">${esc(summary.result)}</span></p></section>`;
}
