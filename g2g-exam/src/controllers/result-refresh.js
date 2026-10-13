// One lightweight owner-only request, visible page only; no paper/answers polling.
export function startResultRefresh({isActive,getReview,refresh,onResult,onPublished,hidden=()=>document.hidden,interval=15000,now=Date.now}){
  let busy=false,stopped=false,nextAt=now()+interval;
  const tick=async()=>{
    if(stopped||busy||hidden()||!isActive()||now()<nextAt)return;
    const review=getReview(),id=review.attempt.id;busy=true;
    try{
      const next=await refresh(id);
      if(stopped||hidden()||!isActive()||getReview().attempt.id!==id)return;
      if(next.status==='published'){await onPublished(id);return;}
      if(JSON.stringify(next.provisional)!==JSON.stringify(getReview().provisional))onResult(next.provisional);
    }catch{/* Keep the last successful estimate; retry later. */}
    finally{busy=false;nextAt=now()+(getReview()?.provisional?.parts.some(p=>p.status==='pending')?interval:60000);}
  };
  const timer=setInterval(()=>void tick(),interval);
  const visible=()=>void tick();document.addEventListener('visibilitychange',visible);
  return {tick,stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}
