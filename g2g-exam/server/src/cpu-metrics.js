import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';

export function cpuUsagePercent(before,after){
  if(!before.length||before.length!==after.length)return null;
  let total=0,idle=0;
  for(let i=0;i<before.length;i++){
    for(const key of ['user','nice','sys','idle','irq']){
      const delta=after[i].times[key]-before[i].times[key];
      if(!Number.isFinite(delta)||delta<0)return null;
      total+=delta;
      if(key==='idle')idle+=delta;
    }
  }
  return total>0?Math.round((total-idle)/total*1000)/10:null;
}

let pending=null,cached=null,measuredAt=0;
export function sampleCpu(){
  if(cached&&Date.now()-measuredAt<5000)return Promise.resolve(cached);
  if(pending)return pending;
  pending=(async()=>{
    const before=os.cpus(),started=Date.now();
    await delay(1000);
    const after=os.cpus();
    measuredAt=Date.now();
    return cached={usagePercent:cpuUsagePercent(before,after),cores:after.length,
      sampleMilliseconds:measuredAt-started,measuredAt:new Date(measuredAt).toISOString(),
      loadAverage:os.loadavg().map(value=>Math.round(value*100)/100),scope:'host'};
  })().finally(()=>{pending=null;});
  return pending;
}
