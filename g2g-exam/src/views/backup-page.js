import {r2SettingsAction as action} from '../settings/api.js';
import {confirmAction} from '../ui/confirm.js';
import {iconHtml} from '../ui/icons.js';
import {esc} from '../ui/format.js';
export function backupPageHtml(){return '<section class="the backup-page"><header class="backup-heading"><h1>Backup</h1><div class="backup-actions"><button class="icon-btn" data-settings title="Cài đặt Backup" aria-label="Cài đặt Backup">'+iconHtml('settings')+'</button><button class="nut chinh" data-now disabled>Backup ngay</button></div></header><p class="phu" data-connection>Đang kiểm tra Google Drive…</p><p data-status role="status"></p><div data-files></div></section>';}
export function mountBackupPage(root){
 if(!root?.isConnected)return;root.innerHTML=backupPageHtml();
 const el=s=>root.querySelector(s);let busy=false,jobBusy=false,timer;
 const report=e=>{el('[data-status]').textContent=e.message||String(e);};
 async function load(){
  if(busy||!root.isConnected||document.hidden)return;busy=true;
  try{
   const {drive,status,enabled}=await action('getBackupStatus');
   if(!root.isConnected)return;
   jobBusy=['queued','running'].includes(status?.state);
   el('[data-now]').disabled=!enabled||!drive.connected||jobBusy;
   el('[data-connection]').textContent=drive.connected?'Google Drive · '+drive.email:'Chưa kết nối Google Drive · mở Cài đặt để kết nối.';
   el('[data-status]').textContent=status?.message||(!enabled?'Backup chưa sẵn sàng.':'');
   const {files}=drive.connected?await action('listBackupFiles'):{files:[]};
   const body=el('[data-files]');body.replaceChildren();
   if(!files.length){body.innerHTML='<div class="rong">Chưa có bản backup.<br>Bấm “Backup ngay” để tạo bản đầu tiên.</div>';return;}
   for(const file of files){
    const card=document.createElement('article');card.className='backup-item';
    card.innerHTML='<div><strong>'+esc(new Date(file.createdTime).toLocaleString('vi-VN'))+'</strong><p class="phu">'+(file.size/1048576).toFixed(1)+' MB · '+esc(file.name)+'</p></div><div class="backup-actions"><a class="icon-btn" aria-label="Tải xuống" title="Tải xuống" href="/api/backup/files/'+encodeURIComponent(file.id)+'/download">'+iconHtml('arrowDown')+'</a><button class="icon-btn" data-restore title="Phục hồi thử" aria-label="Phục hồi thử">'+iconHtml('repeat')+'</button><button class="icon-btn" data-delete title="Xoá bản backup" aria-label="Xoá bản backup">'+iconHtml('trash')+'</button></div>';
    card.querySelector('[data-restore]').disabled=jobBusy||!enabled;
    card.querySelector('[data-delete]').disabled=jobBusy;
    card.querySelector('[data-delete]').onclick=()=>confirmAction('Xoá bản backup '+file.name+' khỏi Drive?',async()=>{try{await action('deleteBackupFile',{id:file.id});await load();}catch(e){report(e);}},{confirmLabel:'Xoá',danger:true});
    card.querySelector('[data-restore]').onclick=()=>confirmAction('Tải bản này và phục hồi thử vào database kiểm tra? Dữ liệu đang chạy được giữ nguyên; database kiểm tra sẽ được dọn sau khi xác minh.',async()=>{try{await action('requestBackupRestore',{id:file.id});report('Đang phục hồi thử…');await load();}catch(e){report(e);}},{confirmLabel:'Phục hồi thử'});
    body.append(card);
   }
  }catch(e){report(e);}finally{busy=false;}
 }
 el('[data-now]').onclick=async()=>{el('[data-now]').disabled=true;try{await action('runBackupNow');report('Đang tạo backup…');await load();}catch(e){report(e);el('[data-now]').disabled=false;}};
 el('[data-settings]').onclick=async()=>{
  if(document.querySelector('[data-backup-modal]'))return;
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='backup-dialog';dialog.dataset.backupModal='';
  dialog.innerHTML='<form class="backup-form"><header class="backup-heading"><h2>Cài đặt Backup</h2><button type="button" class="icon-btn" data-close aria-label="Đóng">'+iconHtml('close')+'</button></header><p data-google></p><div class="backup-actions"><button type="button" class="nut" data-connect>Kết nối Google</button><button type="button" class="nut" data-disconnect>Ngắt kết nối</button></div><fieldset disabled><label class="backup-toggle"><input type="checkbox" name="enabled"> Backup tự động</label><div class="backup-form-grid"><label>Giờ chạy (Việt Nam)<input type="time" name="time" required></label><label>Chạy mỗi (ngày)<input type="number" min="1" max="30" name="intervalDays" required></label><label>Giữ bản gần nhất<input type="number" min="1" max="90" name="dailyCopies" required></label><label>Giữ bản tháng<input type="number" min="0" max="24" name="monthlyCopies" required></label></div><p class="phu">Mỗi tháng giữ thêm một bản. Chỉ dọn bản cũ sau khi bản mới đã được kiểm tra phục hồi.</p><button class="nut chinh" type="submit">Lưu cài đặt</button></fieldset><p data-error role="status"></p></form>';
  document.body.append(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),err=e=>{dialog.querySelector('[data-error]').textContent=e.message;};
  const close=()=>{dialog.close();dialog.remove();previous?.focus();};
  dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
  dialog.querySelector('[data-connect]').onclick=()=>location.assign('/api/backup/google/connect');
  dialog.querySelector('[data-disconnect]').onclick=async()=>{try{const r=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});if(!r.ok)throw Error('Không thể ngắt kết nối.');close();await load();}catch(e){err(e);}};
  try{
   const [{preferences:p},{drive}]=await Promise.all([action('getBackupPreferences'),action('getBackupStatus')]);
   if(!dialog.isConnected)return;
   for(const key of ['time','intervalDays','dailyCopies','monthlyCopies'])form.elements[key].value=p[key];
   form.elements.enabled.checked=p.enabled===true;
   dialog.querySelector('[data-google]').textContent=drive.connected?'Đã kết nối: '+drive.email:'Chưa kết nối Google Drive.';
   dialog.querySelector('[data-connect]').hidden=drive.connected;dialog.querySelector('[data-connect]').disabled=!drive.oauthConfigured;
   dialog.querySelector('[data-disconnect]').hidden=!drive.connected;
   dialog.querySelector('fieldset').disabled=false;
  }catch(e){err(e);}
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await action('saveBackupPreferences',{enabled:form.elements.enabled.checked,time:form.elements.time.value,...Object.fromEntries(['intervalDays','dailyCopies','monthlyCopies'].map(k=>[k,Number(form.elements[k].value)]))});close();report('Đã lưu cài đặt Backup.');}catch(e){err(e);}finally{button.disabled=false;}};
 };
 void load();
 const poll=()=>{timer=setTimeout(async()=>{if(!root.isConnected)return;await load();poll();},5000);};
 poll();
}
