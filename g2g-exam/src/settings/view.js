import {normalizeLayout,layoutVariables,CONTENT_WIDTH_RANGE} from './layout.js';
import {normalizeButtonTheme,SELECTION_STRENGTH_RANGE} from './palette.js';
import {settingsTabsHtml} from './tabs.js';
import {r2SettingsCardHtml} from './r2.js';
import {DEFAULT_EXAM_MESSAGES} from '../ui/exam-messages.js';
import {iconHtml} from '../ui/icons.js';
import {esc} from '../ui/format.js';
import {DEFAULT_PRIMARY_COLOR,normalizeThemeColor,themePalette} from './theme.js';

function assetPicker(id,label,url,accept){
  return `<div class="settings-asset"><div class="settings-asset-preview" data-asset-preview="${id}">${url?`<img src="${esc(url)}" alt="${label} hiện tại">`:iconHtml('image')}</div><div class="settings-asset-info"><b>${label}</b><small data-asset-name="${id}">${url?'Đang sử dụng':'Chưa có ảnh'}</small></div><button class="nut" type="button" data-asset-pick="${id}">${iconHtml('image')}<span>${url?'Thay ảnh':'Chọn ảnh'}</span></button><input id="${id}" type="file" hidden data-image-picker-direct accept="${accept}" aria-label="${label}"></div>`;
}

function field(id,label,value,type='text',help=''){
  return `<label class="cai-dat-field"><span>${esc(label)}</span><input class="truong" id="${id}" type="${type}" value="${esc(value)}">${help?`<small>${esc(help)}</small>`:''}</label>`;
}

function area(id,label,value,help=''){
  return `<label class="cai-dat-field"><span>${esc(label)}</span><textarea class="truong" id="${id}" rows="6">${esc(value)}</textarea>${help?`<small>${esc(help)}</small>`:''}</label>`;
}

function toggle(id,label,on,help=''){
  return `<label class="cai-dat-toggle"><input id="${id}" type="checkbox" ${on?'checked':''}><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span></label>`;
}

function card(title,desc,body,extra=''){
  return `<section class="the cai-dat-card ${extra}"><div class="cai-dat-card-head"><h2>${esc(title)}</h2><p>${esc(desc)}</p></div><div class="cai-dat-fields">${body}</div></section>`;
}

export {connectionStatusHtml} from '../views/connection-status.js';

function themeCard(theme={}){
  const color=normalizeThemeColor(theme.primaryColor)||DEFAULT_PRIMARY_COLOR;
  const layout=normalizeLayout(theme);
  const buttons=normalizeButtonTheme(theme);
  const colorControl=(picker,id,label,value)=>`<div class="cai-dat-field"><label for="${id}">${label}</label><div class="brand-color-control"><input id="${picker}" type="color" value="${value}" aria-label="Chọn màu ${label.toLowerCase()}"><input class="truong" id="${id}" value="${value}" maxlength="7" spellcheck="false" aria-label="Mã màu ${label.toLowerCase()}" aria-describedby="sThemeError"></div></div>`;
  const select=(id,label,key,options)=>'<label class="cai-dat-field"><span>'+label+'</span><select class="truong" id="'+id+'">'+options.map(([value,text])=>'<option value="'+value+'" '+(layout[key]===value?'selected':'')+'>'+text+'</option>').join('')+'</select></label>';
  const controls=`<label class="cai-dat-field"><span>Chiều rộng nội dung (px)</span><input class="truong" id="sContentWidth" type="number" min="${CONTENT_WIDTH_RANGE.min}" max="${CONTENT_WIDTH_RANGE.max}" step="1" value="${layout.contentWidth}"><small>${CONTENT_WIDTH_RANGE.min}–${CONTENT_WIDTH_RANGE.max} px · Tự thu gọn theo màn hình.</small></label>`+select('sCardRadius','Bo góc thẻ','cardRadius',[12,16,20,24,28].map(v=>[v,v+' px']))+colorControl('sBackgroundPicker','sBackground','Nền trang',layout.background);
  const palette=Object.entries({...themePalette(color,buttons),...layoutVariables(layout)}).map(([key,value])=>`${key}:${value}`).join(';');
  return card('Giao diện thương hiệu','Tùy chỉnh màu và bố cục. Xem trước bên dưới, lưu để áp dụng toàn web.',`${colorControl('sPrimaryColor','sPrimaryColorText','Nút chính',color)}<label class="cai-dat-field" for="sSelectionStrength"><span>Độ đậm khi đang chọn <output id="sSelectionValue" for="sSelectionStrength">${buttons.selectionStrength}%</output></span><input id="sSelectionStrength" type="range" min="${SELECTION_STRENGTH_RANGE.min}" max="${SELECTION_STRENGTH_RANGE.max}" step="1" value="${buttons.selectionStrength}"><small>Cùng màu với nút chính, chỉ thay đổi độ đậm.</small></label>${colorControl('sSecondaryColorPicker','sSecondaryColorText','Nút phụ',buttons.secondaryColor)}${controls}<small id="sThemeError" class="theme-validation" role="status" aria-live="polite">Màu chữ trên nút được cân chỉnh tương phản tự động.</small><div class="brand-theme-preview" id="sThemePreview" style="${palette}"><span class="brand-preview-caption">Xem trước</span><div class="brand-preview-controls"><span class="brand-preview-primary">Nút chính</span><span class="brand-preview-selected">Đang chọn</span><span class="brand-preview-secondary">Nút phụ</span></div><small>Màu lỗi, cảnh báo và thành công giữ ý nghĩa riêng.</small></div>`);
}

export function settingsPageHtml({settings,infra,localOnly=false}){
  const s=settings;
  if(localOnly)return `<div class="g2g-settings-page"><div class="tieu-de-trang"><div><h1>Cài đặt giao diện</h1><p>Bản demo · Giao diện được lưu riêng trên trình duyệt này.</p></div><button class="nut chinh" id="sSave">Lưu giao diện</button></div><div class="cai-dat-grid">${themeCard(s.theme)}</div><div class="cai-dat-footer"><span id="sState" class="phu-de" role="status">Áp dụng cho các trang demo trên trình duyệt này.</span></div></div>`;
  return `<div class="g2g-settings-page"><div class="tieu-de-trang"><div><h1>Cài đặt hệ thống</h1></div></div>${settingsTabsHtml()}<div class="cai-dat-grid">
${card('Thông tin hệ thống','Tên hiển thị và địa chỉ truy cập.',field('sName','Tên hệ thống',s.general.systemName)+field('sOrg','Đơn vị vận hành',s.general.organizationName)+field('sSupport','Email hỗ trợ',s.general.supportEmail,'email')+field('sFeedbackEmail','Email nhận góp ý',s.general.feedbackEmail||'admin@g2gcareer.com','email')+field('sUrl','Địa chỉ hệ thống',s.general.publicUrl,'url')+assetPicker('sLogo','Logo',s.general.logoUrl,'image/*')+assetPicker('sFavicon','Favicon',s.general.faviconUrl,'image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon'))}
${themeCard(s.theme)}
${r2SettingsCardHtml()}
${card('Đăng nhập Google','Google OAuth chạy trực tiếp trên VPS, không cần Firebase.',toggle('sGoogle','Bật đăng nhập Google',s.auth.googleLoginEnabled)+toggle('sSignup','Cho học viên mới tự đăng ký',s.auth.allowNewStudents)+field('sDomain','Giới hạn tên miền email',s.auth.allowedDomain,'text','Để trống để nhận mọi tài khoản Google.'))}
${card('Máy chủ SMTP','SMTP riêng của anh. Mật khẩu được mã hóa trong PostgreSQL bằng khóa chỉ có trên VPS.',toggle('sSmtp','Bật SMTP',s.smtp.enabled)+field('sHost','SMTP Host',s.smtp.host)+field('sPort','Cổng SMTP',s.smtp.port,'number')+`<label class="cai-dat-field"><span>Bảo mật</span><select class="truong" id="sSecurity"><option value="starttls" ${s.smtp.security==='starttls'?'selected':''}>STARTTLS</option><option value="ssl" ${s.smtp.security==='ssl'?'selected':''}>SSL/TLS</option><option value="none" ${s.smtp.security==='none'?'selected':''}>Không mã hóa</option></select></label>`+field('sUser','Tên đăng nhập',s.smtp.username)+`<label class="cai-dat-field"><span>Mật khẩu / API key</span><div class="email-test"><input class="truong" id="sPassword" type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><button class="nut" id="sSecret">Cập nhật mật khẩu</button></div><small id="sSecretHint">${!infra?'Chưa kiểm tra trạng thái mật khẩu.':infra?.smtp?.secretConfigured?'Đã lưu mật khẩu an toàn trên VPS.':'Chưa lưu mật khẩu SMTP.'}</small></label>`+field('sFromName','Tên người gửi',s.smtp.fromName)+field('sFrom','Email người gửi',s.smtp.fromEmail,'email')+field('sReply','Reply-To',s.smtp.replyTo,'email')+field('sTimeout','Timeout (ms)',s.smtp.timeoutMs,'number')+toggle('sTlsVerify','Kiểm tra chứng chỉ TLS',s.smtp.rejectUnauthorized!==false))}
${card('AI gợi ý chấm bài viết','Tùy chọn. Khóa được mã hóa trên VPS, không trả về trình duyệt. Hệ thống tự chuyển sang AI còn lại khi AI ưu tiên đạt hạn mức miễn phí.',`<label class="cai-dat-field"><span>AI ưu tiên</span><select class="truong" id="sAiProvider"><option value="groq" ${s.ai?.providerPreference==='groq'||!s.ai?.providerPreference?'selected':''}>Groq</option><option value="gemini" ${s.ai?.providerPreference==='gemini'?'selected':''}>Google AI Studio (Gemini)</option><option value="grok" ${s.ai?.providerPreference==='grok'?'selected':''}>Grok (xAI)</option></select><small>Chỉ chuyển sang AI còn lại khi AI ưu tiên hết hạn mức hoặc chưa được cấu hình.</small></label><label class="cai-dat-field"><span>Groq API key</span><div class="email-test"><input class="truong" id="sAiGroq" type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><button class="nut" id="sAiGroqSave">Cập nhật Groq</button></div><small id="sAiGroqHint">${infra?.ai?.groq?.configured?'Đã cấu hình.':'Chưa cấu hình.'}</small></label><label class="cai-dat-field"><span>Gemini API key</span><div class="email-test"><input class="truong" id="sAiGemini" type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><button class="nut" id="sAiGeminiSave">Cập nhật Gemini</button></div><small id="sAiGeminiHint">${infra?.ai?.gemini?.configured?'Đã cấu hình.':'Chưa cấu hình.'}</small></label><label class="cai-dat-field"><span>Grok API key</span><div class="email-test"><input class="truong" id="sAiGrok" type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><button class="nut" id="sAiGrokSave">Cập nhật Grok</button></div><small id="sAiGrokHint">${infra?.ai?.grok?.configured?'Đã cấu hình.':'Chưa cấu hình.'}</small></label>`)}
${card('Email kết quả','Gửi khi giáo viên công bố kết quả.',toggle('sEmail','Bật email kết quả',s.email.enabled)+field('sSubject','Tiêu đề',s.email.resultSubject)+area('sText','Nội dung text',s.email.resultText,'Biến: {student}, {exam}, {score}, {result}, {url}, {scoreDetails}, {passCondition}, {promotion}, {previousLevel}, {newLevel}')+area('sHtml','Nội dung HTML',s.email.resultHtml)+`<div class="email-test"><input class="truong" id="sTestTo" type="email" placeholder="Email nhận thử"><button class="nut" id="sTest">Gửi email thử</button></div><small id="sTestState" role="status" aria-live="polite"></small>`)}
${card('Câu nhắn khi bắt đầu thi','Hiển thị ngẫu nhiên trong hiệu ứng chuyển vào bài thi.',area('sExamMessages','Mỗi dòng một câu',s.general.examMessages||DEFAULT_EXAM_MESSAGES,'Tối đa 100 câu, mỗi câu 160 ký tự. Để trống để dùng 10 câu mặc định. Tránh thông tin riêng của một dạng bài.'))}
${card('Vận hành / bảo trì','Khóa bắt đầu lượt mới khi cần bảo trì.',toggle('sMaintenance','Bật chế độ bảo trì',s.operations.maintenanceMode)+field('sMaintenanceText','Thông báo bảo trì',s.operations.maintenanceMessage)+field('sTrashDays','Tự xóa thùng rác sau (ngày)',s.operations.trashRetentionDays??30,'number','Từ 1 đến 3650 ngày. Xóa vĩnh viễn cả lịch sử bài làm của đề.'))}
</div><div class="cai-dat-footer"><span id="sState" class="phu-de">Mật khẩu SMTP không bao giờ được gửi lại xuống trình duyệt.</span><button class="nut chinh" id="sSaveBottom">Lưu cài đặt</button></div></div>`;
}
