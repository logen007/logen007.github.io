import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';

const button=(label,icon,attrs='',primary=false)=>`<button class="nut${primary?' chinh':''}" ${attrs}>${iconHtml(icon)}<span>${label}</span></button>`;
const footer=(content,note)=>`<footer class="speaking-footer">${content}<p class="speaking-note">${note}</p></footer>`;
export function speakingRoomHtml(){
 return `<header class="speaking-room-heading"><span data-title>Trước khi thi</span><span class="speaking-room-meta"><span data-status>Thử nghiệm</span><strong data-clock></strong></span></header>
 <div class="speaking-camera-stage">
  <div class="speaking-self-preview" data-preview-wrap><video data-preview autoplay playsinline muted></video>${button('Thử lại','repeat','data-check hidden')}</div>
  <div class="speaking-videos" data-videos hidden></div>
 </div>
 <section class="speaking-sheet">
  <p data-error role="alert" hidden></p>
  <section class="speaking-panel" data-preflight>
   <div class="speaking-content"><h1>Kiểm tra hình và tiếng</h1><p class="speaking-note speaking-copy">Có thể thu thử và nghe lại nếu cần.</p>
    <div class="speaking-test-actions">${button('Thu thử','speaking','data-record disabled')}${button('Nghe lại','play','data-listen disabled')}</div>
    <audio data-sample hidden></audio><p class="speaking-device-status" data-device-status role="status" aria-live="polite">Đang mở camera/micro…</p>
    <label class="speaking-check"><input type="checkbox" data-environment>Đảm bảo không có ai hoặc bất cứ thứ gì làm ảnh hưởng quá trình thi</label>
   </div>
   ${footer(button('Vào phòng chờ','arrowRight','data-join disabled',true),'Đảm bảo thấy hình và nghe rõ tiếng. Buổi thi được ghi hình.')}
  </section>
  <section class="speaking-panel" data-wait hidden>
   <div class="speaking-content"><h1 class="speaking-icon-title">${iconHtml('users')}<span>Chào nhau bằng tiếng Đức</span></h1>
    <p class="speaking-copy">Chỉ dùng tiếng Đức khi trò chuyện ở phòng chờ và trong lúc thi.</p>
    <div class="speaking-readiness" data-members></div>
   </div>
   ${footer(button('Sẵn sàng','example','data-ready',true),'<span data-wait-note>Đến giờ và đủ hai bạn, phòng tự bắt đầu.</span>')}
  </section>
  <section class="speaking-panel" data-stage hidden>
   <div class="speaking-content" data-task><div class="speaking-task-heading"><h1 class="speaking-icon-title"><span data-task-icon></span><span data-stage-title></span></h1><span class="speaking-turn" data-turn>Đến lượt bạn</span></div><div class="speaking-prompt" data-prompt></div></div>
   <div class="speaking-focus" data-listening hidden><span class="speaking-turn speaking-turn-neutral">Đang lắng nghe</span><h1 class="speaking-icon-title">${iconHtml('users')}<span data-speaker></span></h1><p class="speaking-note speaking-copy">Lắng nghe bạn cùng thi.<br>Hệ thống sẽ báo khi đến lượt bạn.</p></div>
   <footer class="speaking-footer" data-stage-footer>${button('Tôi đã nói xong','arrowRight','data-next',true)}<div class="speaking-inline-status" data-vote role="status" hidden>${iconHtml('example')}<span>Chờ bạn cùng thi</span></div><p class="speaking-note">Cả hai xong, hệ thống tự chuyển phần.</p></footer>
  </section>
  <section class="speaking-panel speaking-focus" data-paused hidden><span class="speaking-turn speaking-turn-neutral">Thời gian đã tạm dừng</span><h1 class="speaking-icon-title">${iconHtml('repeat')}<span>Đang kết nối lại</span></h1><p class="speaking-note speaking-copy">Giữ trang này mở. Phòng tự tiếp tục khi kết nối ổn định.</p></section>
  <section class="speaking-panel" data-finished hidden><div class="speaking-focus"><span class="speaking-complete-icon" data-finished-icon></span><h1 data-finished-title>Bạn đã hoàn thành</h1><p class="speaking-note speaking-copy" data-finished-note></p></div>${footer('<a class="nut chinh" href="/">'+iconHtml('arrowLeft')+'<span>Về trang chủ</span></a>','Buổi thử nghiệm không tính điểm thật.')}</section>
 </section>`;
}
export function privatePromptHtml(stage){
 const image=stage.image==='/speaking-assets/dtz-modelltest4-photo.png'?'<img src="'+stage.image+'" width="1150" height="775" alt="Ảnh đề bài" decoding="async">':'';
 return image+'<p>'+esc(stage.prompt||'')+'</p>';
}
export function readinessHtml(members){
 return members.map((m,index)=>'<div><span class="speaking-member-name" data-seat="'+(m.seat==='B'||!m.seat&&index===1?'B':'A')+'">'+esc(m.name)+'</span><span class="'+(m.ready?'speaking-is-ready':'')+'">'+(m.ready?'Sẵn sàng':m.presence?.connected?'Chưa sẵn sàng':'Đang kết nối')+'</span></div>').join('');
}
export function finishedCopy(state){
 if(state.state==='cancelled')return {title:'Ca thử đã dừng',note:'Giáo viên đã dừng ca thử. Bạn có thể trở về trang chủ.'};
 if(state.state==='interrupted')return {title:'Buổi thi bị gián đoạn',note:'Chưa có xác nhận hoàn thành. Giáo viên sẽ kiểm tra và hướng dẫn bạn.'};
 if(state.state==='completed')return {title:'Bạn đã hoàn thành',note:'Bản ghi đã được lưu. Giáo viên sẽ xem và nhận xét.'};
 return {title:'Đã kết thúc phần thi',note:state.state==='finishing'?'Đang đóng phòng an toàn. Giữ trang mở để nhận trạng thái bản ghi.':'Đang xử lý bản ghi. Chưa có xác nhận video đã được lưu.'};
}
export function finishedIconHtml(state){
 return state.state==='completed'?'<img src="/speaking-assets/complete.svg" width="32" height="32" alt="">':iconHtml(state.state==='interrupted'?'warning':state.state==='cancelled'?'close':'clock');
}
