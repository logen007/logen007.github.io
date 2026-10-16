export async function speakingApi(path='',body){
 const r=await fetch('/api/speaking-lab/'+path,{method:body===undefined?'GET':'POST',credentials:'include',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||`Lỗi ${r.status}`),{status:r.status});return data;
}
export const sessionLink=id=>new URL('/speaking-lab.html?session='+encodeURIComponent(id),location.origin).href;
