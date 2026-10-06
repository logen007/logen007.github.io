const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');

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

export async function loadPublicSettings(){
  return request('/public-settings');
}

export async function loadPrivateSettings(){
  const [settings,infra]=await Promise.all([
    request('/settings'),
    request('/actions/getInfrastructureStatus',{method:'POST',body:{}}),
  ]);
  return {settings:settings.settings,infra};
}

export async function refreshInfrastructure(){
  return request('/actions/getInfrastructureStatus',{method:'POST',body:{}});
}

export async function updateSystemSettings(settings){
  return request('/actions/updateSystemSettings',{method:'POST',body:{settings}});
}

export async function updateSmtpSecret(password){
  return request('/actions/updateSmtpSecret',{method:'POST',body:{password}});
}

export async function testSmtp(to){
  return request('/actions/testSmtp',{method:'POST',body:{to}});
}
