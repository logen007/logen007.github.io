import {createHash} from 'node:crypto';

// Cache authorized reads per identity, share concurrent loads, and invalidate
// on committed writes. TTL covers out-of-process changes; size is bounded.
export function createStateCache({revision=()=>0,ttlMs=60000,maxBytes=16*1024*1024,maxEntries=256}={}){
  const entries=new Map();let bytes=0;
  return async function read(key,load){
    const version=revision(),cached=entries.get(key);
    if(cached&&cached.version===version&&cached.expiresAt>Date.now())return cached.task;
    if(cached){bytes-=cached.bytes;entries.delete(key);}
    const entry={version,bytes:0,expiresAt:Date.now()+ttlMs};
    entry.task=Promise.resolve().then(load).then(state=>{
      const content=JSON.stringify({...state,revision:undefined});
      const result={...state,revision:createHash('sha256').update(content).digest('hex')};
      if(entries.get(key)===entry){entry.bytes=Buffer.byteLength(content);bytes+=entry.bytes;}
      while(bytes>maxBytes||entries.size>maxEntries){
        const oldest=entries.keys().next().value;if(oldest===undefined)break;
        bytes-=entries.get(oldest).bytes;entries.delete(oldest);
      }
      return result;
    }).catch(error=>{if(entries.get(key)===entry){bytes-=entry.bytes;entries.delete(key);}throw error;});
    entries.set(key,entry);return entry.task;
  };
}
