import {r2SettingsAction as action} from '../settings/api.js';
import {confirmAction} from '../ui/confirm.js';
import {iconHtml} from '../ui/icons.js';
import {esc} from '../ui/format.js';
const dateText=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}):'—';
export function backupPageHtml(){return `<section class="backup-page">
 <header class="tieu-de-trang backup-heading"><div class="backup-title"><h1>Backup</h1><span data-count></span></div><div class="backup-actions">
 <button class="icon-btn" data-settings title="Cài đặt Backup" aria-label="Cài đặt Backup">${iconHtml('settings')}</button>
 <button class="nut chinh icon-btn" data-now title="Backup ngay" aria-label="Backup ngay" disabled>${iconHtml('backup')}</button></div></header>
 <div class="backup-job" data-job hidden><p data-status role="status" aria-live="polite"></p><progress data-progress aria-label="Backup đang xử lý" hidden></progress>
 <p class="backup-progress-meta" data-progress-meta hidden></p>
 <details data-details hidden><summary>Chi tiết</summary><ol class="backup-steps" data-steps></ol><dl data-job-details></dl></details></div>
 <div class="table-wrap backup-table-wrap" role="region" aria-label="Danh sách bản backup" tabindex="0"><table class="bang backup-table" aria-label="Các bản backup trên Google Drive"><thead><tr><th scope="col">Ngày tạo</th><th scope="col">Dung lượng</th><th scope="col">Thao tác</th></tr></thead><tbody data-files></tbody></table></div></section>`;}
export function backupStatusDetailsHtml(status={}){
 const rows=[['Tác vụ',status.kind==='restore'?'Phục hồi thử':'Backup'],['Trạng thái',status.state==='success'?null:status.message],['Bắt đầu',dateText(status.startedAt)],['Kết thúc',status.finishedAt?dateText(status.finishedAt):null],['Backup thành công gần nhất',status.lastBackupAt?dateText(status.lastBackupAt):null],['Bản lưu',status.name],['Bảng đã phục hồi',status.tables],['SHA-256',status.sha256]];
 return rows.filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(String(value))}</dd></div>`).join('');
}
export function backupProgressText(status,now=Date.now()){
 const duration=value=>{const seconds=Math.max(0,Math.floor((now-Date.parse(value))/1000));return Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'—';};
 const steps=Number.isInteger(status.stepCount)&&status.stepCount>0?`${status.completedSteps||0}/${status.stepCount} bước hoàn tất · `:'';
 return steps+'Tổng '+duration(status.startedAt)+(status.phaseStartedAt?' · Bước này '+duration(status.phaseStartedAt):'');
}
export function backupStepsHtml(status={}){
 return (status.steps||[]).map((step,index)=>{const done=index<(status.completedSteps||0),current=step.id===status.phase&&!done,label=done?'Xong':current?status.state==='failed'?'Lỗi':status.state==='interrupted'?'Gián đoạn':'Đang chạy':'Chờ';return `<li data-state="${done?'done':current?'current':'pending'}"><span>${esc(step.label)}</span><small>${label}</small></li>`;}).join('');
}
export function backupItemHtml(file){return `<td title="${esc(file.name)}">${esc(dateText(file.createdTime))}</td><td>${Number.isFinite(Number(file.size))?(Number(file.size)/1048576).toFixed(1)+' MB':'—'}</td><td><div class="hanh-dong-bang backup-actions"><a class="icon-btn" aria-label="Tải xuống ${esc(file.name)}" title="Tải xuống" href="/api/backup/files/${encodeURIComponent(file.id)}/download">${iconHtml('arrowDown')}</a><button class="icon-btn" data-restore title="Phục hồi thử" aria-label="Phục hồi thử ${esc(file.name)}">${iconHtml('repeat')}</button><button class="icon-btn" data-delete title="Xoá bản backup" aria-label="Xoá bản backup ${esc(file.name)}">${iconHtml('trash')}</button></div></td>`;}
export function backupSettingsHtml(){return `<form class="backup-form"><header class="dau-hop"><h2 id="backup-dialog-title">Cài đặt Backup</h2><button type="button" class="icon-btn" data-close title="Đóng" aria-label="Đóng">${iconHtml('close')}</button></header>
 <section class="backup-google"><div><strong>Google Drive</strong><small data-google>Đang kiểm tra…</small></div><button type="button" class="nut" data-connect disabled>Kết nối</button><button type="button" class="icon-btn" data-disconnect title="Ngắt kết nối Google Drive" aria-label="Ngắt kết nối Google Drive" hidden>${iconHtml('logout')}</button></section>
 <fieldset disabled><label class="backup-toggle"><span>Backup tự động</span><input type="checkbox" name="enabled" role="switch"></label>
 <div class="backup-form-grid"><label class="backup-setting-row"><span>Giờ chạy<small>Giờ Việt Nam</small></span><input class="truong" type="time" name="time" required></label><label class="backup-setting-row"><span>Chu kỳ<small>Số ngày giữa mỗi lần</small></span><input class="truong" type="number" min="1" max="30" name="intervalDays" required></label></div>
 <section class="backup-retention"><h3>Số bản giữ lại</h3><div class="backup-form-grid"><label class="backup-setting-row"><span>Gần nhất</span><input class="truong" type="number" min="1" max="90" name="dailyCopies" required></label><label class="backup-setting-row"><span>Theo tháng<small>Giữ thêm 1 bản mỗi tháng</small></span><input class="truong" type="number" min="0" max="24" name="monthlyCopies" required></label></div></section>
 <footer class="backup-footer"><button type="button" class="nut" data-cancel>Huỷ</button><button class="nut chinh" type="submit">Lưu</button></footer></fieldset><p data-error role="alert"></p></form>`;}
export function mountBackupPage(root){
 if(!root?.isConnected)return;root.innerHTML=backupPageHtml();
 const el=s=>root.querySelector(s);let busy=false,jobBusy=false,listSignature,currentStatus={};
 const updateClock=()=>{if(root.isConnected&&!document.hidden&&jobBusy)el('[data-progress-meta]').textContent=backupProgressText(currentStatus);};
 const report=e=>{el('[data-job]').hidden=false;el('[data-status]').hidden=false;el('[data-status]').textContent=e.message||String(e);el('[data-job]').dataset.state=e instanceof Error?'failed':'notice';};
 async function load(){
  if(busy||!root.isConnected||document.hidden)return;busy=true;
  try{
   const {drive,status,enabled}=await action('getBackupStatus');
   if(!root.isConnected)return;
   jobBusy=['queued','running'].includes(status?.state);
   currentStatus=status||{};
   el('[data-now]').disabled=!enabled||!drive.connected||jobBusy;
   const message=(status?.state==='success'?'':status?.message)||(!enabled?'Backup chưa sẵn sàng.':!drive.connected?'Mở cài đặt để kết nối Google Drive.':'');
   el('[data-job]').hidden=!message&&!status?.startedAt;el('[data-job]').dataset.state=status?.state||'idle';
   el('[data-status]').hidden=!message;
   el('[data-status]').textContent=message;
   el('[data-progress]').hidden=!jobBusy;
   if(Number.isInteger(status?.stepCount)&&status.stepCount>0){el('[data-progress]').max=status.stepCount;el('[data-progress]').value=Math.max(0,Math.min(status.stepCount,status.completedSteps||0));el('[data-progress]').setAttribute('aria-label','Các bước backup đã hoàn tất');}
   else el('[data-progress]').removeAttribute('value');
   el('[data-progress-meta]').hidden=!jobBusy;updateClock();
   el('[data-details]').hidden=!status?.startedAt;
   const stepsHtml=backupStepsHtml(status);
   if(el('[data-steps]').innerHTML!==stepsHtml)el('[data-steps]').innerHTML=stepsHtml;
   const detailHtml=backupStatusDetailsHtml(status);
   if(el('[data-job-details]').innerHTML!==detailHtml)el('[data-job-details]').innerHTML=detailHtml;
   const {files}=drive.connected?await action('listBackupFiles'):{files:[]};
   if(!root.isConnected)return;
   el('[data-count]').textContent=files.length+' bản lưu';
   const signature=JSON.stringify([files,jobBusy,enabled]);
   if(signature===listSignature)return;
   listSignature=signature;
   const body=el('[data-files]');body.replaceChildren();
   if(!files.length){body.innerHTML='<tr><td colspan="3"><div class="rong">Chưa có bản backup.</div></td></tr>';return;}
   for(const file of files){
    const row=document.createElement('tr');
    row.innerHTML=backupItemHtml(file);
    row.querySelector('[data-restore]').disabled=jobBusy||!enabled;
    row.querySelector('[data-delete]').disabled=jobBusy;
    row.querySelector('[data-delete]').onclick=()=>confirmAction('Xoá bản backup '+file.name+' khỏi Drive?',async()=>{try{await action('deleteBackupFile',{id:file.id});await load();}catch(e){report(e);}},{confirmLabel:'Xoá',danger:true});
    row.querySelector('[data-restore]').onclick=()=>confirmAction('Tải bản này và phục hồi thử vào database kiểm tra? Dữ liệu đang chạy được giữ nguyên; database kiểm tra sẽ được dọn sau khi xác minh.',async()=>{try{await action('requestBackupRestore',{id:file.id});report('Đang phục hồi thử…');await load();}catch(e){report(e);}},{confirmLabel:'Phục hồi thử'});
    body.append(row);
   }
  }catch(e){report(e);}finally{busy=false;}
 }
 el('[data-now]').onclick=async()=>{el('[data-now]').disabled=true;report('Đang gửi yêu cầu backup…');el('[data-progress]').removeAttribute('value');el('[data-progress]').hidden=false;try{await action('runBackupNow');await load();}catch(e){report(e);el('[data-progress]').hidden=true;el('[data-now]').disabled=false;}};
 el('[data-settings]').onclick=async()=>{
  if(document.querySelector('[data-backup-modal]'))return;
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='backup-dialog';dialog.dataset.backupModal='';dialog.setAttribute('aria-labelledby','backup-dialog-title');
  dialog.innerHTML=backupSettingsHtml();
  document.body.append(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),err=e=>{dialog.querySelector('[data-error]').textContent=e.message;};
  const close=()=>{dialog.close();dialog.remove();previous?.focus();};
  dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
  dialog.querySelector('[data-close]').focus();
  dialog.querySelector('[data-connect]').onclick=()=>location.assign('/api/backup/google/connect');
  dialog.querySelector('[data-disconnect]').onclick=async()=>{try{const r=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});if(!r.ok)throw Error('Không thể ngắt kết nối.');close();await load();}catch(e){err(e);}};
  try{
   const [{preferences:p},{drive}]=await Promise.all([action('getBackupPreferences'),action('getBackupStatus')]);
   if(!dialog.isConnected)return;
   for(const key of ['time','intervalDays','dailyCopies','monthlyCopies'])form.elements[key].value=p[key];
   form.elements.enabled.checked=p.enabled===true;
   dialog.querySelector('[data-google]').textContent=drive.connected?drive.email:drive.oauthConfigured?'Chưa kết nối':'Google chưa được cấu hình.';
   dialog.querySelector('[data-connect]').hidden=drive.connected;dialog.querySelector('[data-connect]').disabled=!drive.oauthConfigured;
   dialog.querySelector('[data-disconnect]').hidden=!drive.connected;
   dialog.querySelector('fieldset').disabled=false;
  }catch(e){err(e);}
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await action('saveBackupPreferences',{enabled:form.elements.enabled.checked,time:form.elements.time.value,...Object.fromEntries(['intervalDays','dailyCopies','monthlyCopies'].map(k=>[k,Number(form.elements[k].value)]))});close();report('Đã lưu cài đặt Backup.');}catch(e){err(e);}finally{button.disabled=false;}};
 };
 void load();
 const clock=setInterval(()=>{if(!root.isConnected){clearInterval(clock);return;}updateClock();},1000);
 const poll=()=>{setTimeout(async()=>{if(!root.isConnected)return;await load();poll();},5000);};
 poll();
}
