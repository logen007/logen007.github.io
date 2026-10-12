import {esc} from '../ui/format.js';

const valid=value=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0;
const bytes=value=>{if(!valid(value))return '—';const units=['B','KB','MB','GB','TB'];let index=0,current=Number(value);while(current>=1024&&index<units.length-1){current/=1024;index++;}return `${current>=10||index===0?Math.round(current):current.toFixed(1)} ${units[index]}`;};
const percent=(used,total)=>valid(used)&&valid(total)&&Number(total)>0?Math.min(100,Number(used)/Number(total)*100):null;
const meter=(label,value,ratio)=>`<div class="dashboard-resource"><div><span>${label}</span><b>${value}</b></div>${ratio==null?'<span class="dashboard-resource-unavailable">Chưa có dữ liệu</span>':`<meter min="0" max="100" value="${ratio}" aria-label="${label}">${Math.round(ratio)}%</meter>`}</div>`;
const row=(label,value)=>`<div class="dashboard-row"><span>${label}</span><b>${bytes(value)}</b></div>`;

export function dashboardInfrastructureHtml(infrastructure,error=''){
  if(!infrastructure)return `<section class="the dashboard-infrastructure"><div class="dashboard-section-heading"><h2>Hệ thống</h2><span role="status">${error?'Không tải được dữ liệu':'Đang tải…'}</span></div>${error?'<p class="dashboard-caption">Tải lại trang để thử lại.</p>':''}</section>`;
  const resources=infrastructure.resources||{},memory=resources.memory||{},disk=resources.disk,usage=resources.usage||{},tables=resources.databaseTables||{};
  const gc=resources.mediaGarbageCollection||{};
  const memoryPercent=percent(memory.usedBytes,memory.totalBytes),diskPercent=percent(disk?.usedBytes,disk?.totalBytes);
  const cpu=valid(resources.cpu?.loadPercent)?Math.min(100,Number(resources.cpu.loadPercent)):null;
  const totalBytes=['databaseBytes','uploadsBytes','applicationBytes'].every(key=>valid(usage[key]))?Number(usage.databaseBytes)+Number(usage.uploadsBytes)+Number(usage.applicationBytes):null;
  const stamp=new Date(gc.lastSuccessAt);
  const gcText=gc.error?'Quét lỗi':gc.lastSuccessAt&&Number.isFinite(stamp.getTime())?'Đã quét':'Chưa có lần quét';
  const warnings=[memoryPercent>=85?'RAM từ 85%':null,diskPercent>=85?'Ổ đĩa từ 85%':null,gc.error?'Dọn tệp gặp lỗi':null].filter(Boolean);
  const storage=[...(infrastructure.examStorage||[])].sort((a,b)=>Number(b.totalBytes||0)-Number(a.totalBytes||0));
  return `<section class="the dashboard-infrastructure"><div class="dashboard-section-heading"><h2>Hệ thống</h2><span class="dashboard-caption">Tài nguyên hệ thống</span></div>
    ${warnings.length?`<p class="dashboard-warning" role="status">${warnings.join(' · ')}</p>`:''}
    <div class="dashboard-resource-grid">
      ${meter('Tải CPU · 1 phút',cpu==null?'—':cpu+'%',cpu)}
      ${meter('RAM',`${bytes(memory.usedBytes)} / ${bytes(memory.totalBytes)}`,memoryPercent)}
      ${meter('Ổ đĩa',`${bytes(disk?.usedBytes)} / ${bytes(disk?.totalBytes)}`,diskPercent)}
      <div class="dashboard-resource dashboard-resource-total"><span>Dữ liệu hệ thống</span><b>${bytes(totalBytes)}</b><small>Dọn tệp: ${gcText}</small></div>
    </div>
    <details class="dashboard-details" ${gc.error?'open':''}><summary>Chi tiết tài nguyên <span>Cơ sở dữ liệu, tệp &amp; nhật ký</span></summary>
      <div class="resource-breakdown">${row('PostgreSQL',usage.databaseBytes)}${row('Audio &amp; hình ảnh',usage.uploadsBytes)}${row('Mã nguồn',usage.applicationBytes)}${row('Bài làm · trong PostgreSQL',tables.attempts)}${row('Câu hỏi · trong PostgreSQL',tables.questions)}${row('Nhật ký · trong PostgreSQL',tables.audit_log)}</div>
      <p class="dashboard-caption">${gc.error?`Lỗi dọn tệp: ${esc(gc.error)}`:gc.lastSuccessAt&&Number.isFinite(stamp.getTime())?`Quét gần nhất: ${esc(stamp.toLocaleString('vi-VN'))} · Đã dọn ${Number(gc.deleted)||0} tệp (${bytes(gc.deletedBytes??0)})`:'Đang chờ lượt quét đầu tiên.'}</p>
    </details>
    <details class="dashboard-details"><summary>Dung lượng đề thi <span>${storage.length} đề · lớn nhất trước</span></summary>
      <div class="dashboard-exam-storage"><div class="table-wrap"><table class="bang"><thead><tr><th scope="col">Đề thi</th><th scope="col">Câu</th><th scope="col">Media</th><th scope="col">Dữ liệu</th><th scope="col">Tổng</th></tr></thead><tbody>${storage.map(item=>`<tr><td><b>${esc(item.title)}</b><span class="phu">${esc([item.provider,item.level].filter(Boolean).join(' '))}</span></td><td>${Number(item.questions)||0}</td><td>${Number(item.mediaFiles)||0} tệp · ${bytes(item.mediaBytes)}</td><td>${bytes(item.dataBytes)}</td><td><b>${bytes(item.totalBytes)}</b></td></tr>`).join('')||'<tr><td colspan="5" class="rong">Chưa có đề thi.</td></tr>'}</tbody></table></div>
      </div>
    </details>
  </section>`;
}
