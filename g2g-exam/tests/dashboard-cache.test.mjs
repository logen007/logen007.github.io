import assert from 'node:assert/strict';
import {readDashboardCache,writeDashboardCache,clearDashboardCache,patchDashboard} from '../src/ui/dashboard-cache.js';
import {setInfrastructureOwner,readCachedInfrastructure,refreshInfrastructure,clearInfrastructureCache} from '../src/settings/api.js';
const saved={sessionStorage:globalThis.sessionStorage,fetch:globalThis.fetch};
const rows=new Map();
globalThis.sessionStorage={getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
try{
  writeDashboardCache('one',{users:[{id:'u',role:'student',email:'private'}],exams:[],attempts:[{id:'a',answers:{secret:'answer'}}]});
  assert.equal(readDashboardCache('one').value.users[0].email,undefined);
  assert.equal(readDashboardCache('one').value.attempts[0].answers,undefined);
  assert.equal(readDashboardCache('two'),null);
  clearDashboardCache();assert.equal(readDashboardCache('one'),null);
  let calls=0,resolve;
  globalThis.fetch=()=>{calls++;return new Promise(done=>resolve=()=>done({ok:true,json:async()=>({resources:{cpu:1}})}));};
  setInfrastructureOwner('one');
  const first=refreshInfrastructure({summaryOnly:false}),second=refreshInfrastructure({summaryOnly:false});
  assert.equal(calls,1);resolve();await Promise.all([first,second]);
  assert.equal(readCachedInfrastructure().resources.cpu,1);
  await refreshInfrastructure({summaryOnly:false});assert.equal(calls,1,'Fresh cache avoids a second reload request');
  setInfrastructureOwner('two');assert.equal(readCachedInfrastructure(),null);
  clearInfrastructureCache();setInfrastructureOwner('one');assert.equal(readCachedInfrastructure(),null);
  let writes=0;
  patchDashboard({isEqualNode:()=>true,replaceWith:()=>writes++},{});
  assert.equal(writes,0,'Unchanged dashboard nodes remain untouched');
  const text={nodeType:3,nodeName:'#text',nodeValue:'old',isEqualNode:()=>false};
  patchDashboard(text,{nodeType:3,nodeName:'#text',nodeValue:'new'});
  assert.equal(text.nodeValue,'new');
}finally{Object.assign(globalThis,saved);clearInfrastructureCache();}
console.log('Dashboard cache: owner isolation, private-field exclusion, logout, request deduplication, freshness and unchanged-node preservation passed.');
