import {esc,fmtDate} from '../ui/format.js';
import {AI_PROVIDERS,normalizeAiProvider} from '../domain/ai-providers.js';
import {iconHtml} from '../ui/icons.js';
import {connectionStatusHtml} from './connection-status.js';
import {monitorChart,monitorRangePicker} from './monitor-chart.js';
import {resourceRing,resourceGauge} from './resource-charts.js';

const valid=value=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0;
const bytes=value=>{if(!valid(value))return '—';const units=['B','KB','MB','GB','TB'];let index=0,current=Number(value);while(current>=1024&&index<units.length-1){current/=1024;index++;}return `${current>=10||index===0?Math.round(current):current.toFixed(1)} ${units[index]}`;};
const percent=(used,total)=>valid(used)&&valid(total)&&Number(total)>0?Math.min(100,Number(used)/Number(total)*100):null;
const row=(label,value)=>`<div class="dashboard-row"><span>${label}</span><b>${bytes(value)}</b></div>`;
const date=value=>value&&Number.isFinite(new Date(value).getTime())?esc(new Date(value).toLocaleString('vi-VN')):'Chưa có';
const status=(text,tone='neutral')=>`<span class="dashboard-state dashboard-state--${tone}">${esc(text)}</span>`;
const count=value=>Number(value||0).toLocaleString('vi-VN');

function dashboardAiQueueHtml(ai,overview={}){
  const jobs=ai?.jobs||{},failed=Number(jobs.failed?.count||0);
  const preferred=normalizeAiProvider(ai?.providerPreference);
  const providerPills=AI_PROVIDERS.map(({id,label})=>`<i class="dashboard-ai-provider ${(jobs.processing?.models?.length?jobs.processing.models.includes(id):preferred===id)?'is-active':''}" data-provider="${id}" title="Số bài chấm thành công">${label} <b>${ai?.successfulByProvider?.[id]==null?'—':count(ai.successfulByProvider[id])}</b></i>`).join('');
  const failures=[...(ai?.failures||[]),...(ai?.providerStates||[]).filter(item=>item.error).map(item=>({error:item.error,at:item.retryAt}))];
  const accuracy=overview.aiAccuracy||[];
  const accuracyHtml=accuracy.length?`<div class="dashboard-ai-accuracy"><strong>Độ chính xác AI</strong><ul>${accuracy.map(item=>`<li>${item.examId?`<button type="button" class="dashboard-ai-exam" data-action="edit-exam" data-id="${esc(item.examId)}" title="Mở đề thi: ${esc(item.examName)}">${esc(item.examName)}</button>`:`<span class="dashboard-ai-exam">${esc(item.examName)}</span>`}<span class="dashboard-ai-accuracy-meta"><i class="dashboard-ai-part">${esc(item.part)}</i><b>${count(item.correct)}/${count(item.total)}</b></span></li>`).join('')}</ul></div>`:'';
  return `<section class="the dashboard-ai-queue"><header class="dashboard-section-heading"><h2>Chấm bài AI</h2><span class="dashboard-ai-providers" aria-label="Số bài chấm thành công theo AI">${providerPills}</span></header>${accuracyHtml}${failed||failures.length?`<div class="dashboard-ai-errors" role="alert"><div class="dashboard-ai-error-head"><strong>${failed?count(failed)+' bài lỗi AI':'Thông báo chấm AI'}</strong>${failed?`<button type="button" class="nut nho" data-action="retry-ai-grading">Chạy lại ${count(failed)} bài lỗi</button>`:''}</div>${failures.map(item=>`<p>${esc(item.error)}<small>${date(item.at)}</small></p>`).join('')}</div>`:''}</section>`;
}

export function dashboardR2Html(r2){
  const known=r2&&['totalFiles','syncedFiles','pendingFiles','skippedFiles'].every(key=>valid(r2[key])),count=value=>valid(value)?Number(value):'—';
  const state=!r2?'Chưa có dữ liệu':r2.error?'Cần kiểm tra':!r2.enabled?'Đang tắt':r2.syncing?'Đang đồng bộ':!known?'Chờ quét':r2.pendingFiles||r2.skippedFiles?'Chưa đồng bộ hết':'Đã đồng bộ';
  const tone=r2?.error?'error':state==='Đã đồng bộ'?'success':'neutral';
  return `<section class="the dashboard-r2-card"><header class="dashboard-section-heading"><h3>Ảnh &amp; audio <span>R2</span></h3><a class="icon-btn" href="/adm?tab=settings&amp;settings=general" aria-label="Cấu hình R2" title="Cấu hình R2">${iconHtml('settings')}</a></header>
    <div class="dashboard-r2-body">${resourceRing('Tệp đã đồng bộ',`${count(r2?.syncedFiles)} / ${count(r2?.totalFiles)}`,percent(r2?.syncedFiles,r2?.totalFiles),{warning:Boolean(r2?.error)})}<div class="dashboard-r2-size"><b>${bytes(r2?.syncedBytes)}</b>${status(state,tone)}</div></div>
    ${r2?.pendingFiles||r2?.skippedFiles?`<p class="dashboard-warning" role="status">${count(r2.pendingFiles)} chờ · ${count(r2.skippedFiles)} vượt 25 MB</p>`:''}
    <details class="dashboard-disclosure"><summary>Chi tiết đồng bộ</summary><div class="dashboard-detail-content">${r2?.error?`<p class="dashboard-warning">${esc(r2.error)}</p>`:''}${row('Bản đồng bộ',r2?.syncedBytes)}<div class="dashboard-row"><span>Chờ đồng bộ</span><b>${count(r2?.pendingFiles)}</b></div><div class="dashboard-row"><span>Vượt 25 MB</span><b>${count(r2?.skippedFiles)}</b></div><p>Quét: ${date(r2?.lastScanAt)}</p><p>Hoàn tất: ${date(r2?.lastSuccessAt)}</p><p>Mỗi 5 phút · VPS dự phòng</p></div></details>
  </section>`;
}

export function dashboardInfrastructureHtml(infrastructure,error='',overview={}){
  if(!infrastructure)return `${dashboardAiQueueHtml(null,overview)}<section class="the dashboard-infrastructure dashboard-infrastructure--empty"><div class="dashboard-section-heading"><h2>Hệ thống</h2><span role="status">${error?'Không tải được dữ liệu':'Đang tải…'}</span></div>${error?'<p class="dashboard-caption">Tải lại trang để thử lại.</p>':''}</section>`;
  const resources=infrastructure.resources||{},memory=resources.memory||{},disk=resources.disk,usage=resources.usage||{},tables=resources.databaseTables||{};
  const gc=resources.mediaGarbageCollection||{};
  const memoryPercent=percent(memory.usedBytes,memory.totalBytes),diskPercent=percent(disk?.usedBytes,disk?.totalBytes);
  const cpu=valid(resources.cpu?.usagePercent)?Math.min(100,Number(resources.cpu.usagePercent)):null;
  const totalBytes=['databaseBytes','uploadsBytes','applicationBytes'].every(key=>valid(usage[key]))?Number(usage.databaseBytes)+Number(usage.uploadsBytes)+Number(usage.applicationBytes):null;
  const gcKnown=gc.lastSuccessAt&&Number.isFinite(new Date(gc.lastSuccessAt).getTime());
  const gcText=gc.error?'Quét lỗi':gcKnown?'Đã quét':'Chưa có lần quét';
  const warnings=[memoryPercent>=85?'RAM cao':null,diskPercent>=85?'Ổ đĩa gần đầy':null,gc.error?'Dọn tệp gặp lỗi':null].filter(Boolean);
  const storage=[...(infrastructure.examStorage||[])].sort((a,b)=>Number(b.totalBytes||0)-Number(a.totalBytes||0));
  const parts=[['PostgreSQL',usage.databaseBytes],['Ảnh & audio',usage.uploadsBytes],['Mã nguồn',usage.applicationBytes]];
  return `${dashboardAiQueueHtml(infrastructure.writingAi,overview)}<section class="dashboard-infrastructure"><div class="dashboard-section-heading dashboard-system-heading"><h2>Hệ thống</h2><div class="dashboard-services" aria-label="Trạng thái kết nối">${connectionStatusHtml(infrastructure,{compact:true})}</div></div>
    ${warnings.length?`<div class="dashboard-alerts" role="status">${warnings.map(text=>status(text,'error')).join('')}</div>`:''}
    <div class="dashboard-system-grid">
      <section class="the dashboard-cpu-card"><header class="dashboard-section-heading"><h3>CPU</h3>${monitorRangePicker()}</header><div class="dashboard-cpu-history">
        ${monitorChart('CPU','cpu',resources.history,cpu==null?'—':cpu+'%',value=>value+'%',{hideLabel:true,detailsLabel:null})}
      </div></section>
      <section class="the dashboard-capacity-card"><header class="dashboard-section-heading"><h3>Tài nguyên</h3></header><div class="dashboard-capacity-rings">
        ${resourceGauge('RAM',`${bytes(memory.usedBytes)} / ${bytes(memory.totalBytes)}`,memoryPercent,{warning:memoryPercent>=85})}
        ${resourceGauge('Ổ đĩa',`${bytes(disk?.usedBytes)} / ${bytes(disk?.totalBytes)}`,diskPercent,{warning:diskPercent>=85})}
      </div><div class="dashboard-data-total"><span>Dữ liệu hệ thống</span><strong>${bytes(totalBytes)}</strong></div>
      <div class="dashboard-storage-strip" role="img" aria-label="${esc(parts.map(([label,value])=>label+': '+bytes(value)).join(', '))}">${parts.map(([label,value],index)=>`<i class="dashboard-storage-segment dashboard-storage-segment--${index}" style="width:${totalBytes>0&&valid(value)?Number(value)/totalBytes*100:0}%" title="${label}: ${bytes(value)}"></i>`).join('')}</div>
      <details class="dashboard-disclosure"><summary>Chi tiết dung lượng</summary><div class="dashboard-detail-content">${parts.map(([label,value])=>row(label,value)).join('')}${row('Bài làm',tables.attempts)}${row('Câu hỏi',tables.questions)}${row('Nhật ký',tables.audit_log)}<p>Dọn tệp: ${gcText}</p>${gcKnown?`<p>Quét: ${date(gc.lastSuccessAt)} · Đã dọn ${Number(gc.deleted)||0} tệp (${bytes(gc.deletedBytes??0)})</p>`:''}${gc.error?`<p class="dashboard-warning">${esc(gc.error)}</p>`:''}</div></details>
      </section>
      ${dashboardR2Html(infrastructure.r2)}
    </div>
  </section>
  <section class="dashboard-storage-card"><div class="dashboard-section-heading"><h2>Dung lượng đề thi</h2>${status(storage.length+' đề')}</div>
    <div class="dashboard-exam-storage"><div class="table-wrap"><table class="bang"><thead><tr><th scope="col">Đề thi</th><th scope="col">Last edit</th><th scope="col">Câu</th><th scope="col">Media</th><th scope="col">Dữ liệu</th><th scope="col">Tổng</th></tr></thead><tbody>${storage.map(item=>`<tr><td><button type="button" class="table-link" data-action="edit-exam" data-id="${esc(item.id)}" title="Mở đề thi">${esc(item.title)}</button><span class="phu">${esc([item.provider,item.level].filter(Boolean).join(' '))}</span></td><td>${fmtDate(item.updatedAt)}</td><td>${Number(item.questions)||0}</td><td>${Number(item.mediaFiles)||0} tệp · ${bytes(item.mediaBytes)}</td><td>${bytes(item.dataBytes)}</td><td><b>${bytes(item.totalBytes)}</b></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có đề thi.</td></tr>'}</tbody></table></div></div>
  </section>`;
}
