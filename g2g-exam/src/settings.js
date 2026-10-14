import {hasApiBackend} from './config.js';
import {AI_PROVIDER_IDS,aiProviderLabel} from './domain/ai-providers.js';
import {bindR2Settings} from './settings/r2.js';
import {bindBackupSettings} from './settings/backup.js';
import {
  loadPrivateSettings,refreshInfrastructure,
  updateSystemSettings,updateSmtpSecret,updateAiApiKey,testSmtp
} from './settings/api.js';
import {settingsPageHtml,connectionStatusHtml} from './settings/view.js';
import {normalizeLayout,validateLayout} from './settings/layout.js';
import {normalizeButtonTheme,validateButtonTheme} from './settings/palette.js';
import {applyLayout} from './settings/theme.js';
import {bindSettingsTabs} from './settings/tabs.js';
import {normalizeSettingsTab} from './settings/route.js';
let selectedSettingsTab='general';
import {initializeTheme,acceptPublicSettings,currentTheme,saveLocalTheme,normalizeThemeColor,applyTheme} from './settings/theme.js';

const localOnly=Boolean(globalThis.G2G_DEMO_BYPASS)||!hasApiBackend();
let pub={general:{systemName:'Luyện thi tiếng Đức'},auth:{googleLoginEnabled:true},operations:{}};
let settings=null;
let infra=null;
let settingsTarget=null,onSettingsTab=()=>{};
let queued=false;
let saving=false;

function master(){
  return document.querySelector('.thanh-dau')?.dataset.currentRole==='master'&&Boolean(document.querySelector('.thanh-ben'));
}
function student(){return document.querySelector('.thanh-dau')?.dataset.currentRole==='student';}
function val(id){return document.getElementById(id)?.value?.trim()||'';}
function chk(id){return Boolean(document.getElementById(id)?.checked);}
function selectedLayout(){
  const input={contentWidth:Number(val('sContentWidth')),cardRadius:Number(val('sCardRadius')),background:val('sBackground')};
  validateLayout(input);return normalizeLayout(input);
}
function selectedButtons(){
  const input={secondaryColor:val('sSecondaryColorText'),selectionStrength:Number(val('sSelectionStrength'))};
  validateButtonTheme(input);return normalizeButtonTheme(input);
}
function updateConnectionStatus(){
  const target=document.querySelector('.tich-hop-tong-quan');
  if(target)target.innerHTML=connectionStatusHtml(infra);
  const hint=document.getElementById('sSecretHint');
  if(hint)hint.textContent=infra?.smtp?.secretConfigured?'Đã lưu mật khẩu an toàn.':'Chưa lưu mật khẩu SMTP.';
  for(const provider of AI_PROVIDER_IDS){
    const hint=document.getElementById(`sAi${provider[0].toUpperCase()+provider.slice(1)}Hint`),state=infra?.ai?.[provider];
    if(hint)hint.textContent=state?.configured?`Đã cấu hình${state.source==='settings'?' trong Cài đặt':' từ biến môi trường'}.`:'Chưa cấu hình.';
  }
}
function selectedThemeColor(){
  const input=document.getElementById('sPrimaryColorText');
  const color=normalizeThemeColor(input?.value);
  if(!color){input?.focus();throw new Error('Nhập mã màu gồm # và 6 ký tự, ví dụ #111827.');}
  return color;
}

function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;enhance();});
}

function applyBrand(){
  const name=pub.general?.systemName==='Thi thử tiếng Đức'?'Luyện thi tiếng Đức':pub.general?.systemName||'Luyện thi tiếng Đức';
  const title=document.querySelector('.ten-he-thong strong');
  if(title&&title.textContent!==name)title.textContent=name;
  const logo=document.querySelector('.thuong-hieu .logo');
  if(logo&&pub.general?.logoUrl){
    const url=`/brand/logo?v=${encodeURIComponent(pub.general.logoUrl)}`;
    if(logo.querySelector('img')?.getAttribute('src')!==url)logo.innerHTML=`<img src="${url}" alt="G2G Career">`;
  }
  if(pub.general?.faviconUrl){
    let icon=document.querySelector('link[rel="icon"]');
    if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon);}
    const url=`/brand/favicon?v=${encodeURIComponent(pub.general.faviconUrl)}`;
    if(icon.getAttribute('href')!==url)icon.href=url;
    const examIcon=document.querySelector('.exam-mobile-brand img');
    if(examIcon&&examIcon.getAttribute('src')!==url)examIcon.src=url;
  }
  const pageTitle=`${name} · G2G`;
  if(document.title!==pageTitle)document.title=pageTitle;
}

function applyLogin(){
  if(localOnly)return;
  const button=document.getElementById('googleLogin');
  if(!button)return;
  const enabled=pub.auth?.googleLoginEnabled!==false;
  if('disabled' in button&&button.disabled===enabled)button.disabled=!enabled;
  const label=enabled?'Bắt đầu luyện thi ngay':'Đăng nhập Google đang tạm tắt';
  if(button.textContent!==label)button.textContent=label;
}

function applyMaintenance(){
  if(localOnly)return;
  const existing=document.querySelector('[data-g2g-maintenance]');
  if(!student()||!pub.operations?.maintenanceMode){existing?.remove();return;}
  const header=document.querySelector('.thanh-dau');
  if(!header)return;
  const message=pub.operations.maintenanceMessage||'Hệ thống đang bảo trì.';
  if(existing){if(existing.textContent!==message)existing.textContent=message;return;}
  const banner=document.createElement('div');
  banner.dataset.g2gMaintenance='1';
  banner.className='canh-bao-bao-tri';
  banner.textContent=message;
  header.insertAdjacentElement('afterend',banner);
}

function enhance(){
  applyBrand();
  applyLogin();
  applyMaintenance();
}

function collectForm(){
  return {
    ...settings,
    general:{...settings.general,systemName:val('sName'),organizationName:val('sOrg'),supportEmail:val('sSupport'),feedbackEmail:val('sFeedbackEmail'),publicUrl:val('sUrl'),examMessages:val('sExamMessages')},
    theme:{...settings.theme,...selectedLayout(),...selectedButtons(),primaryColor:selectedThemeColor()},
    auth:{...settings.auth,googleLoginEnabled:chk('sGoogle'),allowNewStudents:chk('sSignup'),allowedDomain:val('sDomain').replace(/^@/,'').toLowerCase()},
    exam:{...settings.exam},
    smtp:{...settings.smtp,enabled:chk('sSmtp'),host:val('sHost'),port:Number(val('sPort')||587),security:val('sSecurity'),username:val('sUser'),fromName:val('sFromName'),fromEmail:val('sFrom'),replyTo:val('sReply'),timeoutMs:Number(val('sTimeout')||20000),rejectUnauthorized:chk('sTlsVerify')},
    email:{...settings.email,enabled:chk('sEmail'),resultSubject:val('sSubject'),resultText:document.getElementById('sText')?.value||'',resultHtml:document.getElementById('sHtml')?.value||''},
    operations:{...settings.operations,trashRetentionDays:Number(val('sTrashDays')),maintenanceMode:chk('sMaintenance'),maintenanceMessage:val('sMaintenanceText')},
  };
}

function setState(message,bad=false){
  const el=document.getElementById('sState');
  if(!el)return;
  el.textContent=message;
  el.classList.toggle('loi',bad);
}

function renderSettings(){
  const target=settingsTarget;
  if(!target?.isConnected||!master()||!settings)return;
  target.innerHTML=settingsPageHtml({settings,infra,localOnly});
  bindSettingsTabs(target,selectedSettingsTab,tab=>{selectedSettingsTab=tab;onSettingsTab(tab);});
  bindSettingsActions();
}

export async function mountSettingsPage(target,tab='general',onTab=()=>{}){
  if(!target?.isConnected||!master())return;
  settingsTarget=target;selectedSettingsTab=normalizeSettingsTab(tab);onSettingsTab=onTab;
  try{
    const loaded=localOnly?{settings:{theme:currentTheme()},infra:null}:await loadPrivateSettings();
    if(settingsTarget!==target||!target.isConnected||!master())return;
    settings=loaded.settings;infra=loaded.infra;renderSettings();
  }catch(error){
    if(settingsTarget!==target||!target.isConnected)return;
    target.replaceChildren();
    const message=document.createElement('p');message.setAttribute('role','status');message.textContent=error.message||'Không tải được cài đặt.';
    const retry=document.createElement('button');retry.className='nut';retry.textContent='Thử lại';retry.onclick=()=>mountSettingsPage(target,tab,onTab);
    target.append(message,retry);
  }
}

async function save(){
  if(saving)return;
  saving=true;
  const buttons=[document.getElementById('sSave'),document.getElementById('sSaveBottom')].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);
  try{
    if(localOnly){
      saveLocalTheme(selectedThemeColor(),{...selectedLayout(),...selectedButtons()});
      settings={theme:currentTheme()};
      setState('Đã lưu giao diện demo trên trình duyệt này.');
      return;
    }
    setState('Đang lưu...');
    const next=collectForm();
    for(const [field,key] of [['sLogo','logoUrl'],['sFavicon','faviconUrl']]){
      const file=document.getElementById(field)?.files?.[0];
      if(!file)continue;
      if(!file.type.startsWith('image/'))throw new Error('Logo và favicon phải là tệp hình ảnh.');
      const form=new FormData();form.append('file',file);
      const response=await fetch('/api/media/image',{method:'POST',credentials:'include',body:form});
      const uploaded=await response.json();
      if(!response.ok)throw new Error(uploaded.error||'Không tải được hình ảnh.');
      next.general[key]=uploaded.url;
    }
    const out=await updateSystemSettings(next);
    settings=out.settings;
    pub={general:settings.general,theme:settings.theme,auth:settings.auth,operations:settings.operations};
    acceptPublicSettings(pub);
    setState('Đã lưu cài đặt.');
    applyBrand();
    applyLogin();
  }catch(error){setState(error.message,true);}
  finally{saving=false;buttons.forEach(button=>button.disabled=false);}
}

async function saveSecret(){
  const button=document.getElementById('sSecret');
  if(button?.disabled)return;
  const password=document.getElementById('sPassword')?.value||'';
  if(!password)return setState('Hãy nhập mật khẩu SMTP mới.',true);
  if(button)button.disabled=true;
  try{
    setState('Đang mã hóa và lưu mật khẩu...');
    await updateSmtpSecret(password);
    document.getElementById('sPassword').value='';
    infra=await refreshInfrastructure();
    setState('Đã cập nhật mật khẩu SMTP.');
    updateConnectionStatus();
  }catch(error){setState(error.message,true);}
  finally{if(button)button.disabled=false;}
}

async function saveAiKey(provider){
  const suffix=provider[0].toUpperCase()+provider.slice(1),input=document.getElementById(`sAi${suffix}`),button=document.getElementById(`sAi${suffix}Save`);
  const apiKey=input?.value||'';
  if(!apiKey)return setState('Hãy nhập API key AI mới.',true);
  if(button)button.disabled=true;
  try{
    setState('Đang mã hóa và lưu API key AI...');
    await updateAiApiKey(provider,apiKey);input.value='';infra=await refreshInfrastructure();
    setState(`Đã cập nhật API key ${aiProviderLabel(provider)}.`);updateConnectionStatus();
  }catch(error){setState(error.message,true);}
  finally{if(button)button.disabled=false;}
}

async function sendTest(){
  const to=val('sTestTo');
  const status=document.getElementById('sTestState'),button=document.getElementById('sTest');
  const report=(message,bad=false)=>{if(status){status.textContent=message;status.classList.toggle('loi',bad);}setState(message,bad);};
  if(!to)return report('Hãy nhập email nhận thử.',true);
  try{
    button.disabled=true;report('Đang gửi email thử...');
    await testSmtp(to);
    report(`Đã gửi email thử đến ${to}.`);
  }catch(error){report(error.message||'Gửi email thử thất bại.',true);}
  finally{button.disabled=false;}
}

function bindSettingsActions(){
  bindR2Settings();
  bindBackupSettings();
  document.querySelectorAll('[data-asset-pick]').forEach(button=>{
    const input=document.getElementById(button.dataset.assetPick);
    button.onclick=()=>input.click();
    input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      const name=document.querySelector('[data-asset-name="'+input.id+'"]');
      if(!file.type.startsWith('image/')){input.value='';name.textContent='Vui lòng chọn tệp hình ảnh.';return;}
      name.textContent=file.name+' · Chưa lưu';
      const reader=new FileReader();
      reader.onload=()=>{if(input.files?.[0]!==file)return;const preview=document.querySelector('[data-asset-preview="'+input.id+'"]');if(!preview)return;const image=document.createElement('img');image.src=reader.result;image.alt='Ảnh đã chọn';preview.replaceChildren(image);};
      reader.readAsDataURL(file);
    };
  });
  document.getElementById('sSave')?.addEventListener('click',save);
  document.getElementById('sSaveBottom')?.addEventListener('click',save);
  document.getElementById('sSecret')?.addEventListener('click',saveSecret);
  for(const provider of AI_PROVIDER_IDS)document.getElementById(`sAi${provider[0].toUpperCase()+provider.slice(1)}Save`)?.addEventListener('click',()=>saveAiKey(provider));
  document.getElementById('sTest')?.addEventListener('click',sendTest);
  document.getElementById('sRefresh')?.addEventListener('click',async()=>{
    const button=document.getElementById('sRefresh');
    button.disabled=true;
    try{infra=await refreshInfrastructure();updateConnectionStatus();setState('Đã kiểm tra kết nối.');}catch(error){setState(error.message,true);}
    finally{button.disabled=false;}
  });
  const pairs=[['sPrimaryColor','sPrimaryColorText'],['sSecondaryColorPicker','sSecondaryColorText'],['sBackgroundPicker','sBackground']];
  const updatePreview=()=>{
    const error=document.getElementById('sThemeError');
    for(const [pickerId,textId] of pairs){
      const text=document.getElementById(textId),color=normalizeThemeColor(text?.value);
      text?.setAttribute('aria-invalid',String(!color));
      if(color)document.getElementById(pickerId).value=color;
    }
    document.getElementById('sSelectionValue').textContent=val('sSelectionStrength')+'%';
    try{
      const color=normalizeThemeColor(val('sPrimaryColorText'));
      if(!color)throw new Error('Nhập mã màu gồm # và 6 ký tự, ví dụ #111827.');
      const layout=selectedLayout(),buttons=selectedButtons(),preview=document.getElementById('sThemePreview');
      applyTheme(color,preview,buttons);applyLayout(layout,preview);
      error.textContent='Màu chữ trên nút được cân chỉnh tương phản tự động.';error.classList.remove('loi');
    }catch(issue){error.textContent=issue.message;error.classList.add('loi');}
  };
  for(const [pickerId,textId] of pairs){
    const picker=document.getElementById(pickerId),text=document.getElementById(textId);
    picker?.addEventListener('input',()=>{text.value=picker.value.toUpperCase();updatePreview();});
    text?.addEventListener('input',updatePreview);
  }
  for(const id of ['sContentWidth','sCardRadius','sSelectionStrength'])document.getElementById(id)?.addEventListener('input',updatePreview);
}

{
  const app=document.getElementById('app');
  if(app)new MutationObserver(queue).observe(app,{childList:true});
  queue();
  (async()=>{
    pub={...pub,...await initializeTheme()};
    queue();
  })();
}
