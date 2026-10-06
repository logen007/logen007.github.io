const app=document.getElementById('app');
const loaded=new Map();
let frame=0;
let settingsTimer=null;

function load(path){
  if(loaded.has(path))return loaded.get(path);
  const task=import(path).catch(error=>{
    console.error(`Không tải được module ${path}`,error);
    loaded.delete(path);
  });
  loaded.set(path,task);
  return task;
}

function inspect(){
  if(!app)return;

  const admin=app.querySelector('.khung-quan-tri');
  if(admin){
    // Settings is useful for Master Admin but it must not participate in the
    // critical login/bootstrap path. Load it only after the admin shell exists.
    if(!settingsTimer&&!loaded.has('./settings.js')){
      settingsTimer=setTimeout(()=>{
        settingsTimer=null;
        if(app.querySelector('.khung-quan-tri'))load('./settings.js');
      },250);
    }

    const activeTab=app.querySelector('[data-action="admin-tab"].active')?.dataset.tab||'';
    const heading=app.querySelector('.noi-dung-quan-tri .tieu-de-trang h1')?.textContent?.trim()||'';
    if(activeTab==='teachers'||heading==='Giáo viên & tài khoản'||heading==='Danh sách người dùng')load('./users/bootstrap.js');
    if(activeTab==='bank'||heading==='Ngân hàng câu hỏi')load('./question-groups/bootstrap.js');
  }

  if(app.querySelector('.thi'))load('./question-groups/bootstrap.js');
  if(app.querySelector('#pickerList'))load('./question-groups/picker.js');
}

function schedule(){
  if(frame)return;
  frame=requestAnimationFrame(()=>{
    frame=0;
    inspect();
  });
}

if(app)new MutationObserver(schedule).observe(app,{childList:true});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-action="admin-tab"],[data-action="open-bank-picker"]'))setTimeout(schedule,0);
},true);

schedule();
