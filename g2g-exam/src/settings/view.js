import {settingsTabsHtml} from './tabs.js';
import {esc} from '../ui/format.js';
import {DEFAULT_PRIMARY_COLOR,normalizeThemeColor,themePalette} from './theme.js';

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

function status(ok,a,b){
  return `<span class="tich-hop-status ${ok?'ok':'off'}">${ok?'●':'○'} ${esc(ok?a:b)}</span>`;
}

function themeCard(theme={}){
  const color=normalizeThemeColor(theme.primaryColor)||DEFAULT_PRIMARY_COLOR;
  const presets=[['#111827','Than đậm'],['#6D3DF5','Tím'],['#175CD3','Xanh dương'],['#087A56','Xanh lá']];
  const palette=Object.entries(themePalette(color)).map(([key,value])=>`${key}:${value}`).join(';');
  return card('Giao diện thương hiệu','Màu chủ đạo dùng cho nút chính và trạng thái đang chọn. Các bề mặt giữ nền trung tính để nội dung dễ đọc.',`<div class="cai-dat-field"><label for="sPrimaryColorText">Màu chủ đạo</label><div class="brand-color-control"><input id="sPrimaryColor" type="color" value="${esc(color)}" aria-label="Chọn màu chủ đạo"><input class="truong" id="sPrimaryColorText" value="${esc(color)}" maxlength="7" spellcheck="false" aria-label="Mã màu chủ đạo" aria-describedby="sThemeError" placeholder="#111827"></div><small id="sThemeError" class="theme-validation" aria-live="polite">Chữ và nền được cân chỉnh tương phản tự động.</small><div class="brand-color-presets" aria-label="Màu gợi ý">${presets.map(([value,label])=>`<button class="brand-color-preset" type="button" data-theme-preset="${value}" aria-label="${label}" aria-pressed="${value===color}"><span style="background:${value}" aria-hidden="true"></span>${label}</button>`).join('')}</div></div><div class="brand-theme-preview" id="sThemePreview" style="${palette}"><span class="brand-preview-caption">Xem trước</span><div class="brand-preview-controls"><span class="brand-preview-primary">Nút chính</span><span class="brand-preview-selected">Đang chọn</span><span class="brand-preview-secondary">Nút phụ</span></div><small>Màu lỗi, cảnh báo và thành công giữ ý nghĩa riêng.</small></div>`);
}

export function settingsPageHtml({settings,infra,localOnly=false}){
  const s=settings;
  if(localOnly)return `<div class="g2g-settings-page"><div class="tieu-de-trang"><div><h1>Cài đặt giao diện</h1><p>Bản demo · Màu được lưu riêng trên trình duyệt này.</p></div><button class="nut chinh" id="sSave">Lưu giao diện</button></div><div class="cai-dat-grid">${themeCard(s.theme)}</div><div class="cai-dat-footer"><span id="sState" class="phu-de" role="status">Áp dụng cho các trang demo trên trình duyệt này.</span></div></div>`;
  return `<div class="g2g-settings-page"><div class="tieu-de-trang"><div><h1>Cài đặt hệ thống</h1></div><div class="nhom-nut"><button class="nut" id="sRefresh">Kiểm tra kết nối</button><button class="nut chinh" id="sSave">Lưu cài đặt</button></div></div>${settingsTabsHtml()}<div class="tich-hop-tong-quan"><div><b>Backend</b>${status(infra?.backend==='VPS','VPS hoạt động','Chưa kết nối')}</div><div><b>PostgreSQL</b>${status(Boolean(infra?.postgresql),'Hoạt động','Lỗi')}</div><div><b>Google Login</b>${status(Boolean(infra?.googleLoginConfigured),'Đã cấu hình','Thiếu Client ID/Secret')}</div><div><b>SMTP</b>${status(Boolean(infra?.smtp?.configured),'Sẵn sàng','Chưa hoàn tất')}</div></div><div class="cai-dat-grid">
${card('Thông tin hệ thống','Tên hiển thị và địa chỉ truy cập.',field('sName','Tên hệ thống',s.general.systemName)+field('sOrg','Đơn vị vận hành',s.general.organizationName)+field('sSupport','Email hỗ trợ',s.general.supportEmail,'email')+field('sUrl','Địa chỉ hệ thống',s.general.publicUrl,'url')+`<label class="cai-dat-field"><span>Logo</span><input id="sLogo" type="file" accept="image/*"><small>${s.general.logoUrl?'Đã có logo. Chọn ảnh mới để thay.':'Chưa có logo riêng.'}</small></label><label class="cai-dat-field"><span>Favicon</span><input id="sFavicon" type="file" accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"><small>${s.general.faviconUrl?'Đã có favicon. Chọn ảnh mới để thay.':'Chưa có favicon riêng.'}</small></label>`)}
${themeCard(s.theme)}
${card('Đăng nhập Google','Google OAuth chạy trực tiếp trên VPS, không cần Firebase.',toggle('sGoogle','Bật đăng nhập Google',s.auth.googleLoginEnabled)+toggle('sSignup','Cho học viên mới tự đăng ký',s.auth.allowNewStudents)+field('sDomain','Giới hạn tên miền email',s.auth.allowedDomain,'text','Để trống để nhận mọi tài khoản Google.'))}
${card('Máy chủ SMTP','SMTP riêng của anh. Mật khẩu được mã hóa trong PostgreSQL bằng khóa chỉ có trên VPS.',toggle('sSmtp','Bật SMTP',s.smtp.enabled)+field('sHost','SMTP Host',s.smtp.host)+field('sPort','Cổng SMTP',s.smtp.port,'number')+`<label class="cai-dat-field"><span>Bảo mật</span><select class="truong" id="sSecurity"><option value="starttls" ${s.smtp.security==='starttls'?'selected':''}>STARTTLS</option><option value="ssl" ${s.smtp.security==='ssl'?'selected':''}>SSL/TLS</option><option value="none" ${s.smtp.security==='none'?'selected':''}>Không mã hóa</option></select></label>`+field('sUser','Tên đăng nhập',s.smtp.username)+`<label class="cai-dat-field"><span>Mật khẩu / API key</span><div class="email-test"><input class="truong" id="sPassword" type="password" autocomplete="new-password" placeholder="Nhập khi cần cập nhật"><button class="nut" id="sSecret">Cập nhật mật khẩu</button></div><small>${infra?.smtp?.secretConfigured?'Đã lưu mật khẩu an toàn trên VPS.':'Chưa lưu mật khẩu SMTP.'}</small></label>`+field('sFromName','Tên người gửi',s.smtp.fromName)+field('sFrom','Email người gửi',s.smtp.fromEmail,'email')+field('sReply','Reply-To',s.smtp.replyTo,'email')+field('sTimeout','Timeout (ms)',s.smtp.timeoutMs,'number')+toggle('sTlsVerify','Kiểm tra chứng chỉ TLS',s.smtp.rejectUnauthorized!==false),'cai-dat-card-rong')}
${card('Email kết quả','Gửi khi giáo viên công bố kết quả.',toggle('sEmail','Bật email kết quả',s.email.enabled)+field('sSubject','Tiêu đề',s.email.resultSubject)+area('sText','Nội dung text',s.email.resultText,'Biến: {student}, {exam}, {score}, {result}, {url}, {scoreDetails}, {passCondition}, {promotion}, {previousLevel}, {newLevel}')+area('sHtml','Nội dung HTML',s.email.resultHtml)+`<div class="email-test"><input class="truong" id="sTestTo" type="email" placeholder="Email nhận thử"><button class="nut" id="sTest">Gửi email thử</button></div><small id="sTestState" role="status" aria-live="polite"></small>`,'cai-dat-card-rong')}
${card('Quyền làm bài','Thí sinh có thể thi lại sau khi nộp; lượt đang dở có thể được làm lại nếu được bật.',toggle('sRestart','Cho phép bỏ lượt đang làm để làm lại',s.exam.allowRestart))}
${card('Vận hành / bảo trì','Khóa bắt đầu lượt mới khi cần bảo trì.',toggle('sMaintenance','Bật chế độ bảo trì',s.operations.maintenanceMode)+field('sMaintenanceText','Thông báo bảo trì',s.operations.maintenanceMessage)+field('sTrashDays','Tự xóa thùng rác sau (ngày)',s.operations.trashRetentionDays??30,'number','Từ 1 đến 3650 ngày. Xóa vĩnh viễn cả lịch sử bài làm của đề.'))}
</div><div class="cai-dat-footer"><span id="sState" class="phu-de">Mật khẩu SMTP không bao giờ được gửi lại xuống trình duyệt.</span><button class="nut chinh" id="sSaveBottom">Lưu cài đặt</button></div></div>`;
}
