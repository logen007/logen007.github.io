// Use the existing result bars; only estimated writing scores need a special label.
export function provisionalResultHtml(result,renderBar,skill){
  if(!result)return '';
  const parts=result.parts.filter(part=>!skill||part.skill===skill);
  return parts.map(part=>renderBar(part.label,part.score==null?null:part,{showBand:part.source==='automatic',temporary:part.source==='ai'})).join('')+
    (!skill?'<p class="phu-de">Chờ giáo viên chấm và công bố kết quả chính thức.</p>':!parts.length?'<p class="phu-de">Chờ điểm</p>':'');
}
