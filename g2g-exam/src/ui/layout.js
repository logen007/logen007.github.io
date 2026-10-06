import {isMaster,isStudent} from '../core.js';

export function topbarHtml({user,mode,online}){
  const role=isStudent(user)?'Học viên':isMaster(user)?'Quản trị cấp cao':'Giáo viên';
  const demo=mode==='local'
    ? '<div class="canh-bao-che-do">Đang chạy bản demo cục bộ trên trình duyệt; dữ liệu không phải dữ liệu thật.</div>'
    : '';
  const offline=!online
    ? '<div class="offline">Mất kết nối mạng. Hãy giữ trang mở; dữ liệu sẽ tiếp tục đồng bộ khi có mạng.</div>'
    : '';
  return `<header class="thanh-dau"><div class="thuong-hieu"><div class="logo">G2G</div><div class="ten-he-thong"><strong>Thi thử tiếng Đức</strong><small>Mô phỏng trải nghiệm thi trên máy tính</small></div></div><div class="nhom-nut"><span class="nhan">${role}</span><button class="nut nho" data-action="logout">Đăng xuất</button></div></header>${demo}${offline}`;
}
