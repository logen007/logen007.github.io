const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');

function notify(message){
  const toast=document.getElementById('toast');
  if(!toast){alert(message);return;}
  toast.textContent=message;
  toast.classList.remove('an');
  clearTimeout(notify.t);
  notify.t=setTimeout(()=>toast.classList.add('an'),2800);
}

async function request(path,{method='GET',body}={}){
  const options={method,credentials:'include',headers:{}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  const response=await fetch(`${API}${path}`,options);
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data?.error||`Máy chủ trả về lỗi ${response.status}.`);
  return data;
}

function mount(){
  const tab=document.querySelector('[data-action="admin-tab"][data-tab="teachers"]');
  if(tab&&tab.textContent.trim()!=='Người dùng')tab.textContent='Người dùng';

  const main=document.querySelector('.noi-dung-quan-tri');
  const heading=main?.querySelector('.tieu-de-trang h1');
  if(!main||!heading||!['Giáo viên & tài khoản','Danh sách người dùng'].includes(heading.textContent.trim()))return;

  if(heading.textContent.trim()!=='Danh sách người dùng')heading.textContent='Danh sách người dùng';
  const description=main.querySelector('.tieu-de-trang p');
  const descriptionText='Master Admin xem toàn bộ tài khoản đã đăng nhập và cấp hoặc thu hồi quyền Giáo viên theo email.';
  if(description&&description.textContent.trim()!==descriptionText)description.textContent=descriptionText;
  if(main.querySelector('#userRolePanel'))return;

  const panel=document.createElement('section');
  panel.id='userRolePanel';
  panel.className='the';
  panel.style.marginBottom='16px';
  panel.innerHTML=`
    <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">
      <label style="flex:1;min-width:220px"><span class="phu-de">Cấp quyền Giáo viên theo email</span><input class="truong" id="teacherGrantEmail" type="email" autocomplete="email" placeholder="teacher@example.com" style="width:100%;margin-top:6px"></label>
      <button class="nut chinh" id="teacherGrantButton" type="button">Cấp quyền Giáo viên</button>
    </div>
    <div class="phu-de" style="margin-top:8px">Có thể cấp quyền trước khi người đó đăng nhập. Khi đăng nhập Google bằng đúng email này, hệ thống tự nhận vai trò Giáo viên.</div>
    <div style="margin-top:12px"><input class="truong tim" id="userSearch" placeholder="Tìm theo tên, email hoặc vai trò..." style="width:100%"></div>`;
  const title=main.querySelector('.tieu-de-trang');
  title?.insertAdjacentElement('afterend',panel);

  const input=panel.querySelector('#teacherGrantEmail');
  const button=panel.querySelector('#teacherGrantButton');
  button.addEventListener('click',async()=>{
    const email=input.value.trim().toLowerCase();
    if(!email){notify('Nhập email cần cấp quyền Giáo viên.');input.focus();return;}
    button.disabled=true;
    try{
      await request('/actions/setTeacherByEmail',{method:'POST',body:{email,enabled:true}});
      notify('Đã cấp quyền Giáo viên cho email này.');
      input.value='';
      setTimeout(()=>location.reload(),450);
    }catch(error){notify(error.message);}finally{button.disabled=false;}
  });

  const search=panel.querySelector('#userSearch');
  search.addEventListener('input',()=>{
    const q=search.value.trim().toLowerCase();
    main.querySelectorAll('.table-wrap tbody tr').forEach(row=>{
      row.style.display=!q||row.textContent.toLowerCase().includes(q)?'':'none';
    });
  });
}

let scheduled=false;
function scheduleMount(){
  if(scheduled)return;
  scheduled=true;
  setTimeout(()=>{scheduled=false;mount();},0);
}

scheduleMount();
const app=document.getElementById('app');
// Only watch top-level app rerenders. Watching the full subtree made this module
// observe its own text changes and could starve the browser in a render loop.
if(app)new MutationObserver(scheduleMount).observe(app,{childList:true});
