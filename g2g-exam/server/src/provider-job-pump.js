import {createJobPump} from './job-pump.js';

// One independent slot per configured provider; all lanes claim from one queue.
export function createProviderJobPump({getProviders,hasWork=async()=>true,claim,processJob,onError=()=>{},clock=Date.now,spacingMs=2000}){
  const lanes=new Map();let stopped=false,refreshing=null;
  const tick=()=>{
    if(stopped)return Promise.resolve();
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const providers=await getProviders();
      if(stopped)return;
      for(const lane of lanes.values())lane.enabled=false;
      for(const {id,version} of providers){
        let lane=lanes.get(id);
        if(!lane){
          lane={enabled:true,version,availableAt:0,error:null};
          lane.pump=createJobPump({concurrency:1,
            claim:()=>!stopped&&lane.enabled&&clock()>=lane.availableAt?claim(id):null,
            processJob:async job=>{
              const startedVersion=lane.version;
              try{
                const result=await processJob(job,id);
                if(lane.version===startedVersion){
                  lane.availableAt=clock()+Math.max(spacingMs,result?.cooldownMs||0);
                  lane.error=result?.error||null;
                }
              }catch(error){
                lane.availableAt=clock()+15000;lane.error='Luồng chấm tạm gián đoạn.';throw error;
              }
            },onError});
          lanes.set(id,lane);
        }
        if(lane.version!==version){lane.availableAt=0;lane.error=null;lane.version=version;}
        lane.enabled=true;
      }
      if(!providers.length||!await hasWork())return;
      // Start in configured preference order while keeping every lane available.
      for(const {id} of providers)await lanes.get(id).pump.tick();
    })().catch(onError).finally(()=>{refreshing=null;});
    return refreshing;
  };
  return {tick,stop(){stopped=true;for(const lane of lanes.values())lane.pump.stop();},
    status:()=>[...lanes].filter(([,lane])=>lane.enabled).map(([id,lane])=>({id,active:lane.pump.active>0,retryAt:lane.availableAt>clock()?new Date(lane.availableAt).toISOString():null,error:lane.error}))};
}
