// Temporary UI/demo access while Google OAuth is disabled during interface work.
// This never creates a server session and uses only the browser's local demo state.
globalThis.G2G_DEMO_BYPASS=true;

const path=location.pathname.replace(/\/+$/,'')||'/';
const demoUser=path==='/adm'?'master-1':path==='/teacher'?'teacher-lan':path==='/student'?'student-a':null;

if(demoUser)sessionStorage.setItem('g2g.demo.user',demoUser);
else if(path==='/')sessionStorage.removeItem('g2g.demo.user');

function tuneLogin(){
  const button=document.getElementById('googleLogin');
  if(button){
    button.textContent='Đăng nhập';
    button.onclick=null;
  }
  const box=document.querySelector('.hop-dang-nhap');
  const paragraph=box?.querySelector('p');
  if(paragraph)paragraph.textContent='Nhấn Đăng nhập để vào trang học viên.';
  document.querySelector('.che-do-demo')?.remove();
}

new MutationObserver(tuneLogin).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#googleLogin');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  sessionStorage.setItem('g2g.demo.user','student-a');
  location.assign('/student');
},true);

tuneLogin();
