import {createMediaDelivery} from './src/ui/media-fallback.js';
const deliver=createMediaDelivery();
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!/^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(url.pathname))return;
  event.respondWith(deliver(event.request));
});
