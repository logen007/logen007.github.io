import {esc} from '../ui/format.js';
import {connectionStatusHtml} from './connection-status.js';
import {resourceRing,resourceColumns} from './resource-charts.js';

const valid=value=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0;
const bytes=value=>{if(!valid(value))return '—';const units=['B','KB','MB','GB','TB'];let index=0,current=Number(value);while(current>=1024&&index<units.length-1){current/=1024;index++;}return `${current>=10||index===0?Math.round(current):current.toFixed(1)} ${units[index]}`;};
const percent=(used,total)=>valid(used)&&valid(total)&&Number(total)>0?Math.min(100,Number(used)/Number(total)*100):null;
const meter=(label,value,ratio)=>`<div class="dashboard-resource"><div><span>${label}</span><b>${value}</b></div>${ratio==null?'<span class="dashboard-resource-unavailable">Chưa có dữ liệu</span>':`<meter min="0" max="100" value="${ratio}" aria-label="${label}">${Math.round(ratio)}%</meter>`}</div>`;
const row=(label,value)=>`<div class="dashboard-row"><span>${label}</span><b>${bytes(value)}</b></div>`;
const date=value=>value&&Number.isFinite(new Date(value).getTime())?esc(new Date(value).toLocaleString('vi-VN')):'Chưa có';
export function dashboardR2Html(r2){
  const known=r2&&valid(r2.totalFiles),count=value=>valid(value)?Number(value):'—';
  const state=!r2?'Chưa có dữ liệu':r2.error?'Cần kiểm tra':!r2.enabled?'Đang tắt · dùng VPS':r2.syncing?'Đang đồng bộ':!known?'Đang chờ quét':r2.pendingFiles||r2.skippedFiles?'Chưa đồng bộ hết':'Đã đồng bộ';
  return `<section class="dashboard-details"><div class="dashboard-section-heading"><h3>Ảnh &amp; audio · R2</h3><a class="nut nho" href="/adm?tab=settings&amp;settings=general">Cấu hình R2</a></div>${state==='Đã đồng bộ'?'':`<p role="status" class="${r2?.error?'dashboard-warning':'dashboard-caption'}">${state}</p>`}
    <div class="r2-visual-summary">${resourceRing('Tệp đã đồng bộ',`${count(r2?.syncedFiles)} / ${count(r2?.totalFiles)}`,percent(r2?.syncedFiles,r2?.totalFiles))}<div class="r2-visual-facts"><div><b>${bytes(r2?.syncedBytes)}</b><span>Bản đồng bộ</span></div><div><b>${count(r2?.pendingFiles)}</b><span>Chờ đồng bộ</span></div><div><b>${count(r2?.skippedFiles)}</b><span>Vượt 25 MB</span></div></div></div>
    ${r2?.error?`<p class="dashboard-warning">${esc(r2.error)}</p>`:''}<p class="dashboard-caption" title="Hoàn tất gần nhất: ${date(r2?.lastSuccessAt)}">Quét: ${date(r2?.lastScanAt)} · Mỗi 5 phút · VPS dự phòng</p></section>`;
}

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
  return `<section class="the dashboard-infrastructure"><div class="dashboard-section-heading"><h2>Hệ thống</h2></div>
    <div class="tich-hop-tong-quan">${connectionStatusHtml(infrastructure)}</div>
    ${warnings.length?`<p class="dashboard-warning" role="status">${warnings.join(' · ')}</p>`:''}
    <div class="dashboard-resource-grid">
      ${resourceRing('Tải CPU · 1 phút',cpu==null?'Chưa có dữ liệu':cpu+'%',cpu,{warning:cpu>=85})}
      ${resourceRing('RAM',`${bytes(memory.usedBytes)} / ${bytes(memory.totalBytes)}`,memoryPercent,{warning:memoryPercent>=85})}
      ${resourceRing('Ổ đĩa',`${bytes(disk?.usedBytes)} / ${bytes(disk?.totalBytes)}`,diskPercent,{warning:diskPercent>=85})}
      <div class="dashboard-resource dashboard-resource-total"><span>Dữ liệu hệ thống</span><b>${bytes(totalBytes)}</b><small>Dọn tệp: ${gcText}</small></div>
    </div>
    ${dashboardR2Html(infrastructure.r2)}
    <section class="dashboard-details">
      <div class="resource-breakdown">${resourceColumns([{label:'PostgreSQL',value:usage.databaseBytes},{label:'Ảnh & audio',value:usage.uploadsBytes},{label:'Mã nguồn',value:usage.applicationBytes}],bytes)}<div>${row('Bài làm',tables.attempts)}${row('Câu hỏi',tables.questions)}${row('Nhật ký',tables.audit_log)}</div></div>
      <p class="dashboard-caption">${gc.error?`Lỗi dọn tệp: ${esc(gc.error)}`:gc.lastSuccessAt&&Number.isFinite(stamp.getTime())?`Quét gần nhất: ${esc(stamp.toLocaleString('vi-VN'))} · Đã dọn ${Number(gc.deleted)||0} tệp (${bytes(gc.deletedBytes??0)})`:'Đang chờ lượt quét đầu tiên.'}</p>
    </section>
    <section class="dashboard-details"><h3>Dung lượng đề thi <span>${storage.length} đề · lớn nhất trước</span></h3>
      <div class="dashboard-exam-storage"><div class="table-wrap"><table class="bang"><thead><tr><th scope="col">Đề thi</th><th scope="col">Câu</th><th scope="col">Media</th><th scope="col">Dữ liệu</th><th scope="col">Tổng</th></tr></thead><tbody>${storage.map(item=>`<tr><td><b>${esc(item.title)}</b><span class="phu">${esc([item.provider,item.level].filter(Boolean).join(' '))}</span></td><td>${Number(item.questions)||0}</td><td>${Number(item.mediaFiles)||0} tệp · ${bytes(item.mediaBytes)}</td><td>${bytes(item.dataBytes)}</td><td><b>${bytes(item.totalBytes)}</b></td></tr>`).join('')||'<tr><td colspan="5" class="rong">Chưa có đề thi.</td></tr>'}</tbody></table></div>
      </div>
    </section>
  </section>`;
}
