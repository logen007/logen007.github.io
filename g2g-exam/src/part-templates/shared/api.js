const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');

export async function templateRequest(path,{method='GET',body,form}={}){
  const options={method,credentials:'include',headers:{}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body);}
  if(form)options.body=form;
  const response=await fetch(`${API}${path}`,options);
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data?.error||`Máy chủ trả về lỗi ${response.status}.`);
  return data;
}

export async function uploadTemplateMedia(kind,file){
  if(!file)return '';
  const form=new FormData();form.append('file',file,file.name||kind);
  const data=await templateRequest(`/media/${kind}`,{method:'POST',form});
  return data.url||'';
}
