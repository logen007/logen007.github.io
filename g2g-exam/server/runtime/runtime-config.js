// Temporary preview mode while the Google login flow is being rebuilt.
// Public routes use local demo data only, so /adm and /teacher never grant
// access to the production PostgreSQL/API without real authentication.
const path=location.pathname.replace(/\/+$/,'')||'/';
const demoUser=path==='/adm'?'master-1':path==='/teacher'?'teacher-lan':path==='/student'?'student-a':null;

if(demoUser){
  window.G2G_API_BASE='';
  window.G2G_DEMO_BYPASS=true;
  sessionStorage.setItem('g2g.demo.user',demoUser);
}else if(path==='/'){
  // Login landing page is local-only for now. The single Login button below
  // redirects to /student instead of starting Google OAuth.
  window.G2G_API_BASE='';
  window.G2G_DEMO_BYPASS=true;
  const current=sessionStorage.getItem('g2g.demo.user');
  if(current&&current!=='student-a')sessionStorage.removeItem('g2g.demo.user');

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#googleLogin,.dang-nhap-google');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sessionStorage.setItem('g2g.demo.user','student-a');
    location.assign('/student');
  },true);

  const renameLogin=()=>{
    const button=document.getElementById('googleLogin');
    if(button){button.textContent='Đăng nhập';return;}
    setTimeout(renameLogin,50);
  };
  setTimeout(renameLogin,0);

  const style=document.createElement('style');
  style.textContent='.che-do-demo{display:none!important}';
  document.head.appendChild(style);
}else{
  window.G2G_API_BASE='/api';
}
