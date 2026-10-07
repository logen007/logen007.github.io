// Temporary UI/demo access while Google OAuth is disabled during interface work.
// This never creates a server session and uses only the browser's local demo state.
globalThis.G2G_DEMO_BYPASS=true;

const demoPath=location.pathname.replace(/\/+$/,'')||'/';
const demoUser=demoPath==='/adm'?'master-1':demoPath==='/teacher'?'teacher-lan':demoPath==='/student'?'student-a':null;

if(demoUser)sessionStorage.setItem('g2g.demo.user',demoUser);
else if(demoPath==='/')sessionStorage.removeItem('g2g.demo.user');

function tuneLogin(){
  const button=document.getElementById('googleLogin');
  if(button&&button.textContent!=='Đăng nhập')button.textContent='Đăng nhập';
  const box=document.querySelector('.hop-dang-nhap');
  const paragraph=box?.querySelector('p');
  const text='Nhấn Đăng nhập để vào trang học viên.';
  if(paragraph&&paragraph.textContent!==text)paragraph.textContent=text;
  const demo=document.querySelector('.che-do-demo');
  if(demo)demo.remove();
}

let scheduled=false;
const observer=new MutationObserver(()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    tuneLogin();
  });
});
observer.observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',event=>{
  const button=event.target.closest?.('#googleLogin');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  sessionStorage.setItem('g2g.demo.user','student-a');
  location.assign('/student');
},true);

tuneLogin();
