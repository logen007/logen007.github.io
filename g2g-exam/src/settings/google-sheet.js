import {confirmAction} from '../ui/confirm.js';

export function googleSheetSettingsHtml(){
  return `<section class="the cai-dat-card" id="sGoogleConnections"><div class="cai-dat-card-head"><h2>Google Drive và Sheet ảnh</h2><p>Kết nối Google và cấp quyền cho file Exam img. Không cấp quyền toàn bộ Drive.</p></div><div class="cai-dat-fields">
  <p data-google-status role="status" aria-live="polite">Đang kiểm tra…</p>
  <div class="google-connection-actions"><a class="nut" href="/api/backup/google/connect" data-google-connect>Kết nối Google Drive</a><button class="nut" type="button" data-google-disconnect>Ngắt Google Drive</button></div>
  <label class="cai-dat-field"><span>Google Picker API key</span><input class="truong" data-picker-key type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><small>Key trong dự án Google hiện có. Chỉ master được dùng khi mở cửa sổ chọn file.</small></label>
  <label class="cai-dat-field"><span>Project number</span><input class="truong" data-picker-project inputmode="numeric" autocomplete="off" placeholder="Dãy số của dự án Google Cloud"><small>Dùng Project number, không phải Project ID hoặc OAuth Client ID.</small></label>
  <div class="google-connection-actions"><button class="nut chinh" type="button" data-picker-save>Lưu cấu hình</button><button class="nut" type="button" data-picker-authorize disabled>Chọn Exam img và cấp quyền</button><button class="nut" type="button" data-picker-disconnect disabled>Ngắt Sheet ảnh</button></div>
  <small>Chọn đúng Exam img trong cửa sổ Google. Cấp quyền không đồng bộ ảnh; sau đó dùng nút Đồng bộ ảnh ở Đề Thi. Ngắt Sheet ảnh tại đây không thu hồi kết nối Sao lưu.</small>
  </div></section>`;
}

async function request(path,body){
  const response=await fetch(String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'')+'/exam-images/'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Chưa kết nối được Google.');return data;
}
let pickerLoad;
export function loadGooglePicker(){
  if(globalThis.google?.picker)return Promise.resolve();
  if(pickerLoad)return pickerLoad;
  pickerLoad=new Promise((resolve,reject)=>{
    let script,timer;
    const finish=error=>{clearTimeout(timer);if(error){script?.remove();reject(error);}else resolve();};
    const load=()=>globalThis.gapi.load('picker',{callback:()=>finish(),timeout:15000,ontimeout:()=>finish(Error('Google Picker phản hồi quá chậm. Anh thử lại.'))});
    timer=setTimeout(()=>finish(Error('Không tải được Google Picker. Kiểm tra mạng rồi thử lại.')),30000);
    if(globalThis.gapi){load();return;}
    script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.async=true;
    script.onload=load;script.onerror=()=>finish(Error('Không tải được Google Picker.'));
    document.head.append(script);
  }).catch(error=>{pickerLoad=null;throw error;});
  return pickerLoad;
}
export function chooseImageSheet(config,google=globalThis.google){
  return new Promise((resolve,reject)=>{
    const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST).setMimeTypes('application/vnd.google-apps.spreadsheet').setFileIds(config.sheetId);
    const picker=new google.picker.PickerBuilder().setAppId(config.appId).setDeveloperKey(config.apiKey).setOAuthToken(config.accessToken).setOrigin(globalThis.location.origin).addView(view).setCallback(data=>{
      if(data.action===google.picker.Action.CANCEL){resolve(false);return;}
      if(data.action!==google.picker.Action.PICKED)return;
      const id=data.docs?.[0]?.id;
      if(id!==config.sheetId){reject(Error('Anh chọn đúng file Exam img đã gửi nhé.'));return;}
      resolve(id);
    }).build();picker.setVisible(true);
  });
}

export function bindGoogleSheetSettings(){
  const root=document.getElementById('sGoogleConnections');if(!root||root.dataset.bound)return;root.dataset.bound='true';
  const el=selector=>root.querySelector(selector),report=text=>{el('[data-google-status]').textContent=text;};
  let busy=false;
  const load=async()=>{
    const state=await request('google-settings');if(!root.isConnected)return;
    el('[data-picker-project]').value=state.projectNumber;
    el('[data-picker-key]').placeholder=state.configured?'Đã lưu · nhập khi cần thay':'Nhập API key Google Picker';
    el('[data-picker-authorize]').disabled=!state.configured||!state.driveConnected;
    el('[data-picker-disconnect]').disabled=!state.authorized;
    el('[data-google-disconnect]').disabled=!state.driveConnected;
    el('[data-google-connect]').textContent=state.driveConnected?'Kết nối lại Google Drive':'Kết nối Google Drive';
    report(!state.driveConnected?'Chưa kết nối Google Drive.':state.authorized?'Đã cấp quyền Sheet ảnh · '+state.email:'Đã kết nối Google Drive · Chưa cấp quyền Sheet ảnh.');
  };
  const act=(selector,fn)=>{const button=el(selector);button.onclick=async()=>{
    if(busy||button.disabled)return;busy=true;button.disabled=true;button.setAttribute('aria-busy','true');
    try{await fn();button.disabled=false;await load();}catch(error){button.disabled=false;report(error.message||'Không hoàn tất được kết nối Google.');}
    finally{busy=false;button.removeAttribute('aria-busy');}
  };};
  act('[data-picker-save]',async()=>{await request('google-settings',{apiKey:el('[data-picker-key]').value.trim(),projectNumber:el('[data-picker-project]').value.trim()});el('[data-picker-key]').value='';});
  act('[data-picker-authorize]',async()=>{
    report('Đang mở cửa sổ chọn Sheet…');await loadGooglePicker();
    const config=await request('picker',{}),sheetId=await chooseImageSheet(config);
    if(sheetId)await request('authorize',{sheetId});
  });
  act('[data-picker-disconnect]',()=>request('disconnect',{}));
  act('[data-google-disconnect]',async()=>{
    const confirmed=await new Promise(resolve=>confirmAction('Ngắt Google Drive sẽ làm Sao lưu và đồng bộ ảnh ngừng hoạt động. Dữ liệu trên Drive vẫn giữ nguyên.',()=>resolve(true),{confirmLabel:'Ngắt kết nối',onCancel:()=>resolve(false)}));
    if(!confirmed)return;
    const response=await fetch('/api/backup/google/disconnect',{method:'POST',credentials:'include'});if(!response.ok)throw Error('Chưa ngắt được Google Drive.');
    await request('disconnect',{});
  });
  void load().catch(error=>report(error.message));
}
