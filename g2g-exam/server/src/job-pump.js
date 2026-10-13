// Reserve each slot before awaiting the claim: overlapping timer/completion
// ticks must never exceed the configured provider concurrency.
export function createJobPump({claim,processJob,concurrency=3,onError=()=>{}}){
  let active=0,claiming=false,stopped=false;
  const tick=async()=>{
    if(stopped||claiming)return;
    claiming=true;
    try{
      while(!stopped&&active<concurrency){
        active++;
        let job;
        try{job=await claim();}catch(error){active--;throw error;}
        if(!job){active--;break;}
        void Promise.resolve().then(()=>processJob(job)).catch(onError).finally(()=>{active--;void tick();});
      }
    }catch(error){onError(error);}finally{claiming=false;}
  };
  return {tick,stop(){stopped=true;},get active(){return active;}};
}
