let selectedGroup='all',searchTerm='';
function mount(){
  const main=document.querySelector('.noi-dung-quan-tri');
  const heading=main?.querySelector('.tieu-de-trang h1');
  if(!main||!heading||!['Giáo viên & tài khoản','Danh sách người dùng'].includes(heading.textContent.trim()))return;
  heading.textContent='Danh sách người dùng';
  main.querySelector('.tieu-de-trang p')?.remove();
  if(main.querySelector('#userRolePanel'))return;
  const rows=[...main.querySelectorAll('[data-user-group]')];
  const groups=[['all','Tất cả'],['teacher','Giáo Viên'],['student','Học Viên'],['external','Học viên Vãng lai']];
  const panel=document.createElement('section');
  panel.id='userRolePanel';panel.className='user-list-filters';
  panel.innerHTML='<div class="nhom-nut" data-user-groups></div><input class="truong" id="userSearch" type="search" aria-label="Tìm tên hoặc email" placeholder="Tìm theo tên hoặc email" autocomplete="off">';
  const buttons=groups.map(([key,label])=>{
    const button=document.createElement('button');button.type='button';
    button.textContent=label+' ('+(key==='all'?rows.length:rows.filter(row=>row.dataset.userGroup===key).length)+')';
    button.dataset.userGroupFilter=key;
    panel.querySelector('[data-user-groups]').append(button);
    return button;
  });
  main.querySelector('.tieu-de-trang').insertAdjacentElement('afterend',panel);
  const empty=document.createElement('tr');
  empty.innerHTML='<td colspan="4" class="rong">Không tìm thấy người dùng.</td>';
  main.querySelector('tbody')?.append(empty);
  function filter(){
    let count=0;
    rows.forEach(row=>{row.hidden=(selectedGroup!=='all'&&row.dataset.userGroup!==selectedGroup)||!row.dataset.userSearch.includes(searchTerm.trim().toLocaleLowerCase('vi'));if(!row.hidden)count++;});
    empty.hidden=count>0;
    buttons.forEach(button=>{const active=button.dataset.userGroupFilter===selectedGroup;button.className='nut'+(active?' chinh':'');button.setAttribute('aria-pressed',String(active));});
  }
  buttons.forEach(button=>button.onclick=()=>{selectedGroup=button.dataset.userGroupFilter;filter();});
  const search=panel.querySelector('#userSearch');search.value=searchTerm;
  search.oninput=()=>{searchTerm=search.value;filter();};filter();
}
let scheduled=false;
function scheduleMount(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;mount();},0);}
scheduleMount();
const app=document.getElementById('app');
if(app)new MutationObserver(scheduleMount).observe(app,{childList:true});
