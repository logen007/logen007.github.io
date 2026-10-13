import {esc} from '../ui/format.js';

export function provisionalResultHtml(result){
  if(!result)return '';
  return `<div class="provisional-result"><p class="phu-de">Chờ giáo viên chấm và công bố kết quả chính thức.</p><div class="provisional-parts">${result.parts.map(part=>`<div class="provisional-part"><span>${esc(part.label)}</span>${part.score!=null?`<span class="provisional-score"><strong>${esc(part.score)}<small>/${esc(part.max)}</small></strong> <span>– điểm tạm tính</span></span>`:`<span class="phu-de">Chờ điểm</span>`}</div>`).join('')}</div></div>`;
}
