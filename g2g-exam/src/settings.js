import { APP_CONFIG, isFirebaseConfigured } from './config.js';

const STORAGE_KEY='g2g.exam.system-settings.v1';
const DEFAULT_SETTINGS={
  version:1,
  general:{
    systemName:'Thi thử tiếng Đức',
    organizationName:'G2G Career',
    supportEmail:'admin@g2gcareer.com'
  },
  exam:{
    allowRetake:true,
    allowRestart:true
  },
  results:{
    notifyResultEmail:true,
    resultEmailSubject:'G2G – Đã có kết quả {exam}'
  },
  operations:{
    maintenanceMode:false,
    maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'
  }
};

let settings=mergeSettings(DEFAULT_SETTINGS,loadLocalSettings());
let settingsOpen=false;
let renderQueued=false;
let firestore=null;
let functions=null;
let firebaseApi=null;
let unsubscribeSettings=null;
let backendReady=!isFirebaseConfigured();

function clone(v){return JSON.parse(JSON.stringify(v));}
function mergeSettings(base,input){
  const src=input&&typeof input==='object'?input:{};
  return {
    ...clone(base),
    ...src,
    general:{...base.general,...(src.general||{})},
    exam:{...base.exam,...(src.exam||{})},
    results:{...base.results,...(src.results||{})},
    operations:{...base.operations,...(src.operations||{})}
  };
}
function loadLocalSettings(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};}catch{return {};}
}
function saveLocalSettings(next){localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function isMasterDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Quản trị cấp cao'&&Boolean(document.querySelector('.thanh-ben'));}
function isStudentDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Học viên';}

function queueEnhance(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;enhance();});
}

function enhance(){
  applyBranding();
  applyStudentControls();
  injectSettingsTab();
  if(settingsOpen&&isMasterDom())renderSettingsPage(false);
  if(settingsOpen&&!isMasterDom())settingsOpen=false;
}

function applyBranding(){
  const name=String(settings.general?.systemName||DEFAULT_SETTINGS.general.systemName).trim();
  const header=document.querySelector('.ten-he-thong strong');
  if(header&&header.textContent!==name)header.textContent=name;
  const examHeader=document.querySelector('.thanh-thi strong');
  if(examHeader&&examHeader.textContent!==`G2G · ${name}`)examHeader.textContent=`G2G · ${name}`;
  const title=`${name} · G2G`;
  if(document.title!==title)document.title=title;
}

function managedButton(button,disabled,label){
  if(!button)return;
  if(!button.dataset.g2gOriginalText)button.dataset.g2gOriginalText=button.textContent.trim();
  if(disabled){
    if(!button.disabled)button.disabled=true;
    if(button.dataset.g2gManagedDisabled!=='1')button.dataset.g2gManagedDisabled='1';
    if(label&&button.textContent!==label)button.textContent=label;
  }else if(button.dataset.g2gManagedDisabled==='1'){
    if(button.disabled)button.disabled=false;
    const original=button.dataset.g2gOriginalText||button.textContent;
    if(button.textContent!==original)button.textContent=original;
    delete button.dataset.g2gManagedDisabled;
  }
}

function applyStudentControls(){
  const existing=document.querySelector('[data-g2g-maintenance]');
  if(!isStudentDom()){
    if(existing)existing.remove();
    return;
  }
  const maintenance=Boolean(settings.operations?.maintenanceMode);
  if(maintenance){
    const message=settings.operations?.maintenanceMessage||DEFAULT_SETTINGS.operations.maintenanceMessage;
    if(existing){
      if(existing.textContent!==message)existing.textContent=message;
    }else{
      const header=document.querySelector('.thanh-dau');
      if(header){
        const el=document.createElement('div');
        el.className='canh-bao-bao-tri';
        el.dataset.g2gMaintenance='1';
        el.textContent=message;
        header.insertAdjacentElement('afterend',el);
      }
    }
  }else if(existing){
    existing.remove();
  }
  document.querySelectorAll('[data-action="start"]').forEach(button=>{
    const original=button.dataset.g2gOriginalText||button.textContent.trim();
    const isRetake=original==='Thi lại';
    if(maintenance)managedButton(button,true,'Tạm khóa');
    else if(isRetake&&!settings.exam?.allowRetake)managedButton(button,true,'Không cho thi lại');
    else managedButton(button,false);
  });
  document.querySelectorAll('[data-action="restart"]').forEach(button=>{
    if(maintenance)managedButton(button,true,'Tạm khóa');
    else if(!settings.exam?.allowRestart)managedButton(button,true,'Không cho làm lại');
    else managedButton(button,false);
  });
}

function injectSettingsTab(){
  const sidebar=document.querySelector('.thanh-ben');
  if(!sidebar||!isMasterDom())return;
  let button=sidebar.querySelector('[data-action="g2g-settings"]');
  if(!button){
    button=document.createElement('button');
    button.className='muc-ben';
    button.dataset.action='g2g-settings';
    button.textContent='Cài đặt';
    sidebar.appendChild(button);
  }
  if(settingsOpen){
    sidebar.querySelectorAll('.muc-ben.active').forEach(x=>{if(x!==button)x.classList.remove('active');});
    if(!button.classList.contains('active'))button.classList.add('active');
  }
}

function settingCard(title,description,body){
  return `<section class="the cai-dat-card"><div class="cai-dat-card-head"><h2>${esc(title)}</h2><p>${esc(description)}</p></div><div class="cai-dat-fields">${body}</div></section>`;
}
function textField(id,label,value,help='',type='text',placeholder=''){
  return `<label class="cai-dat-field"><span>${esc(label)}</span><input class="truong" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">${help?`<small>${esc(help)}</small>`:''}</label>`;
}
function toggleField(id,label,checked,help=''){
  return `<label class="cai-dat-toggle"><input id="${id}" type="checkbox" ${checked?'checked':''}><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span></label>`;
}

function renderSettingsPage(force=false){
  const target=document.querySelector('.noi-dung-quan-tri');
  if(!target||!isMasterDom())return;
  if(!force&&target.querySelector('.g2g-settings-page'))return;
  const s=settings;
  target.innerHTML=`<div class="g2g-settings-page">
    <div class="tieu-de-trang"><div><h1>Cài đặt hệ thống</h1><p>Thiết lập dùng chung cho toàn bộ hệ thống. Chỉ Quản trị cấp cao được thay đổi.</p></div><div class="nhom-nut"><button class="nut" id="resetSystemSettings">Khôi phục mặc định</button><button class="nut chinh" id="saveSystemSettings">Lưu cài đặt</button></div></div>
    <div class="cai-dat-grid">
      ${settingCard('Thông tin hệ thống','Tên hiển thị và thông tin hỗ trợ.',
        textField('settingSystemName','Tên hệ thống',s.general.systemName,'Hiển thị trên thanh đầu trang.')+
        textField('settingOrganization','Đơn vị vận hành',s.general.organizationName)+
        textField('settingSupportEmail','Email hỗ trợ',s.general.supportEmail,'Dùng làm đầu mối hỗ trợ học viên.','email'))}
      ${settingCard('Quyền làm bài','Kiểm soát việc học viên thi lại hoặc bỏ lượt đang làm để bắt đầu lại.',
        toggleField('settingAllowRetake','Cho phép thi lại',Boolean(s.exam.allowRetake),'Học viên có thể làm cùng một đề nhiều lần.')+
        toggleField('settingAllowRestart','Cho phép bỏ lượt và làm lại từ đầu',Boolean(s.exam.allowRestart),'Không ảnh hưởng các lượt thi đã lưu trước đó.'))}
      ${settingCard('Kết quả & email','Thiết lập email gửi khi chủ bài công bố kết quả.',
        toggleField('settingNotifyEmail','Gửi email khi công bố kết quả',Boolean(s.results.notifyResultEmail),'Nếu tắt, kết quả vẫn hiển thị trong tài khoản học viên.')+
        textField('settingEmailSubject','Tiêu đề email',s.results.resultEmailSubject,'Có thể dùng {exam} và {student}.'))}
      ${settingCard('Vận hành / bảo trì','Khóa việc bắt đầu lượt thi mới trong lúc bảo trì. Lượt đang làm vẫn có thể tiếp tục.',
        toggleField('settingMaintenance','Bật chế độ bảo trì',Boolean(s.operations.maintenanceMode),'Học viên không thể bắt đầu hoặc làm lại lượt thi mới.')+
        `<label class="cai-dat-field"><span>Thông báo bảo trì</span><textarea class="truong" id="settingMaintenanceMessage" rows="4">${esc(s.operations.maintenanceMessage)}</textarea><small>Thông báo này sẽ xuất hiện ở trang học viên khi bật bảo trì.</small></label>`)}
    </div>
    <div class="cai-dat-footer"><span id="settingsSaveState" class="phu-de">${s.updatedAt?`Cập nhật gần nhất: ${esc(formatDate(s.updatedAt))}`:'Chưa có thay đổi được lưu trên máy chủ.'}</span><button class="nut chinh" id="saveSystemSettingsBottom">Lưu cài đặt</button></div>
  </div>`;
  injectSettingsTab();
  const save=()=>saveSettingsFromForm();
  document.getElementById('saveSystemSettings')?.addEventListener('click',save);
  document.getElementById('saveSystemSettingsBottom')?.addEventListener('click',save);
  document.getElementById('resetSystemSettings')?.addEventListener('click',async()=>{
    if(!confirm('Khôi phục toàn bộ cài đặt về mặc định?'))return;
    await persistSettings(clone(DEFAULT_SETTINGS));
  });
}

function formatDate(v){
  try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return '—';}
}
function value(id){return document.getElementById(id)?.value?.trim()||'';}
function checked(id){return Boolean(document.getElementById(id)?.checked);}

async function saveSettingsFromForm(){
  const next={
    version:1,
    general:{
      systemName:value('settingSystemName'),
      organizationName:value('settingOrganization'),
      supportEmail:value('settingSupportEmail')
    },
    exam:{
      allowRetake:checked('settingAllowRetake'),
      allowRestart:checked('settingAllowRestart')
    },
    results:{
      notifyResultEmail:checked('settingNotifyEmail'),
      resultEmailSubject:value('settingEmailSubject')
    },
    operations:{
      maintenanceMode:checked('settingMaintenance'),
      maintenanceMessage:value('settingMaintenanceMessage')
    }
  };
  if(!next.general.systemName){setSaveState('Tên hệ thống không được để trống.',true);return;}
  if(next.general.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.general.supportEmail)){setSaveState('Email hỗ trợ không hợp lệ.',true);return;}
  if(!next.results.resultEmailSubject){setSaveState('Tiêu đề email không được để trống.',true);return;}
  if(!next.operations.maintenanceMessage){setSaveState('Thông báo bảo trì không được để trống.',true);return;}
  await persistSettings(next);
}

function setSaveState(text,error=false){
  const el=document.getElementById('settingsSaveState');
  if(el){el.textContent=text;el.classList.toggle('loi',Boolean(error));}
}
function setSaving(disabled){
  ['saveSystemSettings','saveSystemSettingsBottom','resetSystemSettings'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=disabled;});
}

async function persistSettings(next){
  try{
    setSaving(true);setSaveState('Đang lưu...');
    if(isFirebaseConfigured()){
      if(!backendReady||!functions||!firebaseApi?.httpsCallable)throw new Error('Đang kết nối máy chủ, vui lòng thử lại sau vài giây.');
      const fn=firebaseApi.httpsCallable(functions,'updateSystemSettings');
      const response=await fn({settings:next});
      settings=mergeSettings(DEFAULT_SETTINGS,response?.data?.settings||next);
    }else{
      settings={...mergeSettings(DEFAULT_SETTINGS,next),updatedAt:new Date().toISOString(),updatedByName:'Quản trị demo'};
      saveLocalSettings(settings);
    }
    setSaveState('Đã lưu cài đặt.');
    applyBranding();applyStudentControls();renderSettingsPage(true);
  }catch(error){
    console.error(error);setSaveState(error?.message||'Không lưu được cài đặt.',true);
  }finally{setSaving(false);}
}

async function connectFirebase(){
  if(!isFirebaseConfigured())return;
  try{
    const [{getApps,getApp},{getAuth,onAuthStateChanged},{getFirestore,doc,getDoc,onSnapshot},{getFunctions,httpsCallable}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js')
    ]);
    let app=null;
    for(let i=0;i<80;i++){
      if(getApps().length){app=getApp();break;}
      await new Promise(r=>setTimeout(r,100));
    }
    if(!app)throw new Error('Firebase chưa được khởi tạo.');
    const auth=getAuth(app);
    firestore=getFirestore(app);
    functions=getFunctions(app,APP_CONFIG.functionsRegion);
    firebaseApi={doc,getDoc,onSnapshot,httpsCallable};
    onAuthStateChanged(auth,async authUser=>{
      unsubscribeSettings?.();unsubscribeSettings=null;
      backendReady=Boolean(authUser);
      if(!authUser){settings=clone(DEFAULT_SETTINGS);queueEnhance();return;}
      const ref=doc(firestore,'settings','global');
      try{
        const snap=await getDoc(ref);
        settings=mergeSettings(DEFAULT_SETTINGS,snap.exists()?snap.data():{});
      }catch(error){console.warn('Không đọc được cài đặt hệ thống:',error);settings=clone(DEFAULT_SETTINGS);}
      unsubscribeSettings=onSnapshot(ref,snap=>{
        settings=mergeSettings(DEFAULT_SETTINGS,snap.exists()?snap.data():{});
        queueEnhance();
        if(settingsOpen)renderSettingsPage(true);
      },error=>console.warn('Không theo dõi được cài đặt hệ thống:',error));
      queueEnhance();
    });
  }catch(error){
    backendReady=false;
    console.warn('Module cài đặt chưa kết nối được Firebase:',error);
  }
}

document.addEventListener('click',event=>{
  const nativeTab=event.target.closest?.('[data-action="admin-tab"]');
  if(nativeTab)settingsOpen=false;
  const settingsButton=event.target.closest?.('[data-action="g2g-settings"]');
  if(settingsButton){event.preventDefault();settingsOpen=true;renderSettingsPage(true);}
  if(event.target.closest?.('[data-action="logout"]'))settingsOpen=false;
});

const root=document.getElementById('app');
if(root)new MutationObserver(queueEnhance).observe(root,{childList:true,subtree:true});
queueEnhance();
connectFirebase();
