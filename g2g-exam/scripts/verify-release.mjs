import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only; never called automatically by CI or the deployment timer.
export async function verifyRelease(base,version,{fetchImpl=fetch}={}){
  const url=new URL(base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Supply an HTTP(S) origin without credentials, path or query.');
  if(!/^\d+\.\d+\.\d+$/.test(version||''))throw Error('Supply the exact expected major.minor.patch version.');
  const read=async pathname=>{
    const response=await fetchImpl(new URL(pathname,url),{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error(`Release probe HTTP failure at ${pathname}: ${response.status}`);
    try{return await response.json();}catch{throw Error(`Release probe received invalid JSON at ${pathname}`);}
  };
  const health=await read('/api/health');
  if(health.ok!==true||health.database!==true||health.backend!=='vps')throw Error('Application/database health failed, even if HTTP status was 200.');
  const current=await read('/api/version');
  if(current.version!==version)throw Error('Running version differs from the expected release.');
  return {ok:true,version,scope:'HTTP health + database flag + version only; not login, visual or commit-SHA proof'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [url,version,...extra]=process.argv.slice(2);
  if(!url||!version||extra.length){console.error('Usage: node scripts/verify-release.mjs <explicit-origin> <expected-version>');process.exitCode=1;}
  else try{console.log(JSON.stringify(await verifyRelease(url,version)));}catch(error){console.error(error.message);process.exitCode=1;}
}
