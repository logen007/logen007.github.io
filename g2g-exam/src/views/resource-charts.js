import {esc} from '../ui/format.js';

// Decorative SVGs always accompany equivalent visible values; no chart dependency.
export function resourceRing(label,value,ratio,{warning=false}={}){
  const known=Number.isFinite(ratio),progress=known?Math.max(0,Math.min(100,ratio)):0;
  return `<div class="resource-ring ${warning?'resource-ring--warning':''}"><div class="resource-ring-plot"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="resource-ring-track" cx="40" cy="40" r="32"/><circle class="resource-ring-fill" cx="40" cy="40" r="32" pathLength="100" stroke-dasharray="${progress} 100"/></svg><b>${known?Math.round(progress)+'%':'—'}</b></div><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div></div>`;
}
export function resourceColumns(items,format){
  const known=value=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0;
  const max=Math.max(1,...items.map(item=>known(item.value)?Number(item.value):0));
  return `<div class="resource-columns">${items.map(item=>`<div class="resource-column"><b>${esc(format(item.value))}</b><div class="resource-column-track" aria-hidden="true"><i style="height:${known(item.value)?Number(item.value)/max*100:0}%"></i></div><span>${esc(item.label)}</span></div>`).join('')}</div>`;
}
