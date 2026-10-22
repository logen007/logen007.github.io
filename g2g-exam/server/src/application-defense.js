import {performance} from 'node:perf_hooks';

// Per-process budgets, shared by all routes in a class (not one bucket per URL).
export const DEFENSE_BUDGETS=Object.freeze({
  api:Object.freeze({capacity:600,perSecond:20}),
  auth:Object.freeze({capacity:60,perSecond:1}),
  upload:Object.freeze({capacity:40,perSecond:1}),
  page:Object.freeze({capacity:600,perSecond:10}),
});
export function requestLogPath(url){return String(url||'').split(/[?#]/,1)[0].slice(0,2048);}
function profile(request){
  const pathname=requestLogPath(request.routeOptions?.url||request.raw?.url||request.url);
  const rawPath=requestLogPath(request.raw?.url||request.url);
  if(request.method==='OPTIONS')return null;
  if(pathname.startsWith('/api/auth/'))return 'auth';
  if(pathname.startsWith('/api/media/')||pathname.startsWith('/api/demo/media/'))return 'upload';
  if(pathname.startsWith('/api/')||rawPath.startsWith('/api/'))return 'api';
  // Keep normal bundles, fonts and exam media outside the HTML quota. Random
  // fallback/scan URLs share the page budget rather than minting per-path buckets.
  if(/^\/(?:assets|src|specs|uploads|shared-exam-images|fonts)\//.test(rawPath)||['/favicon.ico','/styles.css','/enhancements.css'].includes(rawPath))return null;
  return 'page';
}
function spend(bucket,rule,now){
  const elapsed=Math.max(0,now-bucket.at);bucket.at=Math.max(bucket.at,now);
  bucket.tokens=Math.min(rule.capacity,bucket.tokens+elapsed*rule.perSecond/1000);
  if(bucket.tokens<1)return Math.max(1,Math.ceil((1-bucket.tokens)/rule.perSecond));
  bucket.tokens-=1;return 0;
}
export function createRequestDefense({now=()=>performance.now(),maxEntries=10000,budgets=DEFENSE_BUDGETS}={}){
  if(!Number.isInteger(maxEntries)||maxEntries<1)throw Error('Invalid defense entry limit.');
  const clients=new Map(),pageClients=new Map(),overflow=new Map(),aggregate={tokens:2400,at:now()},pages={tokens:1200,at:now()};
  let sweepAt=now()+60000;
  const aggregateRule={capacity:2400,perSecond:200};
  const pageRule={capacity:1200,perSecond:100};
  return {get size(){return clients.size+pageClients.size;},check(request){
    const kind=profile(request);if(!kind)return {allowed:true};
    const time=now();
    if(time>=sweepAt){
      for(const table of [clients,pageClients])for(const [key,bucket]of table)if(time-bucket.at>=600000)table.delete(key);
      sweepAt=time+60000;
    }
    const isPage=kind==='page';
    const globalWait=spend(isPage?pages:aggregate,isPage?pageRule:aggregateRule,time);
    if(globalWait)return {allowed:false,retryAfter:globalWait,scope:isPage?'page_aggregate':'aggregate'};
    const rule=budgets[kind];
    const key=kind+':'+String(request.ip||'unknown').slice(0,64);
    const table=isPage?pageClients:clients;
    let bucket=table.get(key);
    if(!bucket){
      // Churning client identifiers cannot evict existing budgets or grow memory.
      if(table.size>=maxEntries){
        bucket=overflow.get(kind);if(!bucket){bucket={tokens:rule.capacity,at:time};overflow.set(kind,bucket);}
      }else{bucket={tokens:rule.capacity,at:time};table.set(key,bucket);}
    }
    const wait=spend(bucket,rule,time);
    return wait?{allowed:false,retryAfter:wait,scope:kind}:{allowed:true};
  }};
}
export function registerApplicationDefense(app,{limiter=createRequestDefense()}={}){
  const counts=new Map();let reportAt=0;
  app.addHook('onRequest',async(request,reply)=>{
    const result=limiter.check(request);if(result.allowed)return;
    const count=(counts.get(result.scope)||0)+1;counts.set(result.scope,count);
    // Aggregate-only operational signal, no IPs, query tokens or request bodies.
    const time=Date.now();if(time>=reportAt){
      app.log.warn({event:'request_rate_limited',counts:Object.fromEntries(counts)},'Traffic budget exceeded; not proof of an attack.');
      counts.clear();reportAt=time+60000;
    }
    return reply.code(429).header('Retry-After',String(result.retryAfter))
      .header('Cache-Control','no-store').send({error:'Quá nhiều yêu cầu. Vui lòng thử lại sau.',code:429});
  });
  app.addHook('onSend',async(_request,reply,payload)=>{
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Referrer-Policy','strict-origin-when-cross-origin');
    reply.header('X-Frame-Options','DENY');
    // Deliberately not a full script policy: Google login/Picker and existing
    // inline scripts need a separate nonce/hash rollout and compatibility proof.
    if(!reply.hasHeader('Content-Security-Policy'))reply.header('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
    return payload;
  });
}
