import {r2SettingsAction} from './api.js';
import {confirmAction} from '../ui/confirm.js';

export function backupSettingsCardHtml(){
  return `<section class="the cai-dat-card" id="sBackupCard"><div class="cai-dat-card-head"><h2>Backup</h2><p>Google Drive · 7 bản hằng ngày + 1 bản mỗi 30 ngày.</p></div>
  <div class="cai-dat-fields"><p id="sBackupStatus" role="status">Đang kiểm tra kết nối…</p>
  <div class="email-test"><button type="button" class="nut chinh" id="sBackupConnect">Kết nối Google Drive</button>
  <button type="button" class="nut" id="sBackupDisconnect" hidden>Ngắt kết nối</button></div>
  <button type="button" class="nut" id="sBackupNow">Backup ngay</button><p id="sBackupLast" role="status"></p><div id="sBackupHistory" class="phu-de"></div><small>Chỉ Quản trị cấp cao có quyền. Backup chỉ hoạt động sau khi cấu hình runner và kiểm thử restore trên VPS.</small></div></section>`;
}
export function bindBackupSettings(){
  const root=document.getElementById('sBackupCard');if(!root)return;
  const status=root.querySelector('#sBackupStatus'),connect=root.querySelector('#sBackupConnect'),disconnect=root.querySelector('#sBackupDisconnect');
  const report=(value,bad=false)=>{status.textContent=value;status.classList.toggle('loi',bad);};
  let loading=false;
  async function load(){
    if(loading||!root.isConnected||document.hidden)return;
    loading=true;
    try{
      const {drive:c,status,enabled,history}=await r2SettingsAction('getBackupStatus');
      const last=root.querySelector('#sBackupLast');
      last.textContent=!enabled?'Chưa bật backup trên VPS.':status?.state==='success'?'Backup thành công · '+new Date(status.finishedAt).toLocaleString('vi-VN'):status?.state==='failed'?'Backup gần nhất thất bại.':status?.state==='running'?'Đang backup…':'Chưa có bản backup.';
      root.querySelector('#sBackupNow').disabled=!enabled||!c.connected||['queued','running'].includes(status?.state);
      if(status?.state==='queued')last.textContent='Đang chờ backup…';
      const list=root.querySelector('#sBackupHistory');list.replaceChildren();
      for(const item of history||[]){const p=document.createElement('p');p.textContent=(item.type==='monthly'?'Bản 30 ngày':'Hằng ngày')+' · '+item.name+' · '+(item.size/1048576).toFixed(1)+' MB';p.title='SHA-256: '+item.sha256;list.append(p);}
      connect.hidden=c.connected;disconnect.hidden=!c.connected;
      report(c.connected?`Đã kết nối: ${c.email||'Google Drive'} · Thư mục G2G Exam`:c.oauthConfigured?'Chưa kết nối Google Drive.':'Chưa cấu hình OAuth Backup trên máy chủ.');
      connect.disabled=!c.oauthConfigured;
    }catch(error){report(error.message,true);root.querySelector('#sBackupNow').disabled=true;}finally{loading=false;}
  }
  connect.onclick=()=>{globalThis.location.assign('/api/backup/google/connect');};
  disconnect.onclick=async()=>{
    if(!await new Promise(resolve=>confirmAction('Ngắt kết nối Google Drive? Các bản backup trên Drive sẽ được giữ nguyên.',()=>resolve(true),{confirmLabel:'Ngắt kết nối',onCancel:()=>resolve(false)})))return;
    disconnect.disabled=true;
    try{
      const res=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});
      if(!res.ok)throw new Error('Không thể ngắt kết nối.');await load();
    }catch(error){report(error.message,true);}finally{disconnect.disabled=false;}
  };
  root.querySelector('#sBackupNow').onclick=async()=>{const button=root.querySelector('#sBackupNow');button.disabled=true;try{await r2SettingsAction('runBackupNow');report('Đã yêu cầu backup.');await load();}catch(error){report(error.message,true);button.disabled=false;}};
  void load();
  const refresh=()=>setTimeout(async()=>{if(!root.isConnected)return;await load();refresh();},15000);
  refresh();
}
