import {dashboardActivity} from './dashboard-activity.js';
import {aiProviderLabel} from '../domain/ai-providers.js';
import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {dashboardInfrastructureHtml} from './dashboard-infrastructure.js';
import {distributionChart} from './resource-charts.js';

const total=value=>Number(value||0).toLocaleString('vi-VN');
const writingPart=value=>{const text=String(value||''),number=text.match(/(?:teil|bài|viết|viet)\s*(\d+)/i)?.[1];return number?`Viết ${number}`:(text.trim()&&text.trim()!=='Viết'?text.trim():'Bài viết');};
export function dashboardHtml({data,infrastructure=null,infrastructureError='',now=new Date(),activityFilter={}}){
  const exams=data.exams.filter(ex=>ex.status!=='trash');
  const examById=new Map(exams.map(exam=>[exam.id,exam]));
  const questionById=new Map((data.questions||[]).map(question=>[question.id,question]));
  const accuracyGroups=new Map();
  for(const attempt of data.attempts)for(const item of Object.values(attempt.aiWritingAccuracy||{})){
    if(typeof item?.accurate!=='boolean')continue;
    const exam=examById.get(attempt.examId)||{};
    const provider=aiProviderLabel(item.provider);
    const section=(exam.sections||[]).find(section=>(section.questionIds||[]).includes(item.questionId));
    const part=writingPart(section?.name||questionById.get(item.questionId)?.title||item.part);
    const examName=exam.title||attempt.examTitle||'Đề thi',level=[exam.provider,exam.level].filter(Boolean).join(' ');
    const key=[examName,level,part,provider].join('\u0000');
    const group=accuracyGroups.get(key)||{examId:exam.id||attempt.examId||'',examName,level,part,provider,correct:0,total:0};
    group.total++;if(item.accurate)group.correct++;
    accuracyGroups.set(key,group);
  }
  const gradingOverview={needsGrading:data.attempts.filter(attempt=>attempt.status==='grading').length,graded:data.attempts.filter(attempt=>['ready','published'].includes(attempt.status)).length,aiAccuracy:[...accuracyGroups.values()].sort((a,b)=>b.total-a.total||a.examName.localeCompare(b.examName))};
  const activity=dashboardActivity(data,{range:['7','30','365'].includes(activityFilter.range)?activityFilter.range:'30'},now),months=activity.bins;
  const biggest=Math.max(1,...months.map(item=>item.count));
  const active=activity.active;
  const types=Object.entries(exams.reduce((out,ex)=>{const key=[ex.provider,ex.level].filter(Boolean).join(' ')||'Khác';out[key]=(out[key]||0)+1;return out;},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const grader=item=>{const initials=String(item.name||'GV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('').toUpperCase();return `<li class="dashboard-row"><span class="dashboard-person"><span class="dashboard-avatar">${item.picture?`<img src="${esc(item.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><span>${esc(item.name)}</span></span><b>${total(item.count)} bài</b></li>`;};
  return `<div class="admin-dashboard"><div class="tieu-de-trang dashboard-heading"><div><h1>Tổng quan</h1><p>${esc(now.toLocaleDateString('vi-VN',{day:'numeric',month:'long',year:'numeric'}))}</p></div><button class="nut chinh" data-action="new-exam">${iconHtml('plus')}<span>Tạo đề thi</span></button></div>
    <div class="dashboard-grid">
      <section class="the dashboard-panel dashboard-panel--growth"><header><h2>Học viên mới</h2><select class="truong dashboard-period-select" data-dashboard-range aria-label="Thời gian học viên mới">${[['7','Tuần'],['30','Tháng'],['365','Năm']].map(([id,label])=>`<option value="${id}" ${activity.mode===id?'selected':''}>${label}</option>`).join('')}</select></header><div class="dashboard-growth-total"><b>${total(months.reduce((sum,m)=>sum+m.count,0))}</b><span>học viên</span></div>
        <div class="dashboard-bars" style="--bars:${months.length}" role="list" aria-label="Học viên mới ${activity.unitLabel.toLowerCase()}">${months.map(item=>`<div role="listitem" aria-label="${item.label}: ${item.count} học viên"><b aria-hidden="true">${total(item.count)}</b><div class="dashboard-bar-track" aria-hidden="true"><span style="height:${item.count/biggest*100}%"></span></div><small aria-hidden="true">${item.label}</small></div>`).join('')}</div>
      </section>
      <section class="the dashboard-panel"><header><h2>Cơ cấu đề thi</h2><button class="text-link" data-action="admin-tab" data-tab="exams">Xem tất cả ${iconHtml('arrowRight')}</button></header>${distributionChart(types)}</section>
      <section class="the dashboard-panel"><header><h2>Học viên tích cực</h2><span>Top 5</span></header><ol class="dashboard-graders">${active.slice(0,5).map(grader).join('')||'<li class="dashboard-empty">Chưa có bài nộp.</li>'}</ol></section>
    </div>
    ${dashboardInfrastructureHtml(infrastructure,infrastructureError,gradingOverview)}
  </div>`;
}
