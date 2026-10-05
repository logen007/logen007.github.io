import { APP_CONFIG, isFirebaseConfigured } from './config.js';

const STORAGE_KEY='g2g.exam.system-settings.v3';
const DEFAULT_SETTINGS={
  version:3,
  general:{systemName:'Thi thử tiếng Đức',organizationName:'G2G Career',supportEmail:'admin@g2gcareer.com',publicUrl:'https://logen007.github.io/g2g-exam/'},
  auth:{googleLoginEnabled:true,allowNewStudents:true,allowedDomain:''},
  exam:{allowRetake:true,allowRestart:true},
  smtp:{enabled:false,host:'',port:587,security:'starttls',username:'',fromName:'G2G Career',fromEmail:'admin@g2gcareer.com',replyTo:'admin@g2gcareer.com',timeoutMs:20000,rejectUnauthorized:true},
  email:{enabled:false,resultSubject:'G2G – Đã có kết quả {exam}',resultText:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nXem chi tiết: {url}',resultHtml:'<p>Xin chào <strong>{student}</strong>,</p><p>Kết quả bài thi <strong>{exam}</strong> của bạn đã được công bố.</p><p>Điểm: <strong>{score}</strong><br>Kết quả: <strong>{result}</strong></p><p><a href="{url}">Đăng nhập hệ thống G2G để xem chi tiết</a></p>'},
  results:{notifyResultEmail:false,resultEmailSubject:'G2G – Đã có kết quả {exam}'},
  operations:{maintenanceMode:false,maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'}
};

let settings=mergeSettings(DEFAULT_SETTINGS,loadLocalSettings());
let publicSettings={general:{...settings.general},auth:{...settings.auth},operations:{...settings.operations}};
let settingsOpen=false;
let renderQueued=false;
let firestore=null,functions=null,auth=null,firebaseApi=null;
let unsubscribePrivate=null,unsubscribePublic=null;
let signedInUser=null;
let infrastructure=null;

function clone(v){return JSON.parse(JSON.stringify(v));}
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function mergeSettings(base,input){
  const src=input&&typeof input==='object'?input:{};
  const legacy=src.results||{};
  const email={...base.email,...(src.email||{})};
  if(!src.email){email.enabled=legacy.notifyResultEmail??base.email.enabled;email.resultSubject=legacy.resultEmailSubject||base.email.resultSubject;}
  return {
    ...clone(base),...src,
    general:{...base.general,...(src.general||{})},
    auth:{...base.auth,...(src.auth||{})},
    exam:{...base.exam,...(src.exam||{})},
    smtp:{...base.smtp,...(src.smtp||{})},
    email,
    results:{...base.results,...legacy},
    operations:{...base.operations,...(src.operations||{})}
  };
}
function loadLocalSettings(){
  try{
    for(const key of [STORAGE_KEY,'g2g.exam.system-settings.v2','g2g.exam.system-settings.v1']){
      const value=JSON.parse(localStorage.getItem(key)||'null');if(value)return value;
    }
  }catch{}
  return {};
}
function saveLocalSettings(next){localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
function isMasterDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Quản trị cấp cao'&&Boolean(document.querySelector('.thanh-ben'));}
function isStudentDom(){return document.querySelector('.thanh-dau .nhan')?.textContent?.trim()==='Học viên';}
function statusBadge(ok,yes='Hoạt động',no='Chưa cấu hình'){return `<span class="tich-hop-status ${ok?'ok':'off'}">${ok?'●':'○'} ${esc(ok?yes:no)}</span>`;}
function formatDate(v){try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return '—';}}
function queueEnhance(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;enhance();});}

function enhance(){
  applyBranding();applyLoginControls();applyStudentControls();injectSettingsTab();
  if(settingsOpen&&isMasterDom())renderSettingsPage(false);
  if(settingsOpen&&!isMasterDom())settingsOpen=false;
}
function applyBranding(){
  const name=String((signedInUser?settings:publicSettings).general?.systemName||DEFAULT_SETTINGS.general.systemName).trim();
  const header=document.querySelector('.ten-he-thong strong');if(header&&header.textContent!==name)header.textContent=name;
  const examHeader=document.querySelector('.thanh-thi strong');if(examHeader&&examHeader.textContent!==`G2G · ${name}`)examHeader.textContent=`G2G · ${name}`;
  document.title=`${name} · G2G`;
}
function applyLoginControls(){
  const button=document.getElementById('googleLogin');if(!button)return;
  const enabled=publicSettings.auth?.googleLoginEnabled!==false;
  button.disabled=!enabled;
  button.textContent=enabled?'Đăng nhập bằng Google':'Đăng nhập Google đang tạm tắt';
  let note=document.getElementById('googleLoginSettingNote');
  if(!note){note=document.createElement('div');note.id='googleLoginSettingNote';note.className='phu-de';note.style.marginTop='10px';button.insertAdjacentElement('afterend',note);}
  note.textContent=!enabled?'Quản trị viên đang tạm khóa đăng nhập Google.':(!isFirebaseConfigured()?'Chưa cấu hình Firebase nên đăng nhập Google chưa hoạt động.':'');
  note.style.display=note.textContent?'block':'none';
}
function managedButton(button,disabled,label){
  if(!button)return;if(!button.dataset.g2gOriginalText)button.dataset.g2gOriginalText=button.textContent.trim();
  if(disabled){button.disabled=true;button.dataset.g2gManagedDisabled='1';if(label)button.textContent=label;}
  else if(button.dataset.g2gManagedDisabled==='1'){button.disabled=false;button.textContent=button.dataset.g2gOriginalText||button.textContent;delete button.dataset.g2gManagedDisabled;}
}
function applyStudentControls(){
  document.querySelector('[data-g2g-maintenance]')?.remove();if(!isStudentDom())return;
  const maintenance=Boolean(settings.operations?.maintenanceMode);
  if(maintenance){const header=document.querySelector('.thanh-dau');if(header){const el=document.createElement('div');el.className='canh-bao-bao-tri';el.dataset.g2gMaintenance='1';el.textContent=settings.operations?.maintenanceMessage||DEFAULT_SETTINGS.operations.maintenanceMessage;header.insertAdjacentElement('afterend',el);}}
  document.querySelectorAll('[data-action="start"]').forEach(button=>{const original=button.dataset.g2gOriginalText||button.textContent.trim(),retake=original==='Thi lại';if(maintenance)managedButton(button,true,'Tạm khóa');else if(retake&&!settings.exam?.allowRetake)managedButton(button,true,'Không cho thi lại');else managedButton(button,false);});
  document.querySelectorAll('[data-action="restart"]').forEach(button=>{if(maintenance)managedButton(button,true,'Tạm khóa');else if(!settings.exam?.allowRestart)managedButton(button,true,'Không cho làm lại');else managedButton(button,false);});
}
function injectSettingsTab(){
  const sidebar=document.querySelector('.thanh-ben');if(!sidebar||!isMasterDom())return;
  let button=sidebar.querySelector('[data-action="g2g-settings"]');
  if(!button){button=document.createElement('button');button.className='muc-ben';button.dataset.action='g2g-settings';button.textContent='Cài đặt';sidebar.appendChild(button);}
  if(settingsOpen){sidebar.querySelectorAll('.muc-ben').forEach(x=>x.classList.remove('active'));button.classList.add('active');}
}

function card(title,description,body,extra=''){return `<section class="the cai-dat-card ${extra}"><div class="cai-dat-card-head"><h2>${esc(title)}</h2><p>${esc(description)}</p></div><div class="cai-dat-fields">${body}</div></section>`;}
function field(id,label,value,help='',type='text',placeholder=''){return `<label class="cai-dat-field"><span>${esc(label)}</span><input class="truong" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">${help?`<small>${esc(help)}</small>`:''}</label>`;}
function area(id,label,value,help='',rows=6){return `<label class="cai-dat-field"><span>${esc(label)}</span><textarea class="truong" id="${id}" rows="${rows}">${esc(value)}</textarea>${help?`<small>${esc(help)}</small>`:''}</label>`;}
function toggle(id,label,checked,help=''){return `<label class="cai-dat-toggle"><input id="${id}" type="checkbox" ${checked?'checked':''}><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span></label>`;}
function selectField(id,label,value,items,help=''){return `<label class="cai-dat-field"><span>${esc(label)}</span><select class="truong" id="${id}">${items.map(([v,t])=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(t)}</option>`).join('')}</select>${help?`<small>${esc(help)}</small>`:''}</label>`;}

function renderSettingsPage(force=false){
  const target=document.querySelector('.noi-dung-quan-tri');if(!target||!isMasterDom())return;
  if(!force&&target.querySelector('.g2g-settings-page'))return;
  const s=settings,cfg=APP_CONFIG.firebaseConfig()||{},smtpStatus=infrastructure?.smtp||{};
  target.innerHTML=`<div class="g2g-settings-page">
    <div class="tieu-de-trang"><div><h1>Cài đặt hệ thống</h1><p>Quản lý đăng nhập, SMTP, email, thi cử và vận hành. Chỉ Quản trị cấp cao được thay đổi.</p></div><div class="nhom-nut"><button class="nut" id="refreshInfrastructure">Kiểm tra kết nối</button><button class="nut chinh" id="saveSystemSettings">Lưu cài đặt</button></div></div>
    <div class="tich-hop-tong-quan">
      <div><b>Dự án Firebase</b>${statusBadge(isFirebaseConfigured(),cfg.projectId||'Đã cấu hình','Chưa cấu hình')}</div>
      <div><b>Đăng nhập Google</b>${statusBadge(Boolean(s.auth.googleLoginEnabled),'Đang bật','Đang tắt')}</div>
      <div><b>Máy chủ gửi thư</b>${statusBadge(Boolean(smtpStatus.configured),'Sẵn sàng','Chưa sẵn sàng')}</div>
      <div><b>Mật khẩu SMTP</b>${statusBadge(Boolean(smtpStatus.secretConfigured),'Đã lưu an toàn','Chưa có')}</div>
    </div>
    <div class="cai-dat-grid">
      ${card('Thông tin hệ thống','Tên hiển thị, đơn vị vận hành và địa chỉ truy cập.',
        field('settingSystemName','Tên hệ thống',s.general.systemName)+field('settingOrganization','Đơn vị vận hành',s.general.organizationName)+field('settingSupportEmail','Email hỗ trợ',s.general.supportEmail,'','email')+field('settingPublicUrl','Địa chỉ truy cập hệ thống',s.general.publicUrl,'Được chèn vào email kết quả.','url'))}

      ${card('Đăng nhập Google','Điều khiển việc học viên đăng nhập và tự tạo hồ sơ.',
        toggle('settingGoogleLogin','Bật đăng nhập bằng Google',Boolean(s.auth.googleLoginEnabled),'Firebase Authentication vẫn phải bật nhà cung cấp Google một lần.')+
        toggle('settingAllowNewStudents','Cho phép học viên mới tự đăng ký',Boolean(s.auth.allowNewStudents),'Tắt mục này nếu chỉ muốn cho các tài khoản đã có sẵn đăng nhập.')+
        field('settingAllowedDomain','Chỉ cho phép tên miền email',s.auth.allowedDomain,'Để trống nếu chấp nhận mọi Gmail/Google Workspace. Ví dụ: g2gcareer.com','','g2gcareer.com')+
        `<div class="tich-hop-info"><b>Trạng thái</b><span>${isFirebaseConfigured()?'Đã có cấu hình Firebase phía trình duyệt.':'Chưa có cấu hình Firebase thật.'}</span></div>`)}

      ${card('Máy chủ gửi thư SMTP','Thông tin kết nối dịch vụ SMTP riêng của anh. Mật khẩu không bao giờ lưu trong Firestore hoặc mã nguồn.',
        toggle('settingSmtpEnabled','Bật gửi thư qua SMTP',Boolean(s.smtp.enabled),'Chỉ bật sau khi điền đủ thông tin và thử gửi thành công.')+
        field('settingSmtpHost','Máy chủ SMTP',s.smtp.host,'Ví dụ: smtp.example.com','','smtp.example.com')+
        field('settingSmtpPort','Cổng',s.smtp.port,'Thường là 465 cho SSL hoặc 587 cho STARTTLS.','number')+
        selectField('settingSmtpSecurity','Bảo mật kết nối',s.smtp.security,[['ssl','SSL/TLS trực tiếp'],['starttls','STARTTLS'],['none','Không mã hóa']], 'Nên dùng SSL/TLS hoặc STARTTLS.')+
        field('settingSmtpUsername','Tên đăng nhập SMTP',s.smtp.username,'Có thể là địa chỉ email hoặc username do nhà cung cấp cấp.')+
        `<label class="cai-dat-field"><span>Mật khẩu / khóa SMTP</span><div class="secret-row"><input class="truong" id="settingSmtpPassword" type="password" value="" autocomplete="new-password" placeholder="Nhập để cập nhật, để trống để giữ nguyên"><button class="nut" id="saveSmtpSecret" type="button">Cập nhật mật khẩu</button></div><small>Mật khẩu chỉ được gửi qua kết nối HTTPS tới Cloud Function và lưu ở Google Secret Manager. Trang này không đọc lại được mật khẩu.</small></label>`+
        field('settingSmtpFromName','Tên người gửi',s.smtp.fromName)+field('settingSmtpFromEmail','Email người gửi',s.smtp.fromEmail,'','email')+field('settingSmtpReplyTo','Email nhận phản hồi',s.smtp.replyTo,'','email')+
        field('settingSmtpTimeout','Thời gian chờ tối đa (ms)',s.smtp.timeoutMs,'Từ 3000 đến 120000 mili giây.','number')+
        toggle('settingSmtpVerifyCertificate','Kiểm tra chứng chỉ TLS',Boolean(s.smtp.rejectUnauthorized),'Nên bật. Chỉ tắt khi dùng SMTP nội bộ có chứng chỉ tự ký.')+
        `<div class="secret-status"><b>Mật khẩu:</b> ${smtpStatus.secretConfigured?'Đã cấu hình trong Secret Manager':'Chưa cấu hình'}${smtpStatus.secretVersion?` · phiên bản ${esc(smtpStatus.secretVersion)}`:''}</div>`,'cai-dat-wide')}

      ${card('Email kết quả','Mẫu thư gửi sau khi giáo viên công bố kết quả.',
        toggle('settingEmailEnabled','Gửi email khi công bố kết quả',Boolean(s.email.enabled),'Nếu gửi SMTP lỗi, kết quả vẫn được công bố và hệ thống ghi trạng thái lỗi để có thể gửi lại.')+
        field('settingEmailSubject','Tiêu đề email',s.email.resultSubject,'Biến dùng được: {student}, {exam}, {score}, {result}, {url}.')+
        area('settingEmailText','Nội dung dạng văn bản',s.email.resultText,'Dùng khi ứng dụng email không hiển thị HTML.',7)+
        area('settingEmailHtml','Nội dung HTML',s.email.resultHtml,'Có thể dùng HTML cơ bản và các biến {student}, {exam}, {score}, {result}, {url}.',9)+
        `<div class="email-test"><input class="truong" id="settingTestEmail" type="email" value="${esc(signedInUser?.email||s.general.supportEmail||'')}" placeholder="Email nhận thử"><button class="nut" id="testSmtp" type="button">Gửi email thử</button></div><small id="testEmailState" class="phu-de"></small>`,'cai-dat-wide')}

      ${card('Quyền làm bài','Thiết lập chung cho học viên.',toggle('settingAllowRetake','Cho phép thi lại',Boolean(s.exam.allowRetake),'Học viên có thể làm cùng một đề nhiều lần.')+toggle('settingAllowRestart','Cho phép bỏ lượt và làm lại từ đầu',Boolean(s.exam.allowRestart),'Lượt cũ vẫn được lưu là bỏ dở.'))}

      ${card('Vận hành và bảo trì','Tạm khóa việc bắt đầu lượt mới khi cần bảo trì.',toggle('settingMaintenance','Bật chế độ bảo trì',Boolean(s.operations.maintenanceMode),'Lượt đang làm vẫn được phép tiếp tục.')+area('settingMaintenanceMessage','Thông báo bảo trì',s.operations.maintenanceMessage,'Hiển thị ở khu vực học viên.',4))}

      ${card('Kết nối hạ tầng','Kiểm tra nhanh các thành phần cần cho bản vận hành thật.',
        `<div class="infra-list"><div><span>Dự án Firebase</span><b>${esc(infrastructure?.firebaseProject||cfg.projectId||'Chưa cấu hình')}</b></div><div><span>Firestore</span><b>${infrastructure?.firestore?'Hoạt động':'Chưa xác nhận'}</b></div><div><span>Cloud Functions</span><b>${infrastructure?.functions?'Hoạt động':'Chưa xác nhận'}</b></div><div><span>Vùng máy chủ</span><b>${esc(infrastructure?.functionsRegion||APP_CONFIG.functionsRegion)}</b></div><div><span>SMTP Host</span><b>${smtpStatus.hostConfigured?'Đã có':'Chưa có'}</b></div><div><span>Mật khẩu SMTP</span><b>${smtpStatus.secretConfigured?'Đã có':'Chưa có'}</b></div></div><small>Nếu Secret Manager báo thiếu quyền, cần cấp quyền quản lý phiên bản secret cho tài khoản dịch vụ của Cloud Functions một lần khi triển khai Blaze.</small>`)}
    </div>
    <div class="cai-dat-footer"><span id="settingsSaveState" class="phu-de">${s.updatedAt?`Cập nhật gần nhất: ${esc(formatDate(s.updatedAt))}`:'Chưa lưu thay đổi.'}</span><div class="nhom-nut"><button class="nut" id="resetSystemSettings">Khôi phục mặc định</button><button class="nut chinh" id="saveSystemSettingsBottom">Lưu cài đặt</button></div></div>
  </div>`;
  injectSettingsTab();bindSettingsActions();
}

function value(id){return document.getElementById(id)?.value?.trim()||'';}
function checked(id){return Boolean(document.getElementById(id)?.checked);}
function numberValue(id,fallback){const n=Number(document.getElementById(id)?.value);return Number.isFinite(n)?n:fallback;}
function setState(text,error=false){const el=document.getElementById('settingsSaveState');if(el){el.textContent=text;el.classList.toggle('loi',Boolean(error));}}
function setBusy(busy){['saveSystemSettings','saveSystemSettingsBottom','resetSystemSettings','saveSmtpSecret','testSmtp','refreshInfrastructure'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=busy;});}
function formSettings(){
  return {
    version:3,
    general:{systemName:value('settingSystemName'),organizationName:value('settingOrganization'),supportEmail:value('settingSupportEmail'),publicUrl:value('settingPublicUrl')},
    auth:{googleLoginEnabled:checked('settingGoogleLogin'),allowNewStudents:checked('settingAllowNewStudents'),allowedDomain:value('settingAllowedDomain').replace(/^@/,'').toLowerCase()},
    exam:{allowRetake:checked('settingAllowRetake'),allowRestart:checked('settingAllowRestart')},
    smtp:{enabled:checked('settingSmtpEnabled'),host:value('settingSmtpHost'),port:numberValue('settingSmtpPort',587),security:value('settingSmtpSecurity'),username:value('settingSmtpUsername'),fromName:value('settingSmtpFromName'),fromEmail:value('settingSmtpFromEmail'),replyTo:value('settingSmtpReplyTo'),timeoutMs:numberValue('settingSmtpTimeout',20000),rejectUnauthorized:checked('settingSmtpVerifyCertificate')},
    email:{enabled:checked('settingEmailEnabled'),resultSubject:value('settingEmailSubject'),resultText:document.getElementById('settingEmailText')?.value||'',resultHtml:document.getElementById('settingEmailHtml')?.value||''},
    results:{notifyResultEmail:checked('settingEmailEnabled'),resultEmailSubject:value('settingEmailSubject')},
    operations:{maintenanceMode:checked('settingMaintenance'),maintenanceMessage:value('settingMaintenanceMessage')}
  };
}
function validate(next){
  if(!next.general.systemName)return'Tên hệ thống không được để trống.';
  if(next.general.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.general.supportEmail))return'Email hỗ trợ không hợp lệ.';
  if(!/^https?:\/\//i.test(next.general.publicUrl))return'Địa chỉ hệ thống phải bắt đầu bằng http:// hoặc https://.';
  if(next.auth.allowedDomain&&!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(next.auth.allowedDomain))return'Tên miền email được phép không hợp lệ.';
  if(next.smtp.enabled&&!next.smtp.host)return'Anh cần điền máy chủ SMTP trước khi bật SMTP.';
  if(next.smtp.port<1||next.smtp.port>65535)return'Cổng SMTP không hợp lệ.';
  if(!next.smtp.fromEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.smtp.fromEmail))return'Email người gửi không hợp lệ.';
  if(next.smtp.replyTo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.smtp.replyTo))return'Email nhận phản hồi không hợp lệ.';
  if(next.smtp.timeoutMs<3000||next.smtp.timeoutMs>120000)return'Thời gian chờ SMTP phải từ 3000 đến 120000 ms.';
  if(!next.email.resultSubject)return'Tiêu đề email không được để trống.';
  if(!next.email.resultText&&!next.email.resultHtml)return'Cần ít nhất một mẫu nội dung email.';
  if(!next.operations.maintenanceMessage)return'Thông báo bảo trì không được để trống.';
  return'';
}
async function callFunction(name,payload={}){if(!firebaseApi?.httpsCallable||!functions)throw new Error('Chưa kết nối Cloud Functions.');const fn=firebaseApi.httpsCallable(functions,name);const result=await fn(payload);return result?.data;}
async function saveAll(){
  const next=formSettings(),error=validate(next);if(error){setState(error,true);return;}
  try{
    setBusy(true);setState('Đang lưu cài đặt...');
    if(isFirebaseConfigured()){
      const result=await callFunction('updateSystemSettings',{settings:next});settings=mergeSettings(DEFAULT_SETTINGS,result?.settings||next);
      const password=document.getElementById('settingSmtpPassword')?.value||'';
      if(password){setState('Đang lưu mật khẩu SMTP an toàn...');await callFunction('updateSmtpSecret',{password});}
      await refreshInfrastructure(false);
    }else{
      settings={...mergeSettings(DEFAULT_SETTINGS,next),updatedAt:new Date().toISOString(),updatedByName:'Quản trị demo'};saveLocalSettings(settings);
    }
    setState('Đã lưu cài đặt.');applyBranding();applyStudentControls();renderSettingsPage(true);
  }catch(error){console.error(error);setState(error?.message||'Không lưu được cài đặt.',true);}finally{setBusy(false);}
}
async function saveSecretOnly(){
  const password=document.getElementById('settingSmtpPassword')?.value||'';
  if(!password){setState('Hãy nhập mật khẩu hoặc khóa SMTP mới.',true);return;}
  if(!isFirebaseConfigured()){setState('Bản thử nghiệm không lưu mật khẩu SMTP. Hãy kết nối Firebase Blaze trước.',true);return;}
  try{setBusy(true);setState('Đang lưu mật khẩu vào Secret Manager...');await callFunction('updateSmtpSecret',{password});document.getElementById('settingSmtpPassword').value='';await refreshInfrastructure(false);setState('Đã cập nhật mật khẩu SMTP an toàn.');renderSettingsPage(true);}catch(error){setState(error?.message||'Không cập nhật được mật khẩu SMTP.',true);}finally{setBusy(false);}
}
async function testSmtp(){
  const to=value('settingTestEmail');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){setState('Email nhận thử không hợp lệ.',true);return;}
  if(!isFirebaseConfigured()){setState('Chưa kết nối Firebase/Cloud Functions nên chưa thể gửi thử.',true);return;}
  try{setBusy(true);setState('Đang gửi email thử...');const result=await callFunction('testSmtp',{to});setState(result?.ok?'Đã gửi email thử thành công.':'Đã gửi yêu cầu thử SMTP.');}catch(error){setState(error?.message||'Gửi email thử thất bại.',true);}finally{setBusy(false);}
}
async function refreshInfrastructure(render=true){
  if(!isFirebaseConfigured()||!signedInUser){infrastructure=null;if(render&&settingsOpen)renderSettingsPage(true);return;}
  try{infrastructure=await callFunction('getInfrastructureStatus',{});}catch(error){infrastructure={error:error?.message||'Không kiểm tra được kết nối.'};}
  if(render&&settingsOpen)renderSettingsPage(true);
}
function bindSettingsActions(){
  document.getElementById('saveSystemSettings')?.addEventListener('click',saveAll);document.getElementById('saveSystemSettingsBottom')?.addEventListener('click',saveAll);
  document.getElementById('saveSmtpSecret')?.addEventListener('click',saveSecretOnly);document.getElementById('testSmtp')?.addEventListener('click',testSmtp);document.getElementById('refreshInfrastructure')?.addEventListener('click',()=>refreshInfrastructure(true));
  document.getElementById('resetSystemSettings')?.addEventListener('click',async()=>{if(!confirm('Khôi phục cài đặt không bí mật về mặc định? Mật khẩu SMTP trong Secret Manager sẽ không bị xóa.'))return;settings=clone(DEFAULT_SETTINGS);renderSettingsPage(true);setState('Đã đưa biểu mẫu về mặc định. Bấm Lưu cài đặt để áp dụng.');});
}

async function connectFirebase(){
  if(!isFirebaseConfigured()){queueEnhance();return;}
  try{
    const [{getApps,getApp},{getAuth,onAuthStateChanged},{getFirestore,doc,getDoc,onSnapshot},{getFunctions,httpsCallable}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js')
    ]);
    let app=null;for(let i=0;i<100;i++){if(getApps().length){app=getApp();break;}await new Promise(r=>setTimeout(r,100));}
    if(!app)throw new Error('Firebase chưa được khởi tạo.');
    auth=getAuth(app);firestore=getFirestore(app);functions=getFunctions(app,APP_CONFIG.functionsRegion);firebaseApi={doc,getDoc,onSnapshot,httpsCallable};
    const pubRef=doc(firestore,'publicSettings','global');
    try{const snap=await getDoc(pubRef);if(snap.exists())publicSettings={...publicSettings,...snap.data(),general:{...publicSettings.general,...(snap.data().general||{})},auth:{...publicSettings.auth,...(snap.data().auth||{})},operations:{...publicSettings.operations,...(snap.data().operations||{})}};}catch{}
    unsubscribePublic=onSnapshot(pubRef,snap=>{if(snap.exists()){const x=snap.data();publicSettings={...publicSettings,...x,general:{...publicSettings.general,...(x.general||{})},auth:{...publicSettings.auth,...(x.auth||{})},operations:{...publicSettings.operations,...(x.operations||{})}};queueEnhance();}});
    onAuthStateChanged(auth,async user=>{
      signedInUser=user;unsubscribePrivate?.();unsubscribePrivate=null;
      if(user){
        const ref=doc(firestore,'settings','global');
        try{const snap=await getDoc(ref);if(snap.exists())settings=mergeSettings(DEFAULT_SETTINGS,snap.data());}catch(error){console.warn('Không đọc được cài đặt hệ thống:',error);}
        unsubscribePrivate=onSnapshot(ref,snap=>{if(snap.exists()){settings=mergeSettings(DEFAULT_SETTINGS,snap.data());queueEnhance();if(settingsOpen)renderSettingsPage(true);}});
        setTimeout(()=>refreshInfrastructure(false),250);
      }else infrastructure=null;
      queueEnhance();
    });
  }catch(error){console.warn('Không kết nối được module Cài đặt với Firebase:',error);queueEnhance();}
}

document.addEventListener('click',event=>{
  const settingsButton=event.target.closest?.('[data-action="g2g-settings"]');
  if(settingsButton){event.preventDefault();event.stopPropagation();settingsOpen=true;renderSettingsPage(true);refreshInfrastructure(false);return;}
  const native=event.target.closest?.('[data-action="admin-tab"]');if(native)settingsOpen=false;
},true);

const observer=new MutationObserver(()=>queueEnhance());observer.observe(document.getElementById('app'),{childList:true,subtree:true});
queueEnhance();connectFirebase();
