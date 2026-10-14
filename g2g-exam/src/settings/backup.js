import {r2SettingsAction} from './api.js';
import {esc} from '../ui/format.js';

export function backupSettingsCardHtml(){
  return `<section class="the cai-dat-card" id="sBackupCard"><div class="cai-dat-card-head"><h2>Backup</h2><p>Google Drive · 7 bản hằng ngày + 1 bản mỗi 30 ngày.</p></div>
  <div class="cai-dat-fields"><p id="sBackupStatus" role="status">Đang kiểm tra kết nối…</p>
  <div class="email-test"><button type="button" class="nut chinh" id="sBackupConnect">Kết nối Google Drive</button>
  <button type="button" class="nut" id="sBackupDisconnect" hidden>Ngắt kết nối</button></div>
  <button type="button" class="nut" id="sBackupNow">Backup ngay</button><p id="sBackupLast" role="status"></p><small>Chỉ Quản trị cấp cao có quyền. Backup chỉ hoạt động sau khi cấu hình runner và kiểm thử restore trên VPS.</small></div></section>`;
}
export function bindBackupSettings(){
  const root=document.getElementById('sBackupCard');if(!root)return;
  const status=root.querySelector('#sBackupStatus'),connect=root.querySelector('#sBackupConnect'),disconnect=root.querySelector('#sBackupDisconnect');
  const report=(value,bad=false)=>{status.textContent=value;status.classList.toggle('loi',bad);};
  async function load(){
    try{
      const c=await r2SettingsAction('getBackupDriveStatus');
      connect.hidden=c.connected;disconnect.hidden=!c.connected;
      report(c.connected?`Đã kết nối: ${c.email||'Google Drive'} · Thư mục G2G Exam`:c.oauthConfigured?'Chưa kết nối Google Drive.':'Chưa cấu hình OAuth Backup trên máy chủ.');
      connect.disabled=!c.oauthConfigured;
    }catch(error){report(error.message,true);}
  }
  connect.onclick=()=>{globalThis.location.assign('/api/backup/google/connect');};
  disconnect.onclick=async()=>{
    if(!globalThis.confirm('Ngắt kết nối Google Drive? Các bản backup trên Drive sẽ được giữ nguyên.'))return;
    disconnect.disabled=true;
    try{
      const res=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});
      if(!res.ok)throw new Error('Không thể ngắt kết nối.');await load();
    }catch(error){report(error.message,true);}finally{disconnect.disabled=false;}
  };
  void load();
}
