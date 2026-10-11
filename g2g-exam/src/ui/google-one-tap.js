let loading=null,active=false,generation=0,suppressed=false;
const api=()=>String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
function loadGoogle(){
  if(globalThis.google?.accounts?.id)return Promise.resolve();
  if(!loading)loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=resolve;script.onerror=()=>reject(new Error('Google unavailable'));
    document.head.append(script);
  });
  return loading;
}
export function stopGoogleOneTap({logout=false}={}){
  generation++;active=false;
  globalThis.google?.accounts?.id?.cancel();
  if(logout){suppressed=true;globalThis.google?.accounts?.id?.disableAutoSelect();}
}
export async function startGoogleOneTap({onError=()=>{}}={}){
  if(active||suppressed)return;
  active=true;const current=++generation;
  try{
    const response=await fetch(api()+'/auth/google/one-tap',{credentials:'include'});
    if(!response.ok)return;
    const config=await response.json();
    if(!config.enabled||current!==generation)return;
    await loadGoogle();
    if(current!==generation||!document.getElementById('googleLogin'))return;
    let submitting=false;
    google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,auto_select:false,
      callback:async result=>{
        if(submitting||current!==generation||!result.credential)return;
        submitting=true;
        try{
          const res=await fetch(api()+'/auth/google/one-tap',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({credential:result.credential,return:location.pathname+location.search+location.hash})});
          const data=await res.json();
          if(!res.ok)throw new Error(data.error||'Không đăng nhập được bằng Google.');
          const destination=new URL(data.returnTo,location.origin);
          if(destination.origin!==location.origin)throw new Error('Đường dẫn đăng nhập không hợp lệ.');
          location.assign(destination.href);
        }catch(error){submitting=false;onError(error.message);}
      }});
    google.accounts.id['prompt']();
  }catch{/* The existing login button remains available if Google is blocked. */}
}
