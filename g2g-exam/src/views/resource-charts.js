import {esc} from '../ui/format.js';
export function distributionChart(items){
  const total=items.reduce((sum,[,count])=>sum+count,0);
  if(!total)return '<p class="dashboard-empty">Chưa có đề thi.</p>';
  let offset=0;
  const slices=items.map(([name,count],index)=>{
    const size=count/total*100,start=offset;offset+=size;
    return `<circle cx="50" cy="50" r="38" pathLength="100" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-start}" style="--slice:${index%6}"/>`;
  }).join('');
  return `<div class="distribution-chart"><div class="distribution-plot"><svg viewBox="0 0 100 100" aria-hidden="true">${slices}</svg><div><b>${total}</b><span>đề thi</span></div></div><ul class="distribution-legend">${items.map(([name,count],index)=>`<li><i style="--slice:${index%6}" aria-hidden="true"></i><span>${esc(name)}</span><b>${count}</b></li>`).join('')}</ul></div>`;
}

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
