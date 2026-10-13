const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
const INFRASTRUCTURE_CACHE_KEY='g2g.infrastructure-cache.v1';
const INFRASTRUCTURE_CACHE_MS=2*60*1000;

function infrastructureStorage(){
  try{return globalThis.sessionStorage;}catch{return null;}
}

export function readCachedInfrastructure(){
  try{
    const cached=JSON.parse(infrastructureStorage()?.getItem(INFRASTRUCTURE_CACHE_KEY)||'null');
    return cached&&Date.now()-cached.at<INFRASTRUCTURE_CACHE_MS?cached.value:null;
  }catch{return null;}
}

function cacheInfrastructure(value){
  try{infrastructureStorage()?.setItem(INFRASTRUCTURE_CACHE_KEY,JSON.stringify({at:Date.now(),value}));}catch{}
  return value;
}

export function r2SettingsAction(action,data={}){
  return request('/actions/'+action,{method:'POST',body:data});
}

async function request(path,{method='GET',body}={}){
  const res=await fetch(`${API}${path}`,{
    method,
    credentials:'include',
    headers:body?{'content-type':'application/json'}:{},
    body:body?JSON.stringify(body):undefined,
  });
  let data={};
  try{data=await res.json();}catch{}
  if(!res.ok)throw new Error(data.error||`Lỗi ${res.status}`);
  return data;
}

let publicSettingsLoad;
export function loadPublicSettings(){
  if(!publicSettingsLoad)publicSettingsLoad=request('/public-settings').finally(()=>{publicSettingsLoad=null;});
  return publicSettingsLoad;
}

let settingsLoad;
export function loadPrivateSettings(){
  if(settingsLoad)return settingsLoad;
  settingsLoad=readPrivateSettings().finally(()=>{settingsLoad=null;});
  return settingsLoad;
}
async function readPrivateSettings(){
  const [settings,infra]=await Promise.all([
    request('/settings'),
    refreshInfrastructure().catch(()=>null),
  ]);
  return {settings:settings.settings,infra};
}

export async function refreshInfrastructure({summaryOnly=true}={}){
  const result=await request('/actions/getInfrastructureStatus',{method:'POST',body:{summaryOnly}});
  return summaryOnly?result:cacheInfrastructure(result);
}

export async function updateSystemSettings(settings){
  return request('/actions/updateSystemSettings',{method:'POST',body:{settings}});
}

export async function updateSmtpSecret(password){
  return request('/actions/updateSmtpSecret',{method:'POST',body:{password}});
}

export async function updateAiApiKey(provider,apiKey){
  return request('/actions/updateAiApiKey',{method:'POST',body:{provider,apiKey}});
}

export async function testSmtp(to){
  return request('/actions/testSmtp',{method:'POST',body:{to}});
}
