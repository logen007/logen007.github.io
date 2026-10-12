import {esc} from '../ui/format.js';
export function connectionStatusHtml(infra){
  if(!infra)return '<span class="phu-de">Chưa có dữ liệu kết nối.</span>';
  return `<div><b>Backend</b>${status(infra?.backend==='VPS','VPS hoạt động','Chưa kết nối')}</div><div><b>PostgreSQL</b>${status(Boolean(infra?.postgresql),'Hoạt động','Lỗi')}</div><div><b>Google Login</b>${status(Boolean(infra?.googleLoginConfigured),'Đã cấu hình','Thiếu Client ID/Secret')}</div><div><b>SMTP</b>${status(Boolean(infra?.smtp?.configured),'Sẵn sàng','Chưa hoàn tất')}</div>`;
}

function status(ok,a,b){
  return `<span class="tich-hop-status ${ok?'ok':'off'}">${ok?'●':'○'} ${esc(ok?a:b)}</span>`;
}
