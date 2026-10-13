import {esc} from '../ui/format.js';

const known=value=>value!=null&&Number.isFinite(Number(value));
const periods=[[1,'1 giờ'],[24,'24 giờ'],[168,'1 tuần'],[720,'1 tháng'],[8760,'1 năm']];
export function monitorChart(label,key,ranges,current,format,{hideLabel=false,detailsLabel='Xem số đo',detailsContent=''}={}){
  const panels=periods.map(([hours])=>{
    const range=ranges?.find(item=>item.hours===hours);
    const points=(range?.points||[]).filter(p=>known(p[key])&&Number.isFinite(new Date(p.at).getTime()));
    const max=key==='r2'?Math.max(1,...points.map(p=>Number(p[key]))):100;
    const x=p=>54+(new Date(p.at).getTime()-range.start)/(range.end-range.start)*666;
    const y=p=>252-Math.min(max,Math.max(0,Number(p[key])))/max*228;
    let previous=null;
    const segments=[];
    const path=points.map(p=>{
      const gap=!previous||new Date(p.at)-new Date(previous.at)>range.bucketSeconds*2000;
      if(gap)segments.push([]);
      segments.at(-1).push(p);
      previous=p;return `${gap?'M':'L'}${x(p).toFixed(1)},${y(p).toFixed(1)}`;
    }).join(' ');
    const time=value=>new Date(value).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const area=segments.filter(segment=>segment.length>1).map(segment=>`M${x(segment[0]).toFixed(1)},252 ${segment.map(p=>`L${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ')} L${x(segment.at(-1)).toFixed(1)},252 Z`).join(' ');
    const ticks=Array.from({length:range?7:0},(_,i)=>{
      const at=range.start+(range.end-range.start)*i/6;
      const text=new Date(at).toLocaleString('vi-VN',hours<=24?{hour:'2-digit',minute:'2-digit'}:hours<8760?{day:'2-digit',month:'2-digit'}:{month:'2-digit',year:'2-digit'});
      return `<text x="${54+i*111}" y="280" text-anchor="${i===0?'start':i===6?'end':'middle'}">${esc(text)}</text>`;
    });
    const stat=value=>known(value)?esc(format(Math.round(Number(value)*10)/10)):'—';
    const stats=range?.stats;
    const summary=key==='cpu'?`<div class="monitor-summary-wrap"><table class="monitor-summary"><thead><tr><th>Chỉ số</th><th>Cao nhất</th><th>Trung bình</th><th>Hiện tại</th></tr></thead><tbody><tr><th scope="row">CPU</th><td>${stat(stats?.maximum)}</td><td>${stat(stats?.average)}</td><td>${esc(current)}</td></tr></tbody></table></div>`:'';
    return `<div class="monitor-period monitor-period--${hours}">${points.length?`<svg viewBox="0 0 744 296" role="img" aria-label="${esc(label)} trong ${hours} giờ"><path class="monitor-grid" d="M54 24H720M54 81H720M54 138H720M54 195H720M54 252H720"/><path class="monitor-axis" d="M54 24V252H720"/>${[100,75,50,25,0].map((value,i)=>`<text x="46" y="${29+i*57}" text-anchor="end">${esc(format(max*value/100))}</text>`).join('')}<path class="monitor-area" d="${area}"/><path class="monitor-line" d="${path}"/>${points.map(p=>`<circle class="${key==='r2'&&p.error?'monitor-error':'monitor-dot'}" cx="${x(p)}" cy="${y(p)}" r="${points.length===1||key==='r2'&&p.error?4:3}"><title>${esc(time(p.at)+' · '+format(Number(p[key]))+(key==='r2'&&p.error?' · Có lỗi đồng bộ':''))}</title></circle>`).join('')}${ticks.join('')}</svg>`:'<p class="monitor-empty">Đang thu thập dữ liệu</p>'}${summary}<details class="monitor-values"><summary>${esc(detailsLabel)}</summary>${detailsContent}<small>Mẫu mỗi phút; CPU ở khung dài là trung bình từng khoảng. Thống kê tính trên các mẫu gốc có dữ liệu.</small><div><table><tbody>${points.map(p=>`<tr><td>${esc(time(p.at))}</td><td>${esc(format(Number(p[key])))}</td><td>${key==='r2'&&p.error?'⚠':''}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  }).join('');
  return `<section class="monitor-chart"><header><span ${hideLabel?'class="sr-only"':''}>${esc(label)}</span><strong>${esc(current)}</strong></header>${panels}</section>`;
}

export function monitorRangePicker(){
  return `<div class="monitor-range" role="group" aria-label="Khoảng thời gian">${periods.map(([value,label])=>`<label><input type="radio" name="monitor-range" value="${value}" ${value===1?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
}
