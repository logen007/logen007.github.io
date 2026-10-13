// Poll the lightweight queue only while its dashboard is visible. Reserve the
// in-flight slot and recheck ownership after awaiting a response.
export function startDashboardRefresh({isActive,refresh,onResult,onError=()=>{},intervalMs=5000}){
  let busy=false,stopped=false;
  const tick=async()=>{
    if(stopped||busy||document.hidden||!isActive())return;
    busy=true;
    try{const result=await refresh();if(!stopped&&!document.hidden&&isActive())onResult(result);}
    catch(error){if(!stopped&&isActive())onError(error);}finally{busy=false;}
  };
  const timer=setInterval(()=>void tick(),intervalMs);
  const visible=()=>void tick();document.addEventListener('visibilitychange',visible);
  return {tick,stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}
