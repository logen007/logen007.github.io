import { APP_CONFIG, isFirebaseConfigured } from './config.js';

const STORAGE_KEY='g2g.exam.system-settings.v2';
const DEFAULT_SETTINGS={
  version:2,
  general:{
    systemName:'Thi thử tiếng Đức',
    organizationName:'G2G Career',
    supportEmail:'admin@g2gcareer.com',
    publicUrl:'https://logen007.github.io/g2g-exam/'
  },
  auth:{googleLoginEnabled:true,allowNewStudents:true},
  exam:{allowRetake:true,allowRestart:true},
  email:{
    enabled:true,
    provider:'firebase_trigger',
    senderName:'G2G Career',
    senderEmail:'admin@g2gcareer.com',
    replyTo:'admin@g2gcareer.com',
    resultSubject:'G2G – Đã có kết quả {exam}',
    resultBody:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nVui lòng đăng nhập hệ thống G2G để xem chi tiết.'
  },
  results:{notifyResultEmail:true,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
  operations:{maintenanceMode:false,maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'}
};

let settings=mergeSettings(DEFAULT_SETTINGS,loadLocalSettings());
let settingsOpen=false;
let renderQueued=false;
let firestore=null;
let functions=null;
let firebaseApi=null;
let unsubscribeSettings=null;
let firebaseReady=false;
let signedInUser=null;

function clone(v){return JSON.parse(JSON.stringify(v));}
function mergeSettings(base,input){
  const src=input&&typeof input==='object'?input:{};
  const legacyResults=src.results||{};
  const emailInput=src.email||{};
  const mergedEmail={...base.email,...emailInput};
  if(!src.email){
    mergedEmail.enabled=legacyResults.notifyResultEmail??base.email.enabled;
    mergedEmail.resultSubject=legacyResults.resultEmailSubject||base.email.resultSubject;
  }
  return {
    ...clone(base),...src,
    general:{...base.general,...(src.general||{})},
    auth:{...base.auth,...(src.auth||{})},
    exam:{...base.exam,...(src.exam||{})},
    email:mergedEmail,
    results:{...base.results,...legacyResults},
    operations:{...base.operations,...(src.operations||{})}
  };
}
function loadLocalSettings(){
  try{
    const v2=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(v2)return v2;
    return JSON.parse(localStorage.getItem('g2g.exam.system-settings.v1')||'null')||{};
  }catch{return {};}
}
function saveLocalSettings(next){localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function isMasterDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Quản trị cấp cao'&&Boolean(document.querySelector('.thanh-ben'));}
function isStudentDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Học viên';}
function isLoginDom(){return Boolean(document.getElementById('googleLogin'));}
function firebaseConfig(){return APP_CONFIG.firebaseConfig()||{};}
function statusBadge(ok,yes='Đã kết nối',no='Chưa cấu hình'){return `<span class="tich-hop-status ${ok?'ok':'off'}">${ok?'●':'○'} ${esc(ok?yes:no)}</span>`;}

function queueEnhance(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;enhance();});
}

function enhance(){
  applyBranding();
  applyLoginControls();
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

function applyLoginControls(){
  if(!isLoginDom())return;
  const button=document.getElementById('googleLogin');
  if(!button)return;
  const enabled=Boolean(settings.auth?.googleLoginEnabled);
  button.disabled=!enabled;
  button.textContent=enabled?'Đăng nhập bằng Google':'Đăng nhập Google đang tắt';
  let note=document.getElementById('googleLoginSettingNote');
  if(!note){note=document.createElement('div');note.id='googleLoginSettingNote';note.className='phu-de';note.style.marginTop='10px';button.insertAdjacentElement('afterend',note);}
  note.textContent=!enabled?'Quản trị viên đang tạm khóa đăng nhập Google.':(!isFirebaseConfigured()?'Chưa kết nối Firebase nên đăng nhập Google chưa hoạt động trên bản này.':'');
  note.style.display=note.textContent?'block':'none';
}

function managedButton(button,disabled,label){
  if(!button)return;
  if(!button.dataset.g2gOriginalText)button.dataset.g2gOriginalText=button.textContent.trim();
  if(disabled){button.disabled=true;button.dataset.g2gManagedDisabled='1';if(label)button.textContent=label;}
  else if(button.dataset.g2gManagedDisabled==='1'){button.disabled=false;button.textContent=button.dataset.g2gOriginalText||button.textContent;delete button.dataset.g2gManagedDisabled;}
}

function applyStudentControls(){
  document.querySelector('[data-g2g-maintenance]')?.remove();
  if(!isStudentDom())return;
  const maintenance=Boolean(settings.operations?.maintenanceMode);
  if(maintenance){
    const header=document.querySelector('.thanh-dau');
    if(header){const el=document.createElement('div');el.className='canh-bao-bao-tri';el.dataset.g2gMaintenance='1';el.textContent=settings.operations?.maintenanceMessage||DEFAULT_SETTINGS.operations.maintenanceMessage;header.insertAdjacentElement('afterend',el);}
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
  if(!button){button=document.createElement('button');button.className='muc-ben';button.dataset.action='g2g-settings';button.textContent='Cài đặt';sidebar.appendChild(button);}
  if(settingsOpen){sidebar.querySelectorAll('.muc-ben').forEach(x=>x.classList.remove('active'));button.classList.add('active');}
}

function settingCard(title,description,body,extraClass=''){return `<section class="the cai-dat-card ${extraClass}"><div class="cai-dat-card-head"><h2>${esc(title)}</h2><p>${esc(description)}</p></div><div class="cai-dat-fields">${body}</div></section>`;}
function textField(id,label,value,help='',type='text',placeholder=''){return `<label class="cai-dat-field"><span>${esc(label)}</span><input class="truong" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">${help?`<small>${esc(help)}</small>`:''}</label>`;}
function textareaField(id,label,value,help=''){return `<label class="cai-dat-field"><span>${esc(label)}</span><textarea class="truong" id="${id}" rows="7">${esc(value)}</textarea>${help?`<small>${esc(help)}</small>`:''}</label>`;}
function toggleField(id,label,checked,help=''){return `<label class="cai-dat-toggle"><input id="${id}" type="checkbox" ${checked?'checked':''}><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span></label>`;}

function renderSettingsPage(force=false){
  const target=document.querySelector('.noi-dung-quan-tri');
  if(!target||!isMasterDom())return;
  if(!force&&target.querySelector('.g2g-settings-page'))return;
  const s=settings,cfg=firebaseConfig();
  const firebaseOk=isFirebaseConfigured()&&firebaseReady;
  const googleOk=isFirebaseConfigured()&&Boolean(s.auth.googleLoginEnabled);
  const emailOk=isFirebaseConfigured()&&Boolean(s.email.enabled)&&s.email.provider==='firebase_trigger';
  target.innerHTML=`<div class="g2g-settings-page">
    <div class="tieu-de-trang"><div><h1>Cài đặt hệ thống</h1><p>Quản lý đăng nhập, email, vận hành và các thiết lập dùng chung. Chỉ Quản trị cấp cao được thay đổi.</p></div><div class="nhom-nut"><button class="nut" id="resetSystemSettings">Khôi phục mặc định</button><button class="nut chinh" id="saveSystemSettings">Lưu cài đặt</button></div></div>

    <div class="tich-hop-tong-quan">
      <div><b>Firebase</b>${statusBadge(firebaseOk,firebaseReady?'Đã kết nối':'Đang kết nối')}</div>
      <div><b>Google Login</b>${statusBadge(googleOk,'Đang bật','Đang tắt / chưa cấu hình')}</div>
      <div><b>Gửi email</b>${statusBadge(emailOk,'Đã bật','Đang tắt / chưa cấu hình')}</div>
      <div><b>Project</b><span class="ma-he-thong">${esc(cfg.projectId||'Chưa có')}</span></div>
    </div>

    <div class="cai-dat-grid">
      ${settingCard('Thông tin hệ thống','Tên hiển thị, đường dẫn và thông tin hỗ trợ.',
        textField('settingSystemName','Tên hệ thống',s.general.systemName,'Hiển thị trên thanh đầu trang.')+
        textField('settingOrganization','Đơn vị vận hành',s.general.organizationName)+
        textField('settingSupportEmail','Email hỗ trợ',s.general.supportEmail,'Địa chỉ học viên liên hệ khi cần hỗ trợ.','email')+
        textField('settingPublicUrl','Địa chỉ truy cập hệ thống',s.general.publicUrl,'Dùng trong email và liên kết quay lại hệ thống.','url'))}

      ${settingCard('Đăng nhập bằng Google','Điều khiển việc học viên sử dụng Google để vào hệ thống.',
        toggleField('settingGoogleLogin','Bật đăng nhập bằng Google',Boolean(s.auth.googleLoginEnabled),'Tắt nút đăng nhập Google trên trang đăng nhập.')+
        toggleField('settingAllowNewStudents','Cho phép học viên mới đăng ký',Boolean(s.auth.allowNewStudents),'Nếu tắt, tài khoản Google chưa từng vào hệ thống sẽ không được tạo hồ sơ mới.')+
        `<div class="tich-hop-info"><div>${statusBadge(isFirebaseConfigured(),'Firebase đã có cấu hình','Chưa có Firebase')}</div><small>Google Provider vẫn phải được bật một lần trong Firebase Authentication. Client ID/Client Secret và khóa bí mật không hiển thị ở đây để tránh lộ thông tin.</small></div>`)}

      ${settingCard('Gửi email kết quả','Thiết lập email gửi tự động sau khi giáo viên công bố kết quả.',
        toggleField('settingEmailEnabled','Gửi email khi công bố kết quả',Boolean(s.email.enabled),'Nếu tắt, học viên vẫn xem được kết quả khi đăng nhập.')+
        `<label class="cai-dat-field"><span>Phương thức gửi</span><select class="truong" id="settingEmailProvider"><option value="firebase_trigger" ${s.email.provider==='firebase_trigger'?'selected':''}>Firebase Email Extension</option></select><small>SMTP/API key được lưu ở Firebase/Secret Manager, không lưu trong trình duyệt hoặc Firestore.</small></label>`+
        textField('settingSenderName','Tên người gửi',s.email.senderName)+
        textField('settingSenderEmail','Email người gửi',s.email.senderEmail,'Nên dùng email thuộc tên miền G2G.','email')+
        textField('settingReplyTo','Email nhận phản hồi',s.email.replyTo,'Học viên trả lời email sẽ gửi về địa chỉ này.','email')+
        textField('settingEmailSubject','Tiêu đề email',s.email.resultSubject,'Biến dùng được: {student}, {exam}, {score}, {result}.')+
        textareaField('settingEmailBody','Nội dung email',s.email.resultBody,'Biến dùng được: {student}, {exam}, {score}, {result}.')+
        `<div class="email-test"><input class="truong" id="settingTestEmail" type="email" value="${esc(signedInUser?.email||s.general.supportEmail||'')}" placeholder="Email nhận thử"><button class="nut" id="sendTestEmail">Gửi email thử</button></div><small class="phu-de" id="testEmailState"></small>`)}

      ${settingCard('Quyền làm bài','Kiểm soát việc học viên thi lại hoặc bỏ lượt đang làm để bắt đầu lại.',
        toggleField('settingAllowRetake','Cho phép thi lại',Boolean(s.exam.allowRetake),'Học viên có thể làm cùng một đề nhiều lần.')+
        toggleField('settingAllowRestart','Cho phép bỏ lượt và làm lại từ đầu',Boolean(s.exam.allowRestart),'Lượt cũ được giữ ở trạng thái bỏ dở.'))}

      ${settingCard('Vận hành / bảo trì','Khóa việc bắt đầu lượt thi mới trong lúc bảo trì. Lượt đang làm vẫn có thể tiếp tục.',
        toggleField('settingMaintenance','Bật chế độ bảo trì',Boolean(s.operations.maintenanceMode),'Học viên không thể bắt đầu hoặc làm lại lượt thi mới.')+
        textareaField('settingMaintenanceMessage','Thông báo bảo trì',s.operations.maintenanceMessage,'Thông báo hiển thị ở khu vực học viên.'))}

      ${settingCard('Kết nối hạ tầng','Trạng thái các dịch vụ nền tảng. Những khóa bí mật phải cấu hình ở môi trường máy chủ.',
        `<div class="dong-tich-hop"><div><b>Firebase Project</b><small>${esc(cfg.projectId||'Chưa cấu hình')}</small></div>${statusBadge(isFirebaseConfigured(),'Có cấu hình','Chưa cấu hình')}</div>
         <div class="dong-tich-hop"><div><b>Authentication</b><small>Google Sign-In</small></div>${statusBadge(googleOk,'Đang bật','Đang tắt')}</div>
         <div class="dong-tich-hop"><div><b>Firestore</b><small>Dữ liệu tài khoản, đề thi, kết quả</small></div>${statusBadge(firebaseReady,'Đã kết nối','Chưa kết nối')}</div>
         <div class="dong-tich-hop"><div><b>Cloud Functions</b><small>Chấm điểm, công bố kết quả, email</small></div>${statusBadge(firebaseReady,'Sẵn sàng','Chưa kết nối')}</div>
         <div class="dong-tich-hop"><div><b>Email Extension</b><small>Hàng đợi collection “mail”</small></div>${statusBadge(emailOk,'Đang sử dụng','Chưa bật')}</div>
         <div class="ghi-chu-bao-mat"><b>Thông tin không đặt trong trang Cài đặt:</b><br>Google Client Secret, SMTP password, Resend/SendGrid API key và Firebase service account. Các giá trị này phải nằm trong Firebase Secret Manager / cấu hình triển khai để giáo viên hoặc trình duyệt không bao giờ đọc được.</div>`, 'cai-dat-card-rong')}
    </div>

    <div class="cai-dat-footer"><span id="settingsSaveState" class="phu-de">${s.updatedAt?`Cập nhật gần nhất: ${esc(formatDate(s.updatedAt))}`:'Chưa có thay đổi được lưu trên máy chủ.'}</span><button class="nut chinh" id="saveSystemSettingsBottom">Lưu cài đặt</button></div>
  </div>`;
  injectSettingsTab();
  const save=()=>saveSettingsFromForm();
  document.getElementById('saveSystemSettings')?.addEventListener('click',save);
  document.getElementById('saveSystemSettingsBottom')?.addEventListener('click',save);
  document.getElementById('resetSystemSettings')?.addEventListener('click',async()=>{if(!confirm('Khôi phục toàn bộ cài đặt về mặc định?'))return;await persistSettings(clone(DEFAULT_SETTINGS));});
  document.getElementById('sendTestEmail')?.addEventListener('click',sendTestEmail);
}

function formatDate(v){try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return '—';}}
function value(id){return document.getElementById(id)?.value?.trim()||'';}
function checked(id){return Boolean(document.getElementById(id)?.checked);}
function validEmail(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}

async function saveSettingsFromForm(){
  const next={
    version:2,
    general:{systemName:value('settingSystemName'),organizationName:value('settingOrganization'),supportEmail:value('settingSupportEmail'),publicUrl:value('settingPublicUrl')},
    auth:{googleLoginEnabled:checked('settingGoogleLogin'),allowNewStudents:checked('settingAllowNewStudents')},
    exam:{allowRetake:checked('settingAllowRetake'),allowRestart:checked('settingAllowRestart')},
    email:{enabled:checked('settingEmailEnabled'),provider:value('settingEmailProvider')||'firebase_trigger',senderName:value('settingSenderName'),senderEmail:value('settingSenderEmail'),replyTo:value('settingReplyTo'),resultSubject:value('settingEmailSubject'),resultBody:value('settingEmailBody')},
    results:{notifyResultEmail:checked('settingEmailEnabled'),resultEmailSubject:value('settingEmailSubject')},
    operations:{maintenanceMode:checked('settingMaintenance'),maintenanceMessage:value('settingMaintenanceMessage')}
  };
  if(!next.general.systemName)return setSaveState('Tên hệ thống không được để trống.',true);
  if(!validEmail(next.general.supportEmail))return setSaveState('Email hỗ trợ không hợp lệ.',true);
  if(!/^https?:\/\//i.test(next.general.publicUrl))return setSaveState('Địa chỉ hệ thống phải bắt đầu bằng http:// hoặc https://.',true);
  if(!next.email.senderName)return setSaveState('Tên người gửi không được để trống.',true);
  if(!validEmail(next.email.senderEmail)||!validEmail(next.email.replyTo))return setSaveState('Email người gửi hoặc email phản hồi không hợp lệ.',true);
  if(!next.email.resultSubject||!next.email.resultBody)return setSaveState('Tiêu đề và nội dung email không được để trống.',true);
  if(!next.operations.maintenanceMessage)return setSaveState('Thông báo bảo trì không được để trống.',true);
  await persistSettings(next);
}

function setSaveState(text,error=false){const el=document.getElementById('settingsSaveState');if(el){el.textContent=text;el.classList.toggle('loi',Boolean(error));}}
function setSaving(disabled){['saveSystemSettings','saveSystemSettingsBottom','resetSystemSettings','sendTestEmail'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=disabled;});}

async function persistSettings(next){
  try{
    setSaving(true);setSaveState('Đang lưu...');
    if(isFirebaseConfigured()){
      if(!firebaseReady||!functions||!firebaseApi?.httpsCallable)throw new Error('Đang kết nối máy chủ, vui lòng thử lại sau vài giây.');
      const fn=firebaseApi.httpsCallable(functions,'updateSystemSettings');
      const response=await fn({settings:next});settings=mergeSettings(DEFAULT_SETTINGS,response?.data?.settings||next);
    }else{
      settings={...mergeSettings(DEFAULT_SETTINGS,next),updatedAt:new Date().toISOString(),updatedByName:'Quản trị demo'};saveLocalSettings(settings);
    }
    setSaveState('Đã lưu cài đặt.');applyBranding();applyLoginControls();applyStudentControls();renderSettingsPage(true);
  }catch(error){console.error(error);setSaveState(error?.message||'Không lưu được cài đặt.',true);}
  finally{setSaving(false);}
}

async function sendTestEmail(){
  const to=value('settingTestEmail');const state=document.getElementById('testEmailState');
  if(!validEmail(to)||!to){if(state)state.textContent='Email nhận thử không hợp lệ.';return;}
  if(!isFirebaseConfigured()||!firebaseReady||!functions){if(state)state.textContent='Chưa kết nối Firebase nên chưa thể gửi email thật.';return;}
  try{
    const btn=document.getElementById('sendTestEmail');if(btn)btn.disabled=true;if(state)state.textContent='Đang đưa email vào hàng đợi...';
    const fn=firebaseApi.httpsCallable(functions,'sendTestEmail');const response=await fn({to});
    if(state)state.textContent=response?.data?.queued?`Đã đưa email thử vào hàng đợi gửi tới ${to}.`:'Không tạo được email thử.';
  }catch(error){console.error(error);if(state)state.textContent=error?.message||'Không gửi được email thử.';}
  finally{const btn=document.getElementById('sendTestEmail');if(btn)btn.disabled=false;}
}

async function connectFirebase(){
  if(!isFirebaseConfigured()){firebaseReady=false;queueEnhance();return;}
  try{
    const [{getApps,getApp},{getAuth,onAuthStateChanged},{getFirestore,doc,getDoc,onSnapshot},{getFunctions,httpsCallable}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js')
    ]);
    let fbApp=null;
    for(let i=0;i<80;i++){if(getApps().length){fbApp=getApp();break;}await new Promise(r=>setTimeout(r,100));}
    if(!fbApp)throw new Error('Firebase chưa được khởi tạo.');
    const auth=getAuth(fbApp);firestore=getFirestore(fbApp);functions=getFunctions(fbApp,APP_CONFIG.functionsRegion);firebaseApi={doc,getDoc,onSnapshot,httpsCallable};
    const ref=doc(firestore,'settings','global');
    try{const snap=await getDoc(ref);settings=mergeSettings(DEFAULT_SETTINGS,snap.exists()?snap.data():{});firebaseReady=true;}catch(error){console.warn('Không đọc được cài đặt hệ thống:',error);firebaseReady=false;}
    unsubscribeSettings?.();
    if(firebaseReady){unsubscribeSettings=onSnapshot(ref,snap=>{settings=mergeSettings(DEFAULT_SETTINGS,snap.exists()?snap.data():{});queueEnhance();if(settingsOpen)setTimeout(()=>renderSettingsPage(true),0);},error=>console.warn('Không theo dõi được cài đặt hệ thống:',error));}
    onAuthStateChanged(auth,user=>{signedInUser=user||null;queueEnhance();if(settingsOpen)setTimeout(()=>renderSettingsPage(true),0);});
    queueEnhance();
  }catch(error){firebaseReady=false;console.warn('Module cài đặt chưa kết nối được Firebase:',error);queueEnhance();}
}

document.addEventListener('click',event=>{
  const nativeTab=event.target.closest?.('[data-action="admin-tab"]');if(nativeTab)settingsOpen=false;
  const settingsButton=event.target.closest?.('[data-action="g2g-settings"]');
  if(settingsButton){event.preventDefault();event.stopPropagation();settingsOpen=true;renderSettingsPage(true);}
});

const appRoot=document.getElementById('app');
if(appRoot)new MutationObserver(()=>queueEnhance()).observe(appRoot,{childList:true,subtree:true});
queueEnhance();
connectFirebase();
