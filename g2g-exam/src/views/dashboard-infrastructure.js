import {esc,fmtDate} from '../ui/format.js';
import {connectionStatusHtml} from './connection-status.js';
import {monitorChart,monitorRangePicker} from './monitor-chart.js';
import {resourceColumns} from './resource-charts.js';

const valid=value=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0;
const bytes=value=>{if(!valid(value))return '—';const units=['B','KB','MB','GB','TB'];let index=0,current=Number(value);while(current>=1024&&index<units.length-1){current/=1024;index++;}return `${current>=10||index===0?Math.round(current):current.toFixed(1)} ${units[index]}`;};
const percent=(used,total)=>valid(used)&&valid(total)&&Number(total)>0?Math.min(100,Number(used)/Number(total)*100):null;
const meter=(label,value,ratio)=>`<div class="dashboard-resource"><div><span>${label}</span><b>${value}</b></div>${ratio==null?'<span class="dashboard-resource-unavailable">Chưa có dữ liệu</span>':`<meter min="0" max="100" value="${ratio}" aria-label="${label}">${Math.round(ratio)}%</meter>`}</div>`;
const row=(label,value)=>`<div class="dashboard-row"><span>${label}</span><b>${bytes(value)}</b></div>`;
const date=value=>value&&Number.isFinite(new Date(value).getTime())?esc(new Date(value).toLocaleString('vi-VN')):'Chưa có';
export function dashboardR2Html(r2,history=[]){
  const count=value=>valid(value)?Number(value):'—';
  return `<section class="dashboard-details"><div class="dashboard-section-heading"><h3>Ảnh &amp; audio · R2</h3><a class="nut nho" href="/adm?tab=settings&amp;settings=general">Cấu hình R2</a></div>
    ${monitorChart('Đã đồng bộ','r2',history,bytes(r2?.syncedBytes),bytes)}
    <div class="monitor-r2-status"><span>${count(r2?.syncedFiles)} / ${count(r2?.totalFiles)} tệp</span>${r2?.error?'<span role="status">⚠ Có lỗi</span>':r2?.syncing?'<span>Đang đồng bộ</span>':''}</div>
    <details class="monitor-values"><summary>Chi tiết đồng bộ</summary><p>${r2?.error?esc(r2.error):!r2?.enabled?'Chưa bật R2':r2?.lastSuccessAt?'Đã đồng bộ':'Đang chờ quét'}</p><p>Chờ: ${count(r2?.pendingFiles)} · Vượt 25 MB: ${count(r2?.skippedFiles)}</p><small>Quét: ${date(r2?.lastScanAt)} · VPS dự phòng</small></details></section>`;
}

export function dashboardInfrastructureHtml(infrastructure,error=''){
  if(!infrastructure)return `<section class="the dashboard-infrastructure"><div class="dashboard-section-heading"><h2>Hệ thống</h2><span role="status">${error?'Không tải được dữ liệu':'Đang tải…'}</span></div>${error?'<p class="dashboard-caption">Tải lại trang để thử lại.</p>':''}</section>`;
  const resources=infrastructure.resources||{},memory=resources.memory||{},disk=resources.disk,usage=resources.usage||{},tables=resources.databaseTables||{};
  const gc=resources.mediaGarbageCollection||{};
  const memoryPercent=percent(memory.usedBytes,memory.totalBytes),diskPercent=percent(disk?.usedBytes,disk?.totalBytes);
  const cpu=valid(resources.cpu?.usagePercent)?Math.min(100,Number(resources.cpu.usagePercent)):null;
  const loads=[0,1,2].map(index=>valid(resources.cpu?.loadAverage?.[index])?Number(resources.cpu.loadAverage[index]).toFixed(2):'—');
  const cores=valid(resources.cpu?.cores)?Number(resources.cpu.cores):'—';
  const totalBytes=['databaseBytes','uploadsBytes','applicationBytes'].every(key=>valid(usage[key]))?Number(usage.databaseBytes)+Number(usage.uploadsBytes)+Number(usage.applicationBytes):null;
  const stamp=new Date(gc.lastSuccessAt);
  const gcText=gc.error?'Quét lỗi':gc.lastSuccessAt&&Number.isFinite(stamp.getTime())?'Đã quét':'Chưa có lần quét';
  const warnings=[memoryPercent>=85?'RAM từ 85%':null,diskPercent>=85?'Ổ đĩa từ 85%':null,gc.error?'Dọn tệp gặp lỗi':null].filter(Boolean);
  const storage=[...(infrastructure.examStorage||[])].sort((a,b)=>Number(b.totalBytes||0)-Number(a.totalBytes||0));
  return `<section class="the dashboard-infrastructure"><div class="dashboard-section-heading"><h2>Hệ thống</h2></div>
    <div class="tich-hop-tong-quan">${connectionStatusHtml(infrastructure)}</div>
    ${warnings.length?`<p class="dashboard-warning" role="status">${warnings.join(' · ')}</p>`:''}
    ${monitorRangePicker()}
    <div class="monitor-charts">
      ${monitorChart('CPU','cpu',resources.history,cpu==null?'—':cpu+'%',value=>value+'%')}
      ${monitorChart('RAM','memory',resources.history,memoryPercent==null?'—':Math.round(memoryPercent)+'%',value=>Math.round(value)+'%')}
    </div>
    <div class="monitor-r2-status"><span>Ổ đĩa</span><b>${bytes(disk?.usedBytes)} / ${bytes(disk?.totalBytes)}</b></div>
    <details class="monitor-values"><summary>Chi tiết máy chủ</summary><p>Tải trung bình: ${loads.join(' / ')} · 1 / 5 / 15 phút · ${cores} lõi</p><p>RAM: ${bytes(memory.usedBytes)} / ${bytes(memory.totalBytes)}</p><p>Dữ liệu hệ thống: ${bytes(totalBytes)} · Dọn tệp: ${gcText}</p></details>
    <div class="dashboard-system-panels">${dashboardR2Html(infrastructure.r2,resources.history)}
    <section class="dashboard-details dashboard-storage-breakdown">
      <div class="resource-breakdown">${resourceColumns([{label:'PostgreSQL',value:usage.databaseBytes},{label:'Ảnh & audio',value:usage.uploadsBytes},{label:'Mã nguồn',value:usage.applicationBytes}],bytes)}<div>${row('Bài làm',tables.attempts)}${row('Câu hỏi',tables.questions)}${row('Nhật ký',tables.audit_log)}</div></div>
      <p class="dashboard-caption">${gc.error?`Lỗi dọn tệp: ${esc(gc.error)}`:gc.lastSuccessAt&&Number.isFinite(stamp.getTime())?`Quét gần nhất: ${esc(stamp.toLocaleString('vi-VN'))} · Đã dọn ${Number(gc.deleted)||0} tệp (${bytes(gc.deletedBytes??0)})`:'Đang chờ lượt quét đầu tiên.'}</p>
    </section></div>
  </section>
    <section class="the dashboard-storage-card"><div class="dashboard-section-heading"><h2>Dung lượng đề thi</h2><span class="dashboard-caption">${storage.length} đề · lớn nhất trước</span></div>
      <div class="dashboard-exam-storage"><div class="table-wrap"><table class="bang"><thead><tr><th scope="col">Đề thi</th><th scope="col">Last edit</th><th scope="col">Câu</th><th scope="col">Media</th><th scope="col">Dữ liệu</th><th scope="col">Tổng</th></tr></thead><tbody>${storage.map(item=>`<tr><td><b>${esc(item.title)}</b><span class="phu">${esc([item.provider,item.level].filter(Boolean).join(' '))}</span></td><td>${fmtDate(item.updatedAt)}</td><td>${Number(item.questions)||0}</td><td>${Number(item.mediaFiles)||0} tệp · ${bytes(item.mediaBytes)}</td><td>${bytes(item.dataBytes)}</td><td><b>${bytes(item.totalBytes)}</b></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có đề thi.</td></tr>'}</tbody></table></div>
      </div>
    </section>`;
}
