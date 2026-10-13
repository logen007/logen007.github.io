import os from 'node:os';
import {query} from './db.js';
import {sampleCpu} from './cpu-metrics.js';
import {r2Settings} from './r2-settings.js';

export function startMonitorHistory(logger){
  let busy=false,stopped=false;
  const collect=async()=>{
    if(busy||stopped)return;
    busy=true;
    try{
      const cpu=await sampleCpu(),r2=r2Settings.status();
      await query('INSERT INTO monitor_samples(cpu,memory,r2_bytes,r2_error) VALUES($1,$2,$3,$4)',
        [cpu.usagePercent,(os.totalmem()-os.freemem())/os.totalmem()*100,r2?.syncedBytes??null,Boolean(r2?.error)]);
      await query("DELETE FROM monitor_samples WHERE sampled_at < now()-interval '366 days'");
    }catch(error){logger.error(error,'Monitor sample failed');}finally{busy=false;}
  };
  void collect();
  const timer=setInterval(collect,60000);timer.unref();
  return ()=>{stopped=true;clearInterval(timer);};
}

export async function monitorHistory(){
  const end=Date.now();
  const ranges=await Promise.all([[1,60],[24,60],[168,1800],[720,3600],[8760,86400]].map(async([hours,bucket])=>{
    const rows=await query(`SELECT max(sampled_at) AS at,avg(cpu) AS cpu,max(cpu) AS maximum,min(cpu) AS minimum,count(cpu)::int AS samples,max(memory) AS memory,
      max(r2_bytes) AS r2, bool_or(r2_error) AS error FROM monitor_samples
      WHERE sampled_at >= to_timestamp($1) AND sampled_at <= to_timestamp($2)
      GROUP BY floor(extract(epoch from sampled_at)/$3) ORDER BY at`,
      [(end-hours*3600000)/1000,end/1000,bucket]);
    const sampled=rows.rows.filter(row=>Number(row.samples)>0),samples=sampled.reduce((sum,row)=>sum+Number(row.samples),0);
    const stats={maximum:samples?Math.max(...sampled.map(row=>Number(row.maximum))):null,minimum:samples?Math.min(...sampled.map(row=>Number(row.minimum))):null,average:samples?sampled.reduce((sum,row)=>sum+Number(row.cpu)*Number(row.samples),0)/samples:null,samples};
    return {hours,bucketSeconds:bucket,start:end-hours*3600000,end,points:rows.rows,stats};
  }));
  return ranges;
}
