// Poll the lightweight queue only while its dashboard is visible. Reserve the
// in-flight slot and recheck ownership after awaiting a response.
export function startDashboardRefresh({isActive,refresh,onResult,onError=()=>{},intervalMs=5000,idleIntervalMs=30000,now=Date.now}){
  let busy=false,stopped=false,nextAt=0;
  const tick=async()=>{
    if(stopped||busy||document.hidden||!isActive()||now()<nextAt)return;
    busy=true;
    try{const result=await refresh();const working=Object.entries(result?.jobs||{}).some(([status,job])=>!['completed','failed','cancelled'].includes(status)&&Number(job.count)>0);nextAt=now()+(working?intervalMs:idleIntervalMs);if(!stopped&&!document.hidden&&isActive())onResult(result);}
    catch(error){nextAt=now()+idleIntervalMs;if(!stopped&&isActive())onError(error);}finally{busy=false;}
  };
  const timer=setInterval(()=>void tick(),intervalMs);
  const visible=()=>void tick();document.addEventListener('visibilitychange',visible);
  return {tick,stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}
