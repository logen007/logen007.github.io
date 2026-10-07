import {hasApiBackend} from './config.js';
import {
  loadPrivateSettings,refreshInfrastructure,
  updateSystemSettings,updateSmtpSecret,testSmtp
} from './settings/api.js';
import {settingsPageHtml} from './settings/view.js';
import {initializeTheme,acceptPublicSettings,currentTheme,saveLocalTheme,normalizeThemeColor,applyTheme} from './settings/theme.js';
import {iconHtml} from './ui/icons.js';

const localOnly=Boolean(globalThis.G2G_DEMO_BYPASS)||!hasApiBackend();
let pub={general:{systemName:'Thi thử tiếng Đức'},auth:{googleLoginEnabled:true},operations:{}};
let settings=null;
let infra=null;
let open=false;
let queued=false;

function master(){
  return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Quản trị cấp cao'&&Boolean(document.querySelector('.thanh-ben'));
}
function student(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Học viên';}
function val(id){return document.getElementById(id)?.value?.trim()||'';}
function chk(id){return Boolean(document.getElementById(id)?.checked);}
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
  const name=pub.general?.systemName||'Thi thử tiếng Đức';
  const title=document.querySelector('.ten-he-thong strong');
  if(title&&title.textContent!==name)title.textContent=name;
  const pageTitle=`${name} · G2G`;
  if(document.title!==pageTitle)document.title=pageTitle;
}

function applyLogin(){
  if(localOnly)return;
  const button=document.getElementById('googleLogin');
  if(!button)return;
  const enabled=pub.auth?.googleLoginEnabled!==false;
  if('disabled' in button&&button.disabled===enabled)button.disabled=!enabled;
  const label=enabled?'Đăng nhập bằng Google':'Đăng nhập Google đang tạm tắt';
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

function injectSettingsButton(){
  const side=document.querySelector('.thanh-ben');
  if(!side||!master())return;
  let button=side.querySelector('[data-action="g2g-settings"]');
  if(!button){
    button=document.createElement('button');
    button.className='muc-ben';
    button.dataset.action='g2g-settings';
    button.innerHTML=`${iconHtml('settings')}<span>Cài đặt</span>`;
    side.appendChild(button);
  }
  if(open){
    side.querySelectorAll('.muc-ben').forEach(x=>{x.classList.remove('active');x.removeAttribute('aria-current');});
    button.classList.add('active');
    button.setAttribute('aria-current','page');
  }
}

function enhance(){
  applyBrand();
  applyLogin();
  applyMaintenance();
  injectSettingsButton();
  if(open&&master())renderSettings(false);
  if(open&&!master())open=false;
}

function collectForm(){
  return {
    ...settings,
    general:{...settings.general,systemName:val('sName'),organizationName:val('sOrg'),supportEmail:val('sSupport'),publicUrl:val('sUrl')},
    theme:{...settings.theme,primaryColor:selectedThemeColor()},
    auth:{...settings.auth,googleLoginEnabled:chk('sGoogle'),allowNewStudents:chk('sSignup'),allowedDomain:val('sDomain').replace(/^@/,'').toLowerCase()},
    exam:{...settings.exam,allowRetake:chk('sRetake'),allowRestart:chk('sRestart')},
    smtp:{...settings.smtp,enabled:chk('sSmtp'),host:val('sHost'),port:Number(val('sPort')||587),security:val('sSecurity'),username:val('sUser'),fromName:val('sFromName'),fromEmail:val('sFrom'),replyTo:val('sReply'),timeoutMs:Number(val('sTimeout')||20000),rejectUnauthorized:chk('sTlsVerify')},
    email:{...settings.email,enabled:chk('sEmail'),resultSubject:val('sSubject'),resultText:document.getElementById('sText')?.value||'',resultHtml:document.getElementById('sHtml')?.value||''},
    operations:{...settings.operations,maintenanceMode:chk('sMaintenance'),maintenanceMessage:val('sMaintenanceText')},
  };
}

function setState(message,bad=false){
  const el=document.getElementById('sState');
  if(!el)return;
  el.textContent=message;
  el.classList.toggle('loi',bad);
}

function renderSettings(force=true){
  const target=document.querySelector('.noi-dung-quan-tri');
  if(!target||!master()||!settings)return;
  if(!force&&target.querySelector('.g2g-settings-page'))return;
  target.innerHTML=settingsPageHtml({settings,infra,localOnly});
  bindSettingsActions();
}

async function save(){
  try{
    if(localOnly){
      saveLocalTheme(selectedThemeColor());
      settings={theme:currentTheme()};
      setState('Đã lưu giao diện demo trên trình duyệt này.');
      return;
    }
    setState('Đang lưu...');
    const out=await updateSystemSettings(collectForm());
    settings=out.settings;
    pub={general:settings.general,theme:settings.theme,auth:settings.auth,operations:settings.operations};
    acceptPublicSettings(pub);
    setState('Đã lưu cài đặt.');
    applyBrand();
    applyLogin();
  }catch(error){setState(error.message,true);}
}

async function saveSecret(){
  const password=document.getElementById('sPassword')?.value||'';
  if(!password)return setState('Hãy nhập mật khẩu SMTP mới.',true);
  try{
    setState('Đang mã hóa và lưu mật khẩu...');
    await updateSmtpSecret(password);
    document.getElementById('sPassword').value='';
    infra=await refreshInfrastructure();
    setState('Đã cập nhật mật khẩu SMTP.');
    renderSettings(true);
  }catch(error){setState(error.message,true);}
}

async function sendTest(){
  const to=val('sTestTo');
  if(!to)return setState('Hãy nhập email nhận thử.',true);
  try{
    setState('Đang gửi email thử...');
    await testSmtp(to);
    setState('Đã gửi email thử thành công.');
  }catch(error){setState(error.message,true);}
}

function bindSettingsActions(){
  document.getElementById('sSave')?.addEventListener('click',save);
  document.getElementById('sSaveBottom')?.addEventListener('click',save);
  document.getElementById('sSecret')?.addEventListener('click',saveSecret);
  document.getElementById('sTest')?.addEventListener('click',sendTest);
  document.getElementById('sRefresh')?.addEventListener('click',async()=>{
    try{infra=await refreshInfrastructure();renderSettings(true);}catch(error){setState(error.message,true);}
  });
  const picker=document.getElementById('sPrimaryColor'),text=document.getElementById('sPrimaryColorText');
  const updatePreview=()=>{
    const color=normalizeThemeColor(text?.value),error=document.getElementById('sThemeError');
    text?.setAttribute('aria-invalid',String(!color));
    if(error){
      error.textContent=color?'Chữ và nền được cân chỉnh tương phản tự động.':'Nhập mã màu gồm # và 6 ký tự, ví dụ #111827.';
      error.classList.toggle('loi',!color);
    }
    document.querySelectorAll('[data-theme-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themePreset===color)));
    if(!color)return;
    if(picker)picker.value=color;
    applyTheme(color,document.getElementById('sThemePreview'));
  };
  picker?.addEventListener('input',()=>{if(text)text.value=picker.value.toUpperCase();updatePreview();});
  text?.addEventListener('input',updatePreview);
  document.querySelectorAll('[data-theme-preset]').forEach(button=>button.addEventListener('click',()=>{
    if(text)text.value=button.dataset.themePreset;
    updatePreview();
  }));
}

{
  document.addEventListener('click',async event=>{
    const settingsButton=event.target.closest?.('[data-action="g2g-settings"]');
    if(settingsButton){
      event.preventDefault();
      event.stopPropagation();
      open=true;
      try{
        if(localOnly){settings={theme:currentTheme()};infra=null;}
        else{
          const loaded=await loadPrivateSettings();
          settings=loaded.settings;
          infra=loaded.infra;
        }
        renderSettings(true);
      }catch(error){console.error(error);}
      return;
    }
    if(event.target.closest?.('[data-action="admin-tab"]'))open=false;
  },true);

  const app=document.getElementById('app');
  if(app)new MutationObserver(queue).observe(app,{childList:true});
  queue();
  (async()=>{
    pub={...pub,...await initializeTheme()};
    queue();
  })();
}
