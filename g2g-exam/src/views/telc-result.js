import {TELC_SCORING} from '../../specs/telc/scoring.js';
import {SKILL_LABELS} from '../domain/result-summary.js';
import {provisionalSkills} from './provisional-result.js';

const writtenKeys=Object.keys(TELC_SCORING.written);
const label=key=>key==='grammar'?'Ngữ pháp & từ vựng':SKILL_LABELS[key];
const sum=values=>Math.round(values.reduce((n,v)=>n+v,0)*100)/100;

export function telcResultSkills(review){
  if(review.attempt?.status==='published')return review.score?.summary?.skills||{};
  const skills=provisionalSkills(review.provisional);
  for(const key of writtenKeys){
    skills[key]||={max:TELC_SCORING.written[key],score:null,temporary:false};
  }
  return skills;
}

export function telcResultHtml(review,bar,skill){
  const skills=telcResultSkills(review),published=review.attempt?.status==='published';
  const row=(key,entry=skills[key])=>entry?.score!=null
    ?bar(label(key),entry,{showBand:false,temporary:Boolean(entry.temporary)})
    :bar(label(key)+' · /'+(entry?.max||TELC_SCORING.written[key]||TELC_SCORING.oralMax),null);
  if(skill)return row(skill);
  const complete=writtenKeys.every(key=>skills[key]?.score!=null&&skills[key].max===TELC_SCORING.written[key]);
  const written={score:complete?sum(writtenKeys.map(key=>skills[key].score)):null,
    max:TELC_SCORING.writtenMax,temporary:writtenKeys.some(key=>skills[key]?.temporary)};
  const block=(title,entry,max,minimum,children='')=>{
    const known=entry?.score!=null&&entry.max===max;
    const assessment=published&&known?{key:entry.score>=minimum?'sufficient':'failed',label:entry.score>=minimum?'Đạt':'Chưa đạt'}:null;
    return `<section class="telc-result-block">${known?bar(title,entry,{showBand:false,temporary:Boolean(entry.temporary),assessment}):bar(title,null,{pendingMax:max})}${children}</section>`;
  };
  return '<section class="the telc-result-card">'+block('Khối thi viết',written,TELC_SCORING.writtenMax,TELC_SCORING.writtenPass,
    `<div class="telc-result-children">${writtenKeys.map(key=>row(key)).join('')}</div>`)+
    block('Khối thi nói',skills.speaking,TELC_SCORING.oralMax,TELC_SCORING.oralPass)+
    (!published?'<p class="phu-de">Chờ giáo viên chấm và công bố kết quả chính thức.</p>':'')+'</section>';
}
