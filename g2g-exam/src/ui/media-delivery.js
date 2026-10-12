// Progressive enhancement: first visit / unsupported browsers keep using VPS.
// No app shell, API response, answer or session is stored in a service-worker cache.
export async function registerMediaDelivery(){
  if(!globalThis.isSecureContext||!navigator.serviceWorker)return;
  try{
    const response=await fetch('/api/media/config',{credentials:'same-origin'});
    if(!response.ok||!(await response.json()).enabled)return;
    await navigator.serviceWorker.register('/media-worker.js',{scope:'/',type:'module',updateViaCache:'none'});
  }catch{/* Media delivery must never prevent login or starting an exam. */}
}
