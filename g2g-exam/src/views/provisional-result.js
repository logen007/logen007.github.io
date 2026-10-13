import {SKILL_LABELS} from '../domain/result-summary.js';
import {esc} from '../ui/format.js';

export function sectionResultHtml(review,section){
  if(review.attempt?.status==='published'){
    const value=review.score?.sections?.[section.name];
    return value!=null?` <span class="phu-de">· ${esc(value)} điểm</span>`:'';
  }
  const parts=(review.provisional?.parts||[]).filter(p=>p.label===section.name||p.label.startsWith(section.name+' · Bài '));
  return parts.map(p=>` <span class="${p.source==='ai'&&p.score!=null?'provisional-score':'phu-de'}">· ${p.score==null?'Chờ điểm':`${esc(p.score)}/${esc(p.max)}${p.source==='ai'?' – điểm tạm tính':''}`}</span>`).join('');
}

export function provisionalSkills(result){
  const skills={};
  for(const part of result?.parts||[]){
    const entry=skills[part.skill]||={score:0,max:0,temporary:false};
    entry.max+=Number(part.max)||0;
    entry.score=entry.score==null||part.score==null?null:entry.score+Number(part.score);
    entry.temporary||=part.source==='ai';
  }
  for(const entry of Object.values(skills)){
    if(entry.score!=null)entry.score=Math.round(entry.score*100)/100;
    entry.max=Math.round(entry.max*100)/100;
  }
  return skills;
}

// Match the published skill order and grouping, including pending speaking.
export function provisionalResultHtml(result,renderBar,skill){
  if(!result)return '';
  const skills=provisionalSkills(result);
  const keys=skill?[skill]:Object.keys(SKILL_LABELS).filter(key=>skills[key]||key==='speaking');
  return keys.map(key=>{
    const entry=skills[key];
    return renderBar(SKILL_LABELS[key]||key,entry?.score!=null?entry:null,
      {hideLabel:Boolean(skill),showBand:!entry?.temporary,temporary:Boolean(entry?.temporary)});
  }).join('')+(!skill?'<p class="phu-de">Chờ giáo viên chấm và công bố kết quả chính thức.</p>':'');
}
