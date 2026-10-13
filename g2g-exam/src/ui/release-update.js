import {APP_VERSION} from '../release.js';

export function createReleaseCheck({readVersion,canReload,applyUpdate,current=APP_VERSION}){
  let busy=false,applied=false;
  return async()=>{
    if(busy||applied)return;
    busy=true;
    try{
      const version=await readVersion();
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version)||version===current||!canReload())return;
      applied=true;
      if(await applyUpdate(version)===false)applied=false;
    }catch{ /* A failed check must not interrupt work or simulate an update. */ }
    finally{busy=false;}
  };
}

export function startReleaseMonitor({canReload}){
  const check=createReleaseCheck({canReload,readVersion:async()=>{
    const response=await fetch('/api/version',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)return null;
    return (await response.json()).version;
  },applyUpdate:async version=>{
    const notice=document.createElement('div');
    notice.className='release-update';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const indicator=document.createElement('span');indicator.className='release-update-spinner';indicator.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=`Đang cập nhật lên phiên bản ${version}…`;
    notice.append(indicator,label);document.body.append(notice);
    await new Promise(resolve=>setTimeout(resolve,900));
    // Recheck: the user may have opened an editor while the notice was visible.
    if(!canReload()){notice.remove();return false;}
    location.reload();
  }});
  let timer;
  const run=async()=>{clearTimeout(timer);if(document.hidden)return;await check();timer=setTimeout(run,300000);};
  document.addEventListener('visibilitychange',run);
  void run();
}
