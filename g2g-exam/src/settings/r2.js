import {r2SettingsAction} from './api.js';
import {registerMediaDelivery} from '../ui/media-delivery.js';

export function r2SettingsCardHtml(){
  const field=(id,title,type='text')=>`<label class="cai-dat-field"><span>${title}</span><input class="truong" id="${id}" type="${type}" autocomplete="${type==='password'?'new-password':'off'}" spellcheck="false" maxlength="256" ${type==='password'?'placeholder="Để trống để giữ khóa đã lưu"':''}></label>`;
  return `<section class="the cai-dat-card" id="r2Settings"><div class="cai-dat-card-head"><h2>Lưu trữ ảnh & audio (R2)</h2><p>Giảm tải media cho VPS. Giữ bản gốc trên VPS để dự phòng.</p></div><div class="cai-dat-fields"><fieldset class="r2-settings-fields" disabled><label class="cai-dat-toggle"><input id="sR2Enabled" type="checkbox"><span><b>Bật phân phối qua R2</b><small>Chỉ chuyển các tệp đã đồng bộ và kiểm tra thành công.</small></span></label>${field('sR2Account','Cloudflare Account ID')}${field('sR2Bucket','Tên bucket')}${field('sR2Key','Access Key ID','password')}${field('sR2Secret','Secret Access Key','password')}<small class="phu-de" id="sR2Credentials">Khóa được mã hóa trên máy chủ, không gửi lại về trình duyệt.</small><div class="nhom-nut"><button type="button" class="nut" id="sR2Test">Kiểm tra kết nối</button><button type="button" class="nut chinh" id="sR2Save">Lưu cấu hình R2</button></div></fieldset><p class="phu-de r2-settings-status" id="sR2Status" role="status" aria-live="polite">Đang tải cấu hình…</p><button type="button" class="nut" id="sR2Retry" hidden>Thử tải lại</button><small class="phu-de">Bucket riêng tư · Quyền Object Read & Write · CORS cho tên miền website. Lưu riêng bằng nút trên; không cần khởi động lại VPS.</small></div></section>`;
}

export function bindR2Settings(){
  const root=document.getElementById('r2Settings');if(!root)return;
  const el=id=>root.querySelector('#'+id),fields=root.querySelector('fieldset');
  const report=(message,error=false)=>{el('sR2Status').textContent=message;el('sR2Status').classList.toggle('loi',error);};
  function fill(c){
    el('sR2Enabled').checked=c.enabled;el('sR2Account').value=c.account;el('sR2Bucket').value=c.bucket;
    el('sR2Key').value='';el('sR2Secret').value='';
    el('sR2Credentials').textContent=c.credentialsConfigured?'Đã lưu cặp khóa an toàn. Để trống cả hai ô để giữ nguyên.':'Chưa có cặp khóa kết nối. Khóa được mã hóa trên máy chủ.';
  }
  async function load(){
    fields.disabled=true;el('sR2Retry').hidden=true;report('Đang tải cấu hình…');
    try{const c=await r2SettingsAction('getR2Settings');fill(c);fields.disabled=false;report(c.enabled?'R2 đang bật. Tệp chưa đồng bộ vẫn dùng VPS.':'Đang dùng VPS. R2 chưa bật.');}
    catch(error){report(error.message,true);el('sR2Retry').hidden=false;}
  }
  async function run(action){
    const data={enabled:el('sR2Enabled').checked,account:el('sR2Account').value,bucket:el('sR2Bucket').value,accessKeyId:el('sR2Key').value,secretAccessKey:el('sR2Secret').value};
    fields.disabled=true;report(action==='testR2Settings'?'Đang kiểm tra kết nối…':'Đang lưu cấu hình…');
    try{
      const result=await r2SettingsAction(action,data);
      if(action==='saveR2Settings'){
        fill(result);report(result.enabled?'Đã lưu và bật R2. Media được đồng bộ nền; VPS vẫn sẵn sàng dự phòng.':'Đã lưu. Website đang dùng VPS.');
        if(result.enabled)void registerMediaDelivery();
      }else report(result.message);
    }catch(error){report(error.message,true);}
    finally{fields.disabled=false;}
  }
  el('sR2Test').onclick=()=>run('testR2Settings');
  el('sR2Save').onclick=()=>run('saveR2Settings');
  el('sR2Retry').onclick=load;
  void load();
}
