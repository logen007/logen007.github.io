import {r2SettingsAction as action} from '../settings/api.js';
import {confirmAction} from '../ui/confirm.js';
import {iconHtml} from '../ui/icons.js';
import {esc} from '../ui/format.js';
import {readBackupData,loadBackupData,invalidateBackupData} from '../settings/backup-data.js';
const dateText=(value,part)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',...(part==='date'?{dateStyle:'short'}:{timeStyle:'short'})}):'—';
export function backupPageHtml(){return `<section class="backup-page">
 <header class="tieu-de-trang backup-heading"><div class="backup-title"><h1>Backup</h1><span data-count></span></div><div class="backup-actions">
 <button class="icon-btn" data-settings title="Cài đặt Backup" aria-label="Cài đặt Backup">${iconHtml('settings')}</button>
 <button class="nut chinh" data-now title="Tạo bản sao lưu" disabled>Sao lưu</button></div></header>
 <div class="table-wrap backup-table-wrap" role="region" aria-label="Danh sách bản backup" tabindex="0"><table class="bang backup-table" aria-label="Các bản backup trên Google Drive"><thead><tr><th scope="col">Ngày tạo</th><th scope="col">Dung lượng</th><th scope="col">Thao tác</th></tr></thead><tbody data-job hidden><tr class="backup-job-row"><td colspan="3"><div class="backup-job"><div class="backup-job-heading"><span data-status role="status" aria-live="polite"></span><time data-elapsed aria-label="Tổng thời gian" hidden></time></div><progress data-progress aria-label="Tiến trình sao lưu" hidden></progress></div></td></tr></tbody><tbody data-files></tbody></table></div></section>`;}
export function backupProgressText(status,now=Date.now()){
 const seconds=Math.max(0,Math.floor(((status.finishedAt?Date.parse(status.finishedAt):now)-Date.parse(status.startedAt))/1000));
 return Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'0:00';
}
export function backupItemHtml(file){return `<td class="backup-created"><a class="backup-download" aria-label="Tải xuống ${esc(file.name)}" title="${esc(file.name)}" href="/api/backup/files/${encodeURIComponent(file.id)}/download"><time datetime="${esc(file.createdTime||'')}"><span>${esc(dateText(file.createdTime,'date'))}</span><span class="backup-time">${esc(dateText(file.createdTime,'time'))}</span></time>${file.appProperties?.appVersion?`<small class="backup-version">v${esc(file.appProperties.appVersion)}</small>`:''}</a></td><td>${Number.isFinite(Number(file.size))?(Number(file.size)/1048576).toFixed(1)+' MB':'—'}</td><td><div class="hanh-dong-bang backup-actions"><button class="icon-btn" data-restore title="Phục hồi thử" aria-label="Phục hồi thử ${esc(file.name)}">${iconHtml('repeat')}</button><button class="icon-btn" data-delete title="Xoá bản backup" aria-label="Xoá bản backup ${esc(file.name)}">${iconHtml('trash')}</button></div></td>`;}
export function backupSettingsHtml(){return `<form class="backup-form"><header class="dau-hop"><h2 id="backup-dialog-title">Cài đặt Backup</h2><button type="button" class="icon-btn" data-close title="Đóng" aria-label="Đóng">${iconHtml('close')}</button></header>
 <section class="backup-google"><div><strong>Google Drive</strong><small data-google>Đang kiểm tra…</small></div><button type="button" class="nut" data-connect disabled>Kết nối</button><button type="button" class="icon-btn" data-disconnect title="Ngắt kết nối Google Drive" aria-label="Ngắt kết nối Google Drive" hidden>${iconHtml('logout')}</button></section>
 <fieldset disabled><label class="backup-toggle"><span>Backup tự động</span><input type="checkbox" name="enabled" role="switch"></label>
 <div class="backup-form-grid"><label class="backup-setting-row"><span>Giờ chạy<small>Giờ Việt Nam</small></span><input class="truong" type="time" name="time" required></label><label class="backup-setting-row"><span>Chu kỳ<small>Số ngày giữa mỗi lần</small></span><input class="truong" type="number" min="1" max="30" name="intervalDays" required></label></div>
 <section class="backup-retention"><h3>Số bản giữ lại</h3><div class="backup-form-grid"><label class="backup-setting-row"><span>Gần nhất</span><input class="truong" type="number" min="1" max="90" name="dailyCopies" required></label><label class="backup-setting-row"><span>Theo tháng<small>Giữ thêm 1 bản mỗi tháng</small></span><input class="truong" type="number" min="0" max="24" name="monthlyCopies" required></label></div></section>
 <footer class="backup-footer"><button type="button" class="nut" data-cancel>Huỷ</button><button class="nut chinh" type="submit">Lưu</button></footer></fieldset><p data-error role="alert"></p></form>`;}
export function mountBackupPage(root,{owner=null}={}){
 if(!root?.isConnected)return;root.innerHTML=backupPageHtml();
 const el=s=>root.querySelector(s);let busy=false,reload=false,jobBusy=false,listSignature,currentStatus={},pendingCompletion,pollTimer;
 const rows=new Map();
 const updateProgress=()=>{const bar=el('[data-progress]');bar.hidden=!jobBusy;if(Number.isInteger(currentStatus.stepCount)&&currentStatus.stepCount>0){bar.max=currentStatus.stepCount;bar.value=Math.max(0,Math.min(currentStatus.stepCount,currentStatus.completedSteps||0));bar.setAttribute('aria-valuetext',bar.value+'/'+bar.max+' bước hoàn tất');}else{bar.removeAttribute('value');bar.removeAttribute('aria-valuetext');}};
 const updateClock=()=>{if(root.isConnected&&!document.hidden){el('[data-elapsed]').hidden=!currentStatus.startedAt;el('[data-elapsed]').textContent=backupProgressText(currentStatus);}};
 const report=e=>{if(!root.isConnected)return;el('[data-job]').hidden=false;el('[data-status]').textContent=e.message||String(e);el('[data-job]').dataset.state=e instanceof Error?'failed':'notice';updateClock();updateProgress();};
 const beginJob=async(name,data,message)=>{
  jobBusy=true;currentStatus={state:'queued',startedAt:new Date().toISOString()};el('[data-now]').disabled=true;report(message);el('[data-job]').dataset.state='running';
  invalidateBackupData(owner,['status']);paintFiles(readBackupData(owner).files?.files||[]);
  try{await action(name,data);invalidateBackupData(owner,['status']);await load({force:true});}catch(e){jobBusy=false;currentStatus={...currentStatus,finishedAt:new Date().toISOString()};report(e);el('[data-now]').disabled=false;}finally{poll();}
 };
 function paintStatus({drive,status,enabled}){
   const wasRunning=jobBusy;
   jobBusy=['queued','running'].includes(status?.state);
   if(wasRunning&&status?.state==='success'&&status.kind==='backup')pendingCompletion=status.fileId;
   currentStatus=status||{};
   el('[data-now]').disabled=!enabled||!drive.connected||jobBusy;
   const message=(status?.state==='success'?'':status?.message)||(!enabled?'Backup chưa sẵn sàng.':!drive.connected?'Mở cài đặt để kết nối Google Drive.':'');
   el('[data-job]').hidden=!message;el('[data-job]').dataset.state=status?.state||'idle';
   if(el('[data-status]').textContent!==message){el('[data-status]').textContent=message;el('[data-status]').title=message;}
   updateClock();
   updateProgress();
   if(wasRunning!==jobBusy)poll();
   return wasRunning&&!jobBusy;
 }
 function paintFiles(source){
   // The uploading archive becomes visible on Drive before verification finishes.
   // Keep that candidate in the status row until the complete job succeeds.
   const files=source.filter(file=>!(jobBusy&&currentStatus.kind==='backup'&&file.name?.startsWith('g2g-')&&Date.parse(file.createdTime)>=Date.parse(currentStatus.startedAt))).sort((a,b)=>Date.parse(b.createdTime)-Date.parse(a.createdTime));
   if(pendingCompletion&&!files.some(file=>file.id===pendingCompletion)){report('Đang cập nhật bản backup mới…');}
   el('[data-count]').textContent=files.length+' bản lưu';
   const enabled=readBackupData(owner).status?.enabled;
   for(const row of rows.values()){row.querySelector('[data-restore]').disabled=jobBusy||!enabled;row.querySelector('[data-delete]').disabled=jobBusy;}
   const signature=JSON.stringify([files,files.length?null:jobBusy]);
   if(signature===listSignature)return;
   listSignature=signature;
   const body=el('[data-files]'),ids=new Set(files.map(file=>file.id));
   for(const [id,row] of rows)if(!ids.has(id)){row.remove();rows.delete(id);}
   if(!files.length){body.innerHTML=jobBusy?'':'<tr><td colspan="3"><div class="rong">Chưa có bản backup.</div></td></tr>';return;}
   if(!rows.size)body.replaceChildren();
   for(const [index,file] of files.entries()){
    const row=rows.get(file.id)||document.createElement('tr');rows.set(file.id,row);
    if(file.id===pendingCompletion){row.className='backup-row-enter';pendingCompletion=null;el('[data-job]').hidden=true;}
    const html=backupItemHtml(file);if(row.backupHtml!==html){row.innerHTML=html;row.backupHtml=html;}
    row.querySelector('[data-restore]').disabled=jobBusy||!enabled;
    row.querySelector('[data-delete]').disabled=jobBusy;
    row.querySelector('[data-delete]').onclick=()=>confirmAction('Xoá bản backup '+file.name+' khỏi Drive?',async()=>{try{await action('deleteBackupFile',{id:file.id});invalidateBackupData(owner);await load({force:true});}catch(e){report(e);}},{confirmLabel:'Xoá',danger:true});
    row.querySelector('[data-restore]').onclick=()=>confirmAction('Tải bản này và phục hồi thử vào database kiểm tra? Dữ liệu đang chạy được giữ nguyên; database kiểm tra sẽ được dọn sau khi xác minh.',()=>beginJob('requestBackupRestore',{id:file.id},'Đang chuẩn bị phục hồi thử…'),{confirmLabel:'Phục hồi thử'});
    if(body.children[index]!==row)body.insertBefore(row,body.children[index]||null);
   }
 }
 async function load({force=false}={}){
  if(!root.isConnected||document.hidden)return;
  if(busy){reload=reload||force;return;}busy=true;
  try{
   const snapshot=await loadBackupData(owner,'status',{force:force||jobBusy});
   if(!root.isConnected)return;
   const completed=paintStatus(snapshot);
   const result=snapshot.drive.connected?await loadBackupData(owner,'files',{force:force||completed}):{files:[]};
   if(root.isConnected)paintFiles(result.files);
  }catch(e){if(e.name!=='AbortError')report(e);}finally{busy=false;if(reload){reload=false;void load({force:true});}}
 }
 el('[data-now]').onclick=()=>beginJob('runBackupNow',{},'Đang chuẩn bị backup…');
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
  dialog.querySelector('[data-disconnect]').onclick=async()=>{try{const r=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});if(!r.ok)throw Error('Không thể ngắt kết nối.');invalidateBackupData(owner);close();await load({force:true});}catch(e){err(e);}};
  try{
   const [{preferences:p},{drive}]=await Promise.all([action('getBackupPreferences'),loadBackupData(owner,'status')]);
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
 const stop=()=>{clearInterval(clock);clearTimeout(pollTimer);document.removeEventListener('visibilitychange',onVisibility);};
 const clock=setInterval(()=>{if(!root.isConnected){stop();return;}updateClock();},1000);
 const poll=()=>{clearTimeout(pollTimer);if(!root.isConnected)return;pollTimer=setTimeout(async()=>{if(!root.isConnected){stop();return;}await load();poll();},jobBusy?3000:60000);};
 const onVisibility=()=>{if(!root.isConnected){stop();return;}if(!document.hidden)void load().finally(poll);};
 document.addEventListener('visibilitychange',onVisibility);
 const cached=readBackupData(owner);
 if(cached.status){paintStatus(cached.status);if(cached.files)paintFiles(cached.status.drive.connected?cached.files.files:[]);}
 void load();
 poll();
}
