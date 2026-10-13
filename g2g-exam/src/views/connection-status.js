import {esc} from '../ui/format.js';
export function connectionStatusHtml(infra,{compact=false}={}){
  if(!infra)return '<span class="phu-de">Chưa có dữ liệu kết nối.</span>';
  if(compact){
    const services=[['Backend',infra.backend==='VPS',infra.backend!=null,'VPS hoạt động','Chưa kết nối'],['PostgreSQL',Boolean(infra.postgresql),infra.postgresql!=null,'Hoạt động','Lỗi'],['Google Login',Boolean(infra.googleLoginConfigured),infra.googleLoginConfigured!=null,'Đã cấu hình','Chưa cấu hình'],['SMTP',Boolean(infra.smtp?.configured),infra.smtp?.configured!=null,'Sẵn sàng','Chưa cấu hình']];
    return services.map(([label,ok,known,success,failure])=>{const state=known?(ok?success:failure):'Chưa có dữ liệu';return `<span class="dashboard-service ${known?(ok?'is-ok':'is-off'):'is-unknown'}" title="${esc(label+': '+state)}"><i aria-hidden="true"></i>${label}${known&&ok?`<span class="sr-only">: ${state}</span>`:`<small>${state}</small>`}</span>`;}).join('');
  }
  return `<div><b>Backend</b>${status(infra?.backend==='VPS','VPS hoạt động','Chưa kết nối')}</div><div><b>PostgreSQL</b>${status(Boolean(infra?.postgresql),'Hoạt động','Lỗi')}</div><div><b>Google Login</b>${status(Boolean(infra?.googleLoginConfigured),'Đã cấu hình','Thiếu Client ID/Secret')}</div><div><b>SMTP</b>${status(Boolean(infra?.smtp?.configured),'Sẵn sàng','Chưa hoàn tất')}</div>`;
}

function status(ok,a,b){
  return `<span class="tich-hop-status ${ok?'ok':'off'}">${ok?'●':'○'} ${esc(ok?a:b)}</span>`;
}
