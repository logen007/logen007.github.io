import {esc} from './format.js';

// Attribute hooks are supplied by the owning editor; score persistence stays there.
export function scoreInput(value,{attributes='',disabled=false,label='Điểm'}={}){
  return `<label class="compact-score"><input type="number" min="0" step="any" aria-label="${esc(label)}" ${attributes} value="${esc(value??0)}" ${disabled?'disabled':''}><span>đ</span></label>`;
}
