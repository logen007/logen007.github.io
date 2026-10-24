import {esc,textHtml} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
export const speakingType=exam=>exam?.provider;
export const examTypeLabel=type=>type;
export function speakingExamCardHtml(exam){
  const duration=Math.ceil(Number(exam.durationSeconds||0)/60);
  return `<article class="the the-de" data-ascii-key="exam:${esc(exam.id)}"><h3 title="${esc(exam.title)}">${textHtml(exam.title)}</h3><div class="exam-card-details"><div class="exam-card-tags"><span class="nhan">Nói</span>${exam.provider?`<span class="nhan exam-provider" data-provider="${esc(exam.provider)}">${esc(exam.provider)}</span>`:''}<span class="nhan exam-level" data-level="${esc(exam.level)}">${esc(exam.level)}</span></div><span class="meta">2 thí sinh · ${Number(exam.partCount||0)} phần${duration?' · '+duration+' phút':''}</span></div><div class="exam-card-footer"><span class="exam-card-status">Thi trên điện thoại</span><button class="nut chinh" data-action="start-speaking" data-exam="${esc(exam.id)}" ${exam.hidden?'disabled':''}><span>Ghép cặp thi nói</span>${iconHtml('arrowRight')}</button></div></article>`;
}
