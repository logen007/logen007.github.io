const app=document.getElementById('app');
const loaded=new Map();let frame=0;let settingsTimer=null;
function load(path){if(loaded.has(path))return loaded.get(path);const task=import(path).catch(error=>{console.error(`Không tải được module ${path}`,error);loaded.delete(path);});loaded.set(path,task);return task;}
function syncRolePath(){if(globalThis.G2G_DEMO_BYPASS)return;const badge=app?.querySelector('.thanh-dau .nhan')?.textContent?.trim()||'';let target='';if(badge==='Quản trị cấp cao')target='/adm';else if(badge==='Giáo viên')target='/teacher';else if(badge==='Học viên'&&['/adm','/teacher'].includes(location.pathname))target='/';if(target&&location.pathname!==target)history.replaceState(null,'',target);}
function inspect(){
  if(!app)return;syncRolePath();const admin=app.querySelector('.khung-quan-tri');
  if(admin){const activeTab=app.querySelector('[data-action="admin-tab"].active')?.dataset.tab||'';const heading=app.querySelector('.noi-dung-quan-tri .tieu-de-trang h1')?.textContent?.trim()||'';if(activeTab==='trash'||heading==='Thùng rác')load('./question-groups/trash.js');if(!globalThis.G2G_DEMO_BYPASS){if(!settingsTimer&&!loaded.has('./settings.js'))settingsTimer=setTimeout(()=>{settingsTimer=null;if(app.querySelector('.khung-quan-tri'))load('./settings.js');},250);if(activeTab==='teachers'||heading==='Giáo viên & tài khoản'||heading==='Danh sách người dùng')load('./users/bootstrap.js');}}
  if(!globalThis.G2G_DEMO_BYPASS&&app.querySelector('.thi'))load('./part-templates/runtime.js');
}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;inspect();});}
if(app)new MutationObserver(schedule).observe(app,{childList:true});document.addEventListener('click',event=>{if(event.target.closest?.('[data-action="admin-tab"]'))setTimeout(schedule,0);},true);schedule();
