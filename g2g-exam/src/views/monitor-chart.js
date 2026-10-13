import {esc} from '../ui/format.js';

const known=value=>value!=null&&Number.isFinite(Number(value));
export function monitorChart(label,key,ranges,current,format){
  const panels=[1,24,168].map(hours=>{
    const range=ranges?.find(item=>item.hours===hours);
    const points=(range?.points||[]).filter(p=>known(p[key])&&Number.isFinite(new Date(p.at).getTime()));
    const max=key==='r2'?Math.max(1,...points.map(p=>Number(p[key]))):100;
    const x=p=>24+(new Date(p.at).getTime()-range.start)/(range.end-range.start)*292;
    const y=p=>104-Math.min(max,Math.max(0,Number(p[key])))/max*88;
    let previous=null;
    const path=points.map(p=>{
      const gap=!previous||new Date(p.at)-new Date(previous.at)>range.bucketSeconds*2000;
      previous=p;return `${gap?'M':'L'}${x(p).toFixed(1)},${y(p).toFixed(1)}`;
    }).join(' ');
    const time=value=>new Date(value).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `<div class="monitor-period monitor-period--${hours}">${points.length?`<svg viewBox="0 0 336 134" role="img" aria-label="${esc(label)} trong ${hours} giờ"><path class="monitor-grid" d="M24 16H316M24 60H316M24 104H316"/><text x="24" y="11">${esc(format(max))}</text><path class="monitor-line" d="${path}"/>${points.map(p=>`<circle class="${key==='r2'&&p.error?'monitor-error':'monitor-dot'}" cx="${x(p)}" cy="${y(p)}" r="${points.length===1||key==='r2'&&p.error?4:2}"><title>${esc(time(p.at)+' · '+format(Number(p[key]))+(key==='r2'&&p.error?' · Có lỗi đồng bộ':''))}</title></circle>`).join('')}<text x="24" y="128">${esc(time(range.start))}</text><text x="316" y="128" text-anchor="end">${esc(time(range.end))}</text></svg>`:'<p class="monitor-empty">Đang thu thập dữ liệu</p>'}<details class="monitor-values"><summary>Xem số đo</summary><small>Mỗi phút; khung dài hiển thị giá trị cao nhất mỗi khoảng.</small><div><table><tbody>${points.map(p=>`<tr><td>${esc(time(p.at))}</td><td>${esc(format(Number(p[key])))}</td><td>${key==='r2'&&p.error?'⚠':''}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  }).join('');
  return `<section class="monitor-chart"><header><span>${esc(label)}</span><strong>${esc(current)}</strong></header>${panels}</section>`;
}

export function monitorRangePicker(){
  return `<div class="monitor-range" role="group" aria-label="Khoảng thời gian">${[[1,'1 giờ'],[24,'24 giờ'],[168,'7 ngày']].map(([value,label])=>`<label><input type="radio" name="monitor-range" value="${value}" ${value===1?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
}
