import {startDashboardRefresh} from '../ui/dashboard-refresh.js';
import {isPhone} from './model.js';
import {speakingApi} from './api.js';

export function startSpeakingArrival({getUser,canEnter,navigate=url=>location.assign(url),storage,now=Date.now}){
 if(storage===undefined)try{storage=globalThis.sessionStorage;}catch{storage=null;}
 const seen=new Set();
 const monitor=startDashboardRefresh({intervalMs:10000,idleIntervalMs:10000,now,
  isActive:()=>!!getUser()?.id&&isPhone(navigator.userAgent)&&canEnter(),
  refresh:async()=>{const owner=getUser()?.id;return {owner,...await speakingApi('arrival')};},
  onResult:result=>{
   if(result.owner!==getUser()?.id||!canEnter()||!/^[a-f0-9-]{36}$/.test(result.id||''))return;
   const key='g2g-speaking-arrival:'+result.owner+':'+result.id;
   if(seen.has(key))return;
   try{if(storage?.getItem(key))return;}catch{/* Memory guard still prevents repeated redirects. */}
   seen.add(key);try{storage?.setItem(key,'1');}catch{}
   navigate('/speaking-lab.html?session='+encodeURIComponent(result.id));
  }
 });
 monitor.tick();return monitor;
}
