import {iconHtml} from '../ui/icons.js';
import {colorModeButtonHtml} from '../settings/color-mode.js';
import {currentPublicSettings} from '../settings/theme.js';
import {esc} from '../ui/format.js';

// Unmodified vector from Google's official HTML button configurator.
const googleMark=`<svg class="landing-google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

export function loginHtml({mode,general=currentPublicSettings().general||{}}){
  const name=general.systemName||'Luyện thi tiếng Đức',organization=general.organizationName||'G2G Career';
  const logo=mode==='local'?iconHtml('exams'):`<img src="/brand/logo${general.logoUrl?'?v='+encodeURIComponent(general.logoUrl):''}" alt="${esc(organization)}" width="48" height="48">`;
  const demo=mode==='local'?`<details class="che-do-demo"><summary>Tài khoản thử nghiệm</summary><div class="chon-demo"><button class="nut full demo-login" data-id="student-a">Vào vai Học viên</button><button class="nut full demo-login" data-id="teacher-lan">Vào vai Cô Lan</button><button class="nut full demo-login" data-id="master-1">Vào vai Quản trị cấp cao</button></div></details>`:'';
  return `<main class="landing">
    <header class="landing-header"><a class="landing-brand thuong-hieu" href="/" aria-label="Trang chủ"><span class="logo">${logo}</span><span class="ten-he-thong"><strong>${esc(name)}</strong><small data-brand-organization>${esc(organization)}</small></span></a><div class="landing-header-actions">${colorModeButtonHtml()}</div></header>
    <div class="landing-main">
      <div class="landing-copy"><h1 id="landing-title">Thi thử trước.<br> <span>Tự tin khi thi thật.</span></h1><p>Luyện đề tiếng Đức. Làm bài, xem kết quả và biết mình cần ôn gì.</p></div>
      <section class="landing-signin" aria-labelledby="login-title"><div class="landing-login"><div class="landing-login-heading"><span class="landing-login-symbol">${iconHtml('student')}</span><h2 id="login-title">Đăng nhập</h2></div><button type="button" class="dang-nhap-google landing-cta" id="googleLogin">${googleMark}<span data-google-login-label>Tiếp tục với Google</span></button><span class="landing-free">${iconHtml('example')} Hoàn toàn miễn phí</span><div class="landing-login-divider"></div><span class="landing-login-note">Kết quả sẽ được gửi về email này</span>${demo}</div><div class="landing-policy"><a href="/privacy.html">Chính sách bảo mật</a><span aria-hidden="true">·</span><a href="/terms.html">Điều khoản sử dụng</a></div></section>
      <section class="landing-product" aria-labelledby="landing-title">
        <figure class="landing-visual" aria-label="Minh họa trải nghiệm luyện thi, không phải kết quả thực tế">
          <div class="landing-demo" data-login-scene aria-hidden="true">
            <div class="landing-demo-wash landing-demo-wash--blue"></div><div class="landing-demo-wash landing-demo-wash--violet"></div><div class="landing-demo-orbit"><span></span></div><div class="landing-demo-layer landing-demo-layer--blue"></div><div class="landing-demo-layer landing-demo-layer--violet"></div>
            <div class="landing-demo-screen"><div class="landing-demo-top"><span class="landing-demo-identity">${iconHtml('exams')} <span data-brand-name>${esc(name)}</span></span><span class="landing-demo-badge">Goethe A1</span></div>
              <div class="landing-demo-body"><div class="landing-demo-nav"><span>Đọc</span><div>${[1,2,3,4,5,6].map(n=>`<span${n===6?' class="current"':''}>${n}</span>`).join('')}</div></div>
                <div class="landing-demo-question"><span class="landing-demo-eyebrow">Câu 6 · Ví dụ minh họa</span><h2 lang="de">Sie suchen einen Deutschkurs.</h2><div class="landing-demo-answer landing-demo-answer--first"><span>A</span><span lang="de">Deutsch am Vormittag</span></div><div class="landing-demo-answer landing-demo-answer--chosen"><span>B</span><span lang="de">Deutsch am Abend</span>${iconHtml('example')}</div><div class="landing-demo-answer landing-demo-answer--last"><span>C</span><span lang="de">Deutsch am Wochenende</span></div>
                <div class="landing-demo-progress"><div><span>Tiến trình làm bài</span><span>6 / 10</span></div><div class="landing-demo-track"><span></span></div></div></div>
              </div>
            </div>
            <div class="landing-demo-save">${iconHtml('example')}<span>Lưu bài tự động</span><span class="landing-demo-save-line"></span></div>
          </div>
          <figcaption><button type="button" class="landing-motion-control" data-login-motion-toggle aria-label="Tạm dừng chuyển động" hidden><span class="landing-motion-pause">${iconHtml('pause')}</span><span class="landing-motion-play">${iconHtml('play')}</span><span data-login-motion-label>Tạm dừng chuyển động</span></button></figcaption>
        </figure>
      </section>
    </div>
    <section class="landing-catalog" aria-label="Đề luyện và hoạt động"><div class="landing-bottom"><div class="landing-types" id="landingTypes"><span>Đang tải đề luyện…</span></div><div class="landing-metrics" id="landingMetrics" aria-live="polite"></div></div></section>
    <footer><span data-brand-organization>${esc(organization)}</span><span>Phát triển Nhân lực Quốc tế</span></footer>
  </main>`;
}
