// SameSite cookies are defense in depth, not a substitute for checking the
// browser Origin of credentialed writes (including same-site sibling origins).
export function requestOriginPolicy({production=false,publicUrl='http://localhost:8080',origins=''}={}){
  const configured=String(origins).split(',').map(value=>value.trim()).filter(Boolean);
  const allowed=new Set(configured);
  allowed.add(new URL(publicUrl).origin);
  const allows=origin=>!origin||(origin!=='null'&&(allowed.has(origin)||(!production&&!configured.length)));
  return {allows,guard(request){
    if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return;
    const origin=request.headers.origin,site=request.headers['sec-fetch-site'];
    // An explicit trusted Origin is authoritative, including configured cross-site
    // integrations. Sibling subdomains are not implicitly trusted. When Origin is
    // absent, do not ignore a browser's cross-origin/unknown context signal.
    // Legacy/non-browser clients with neither header keep the existing contract;
    // metadata is defense in depth, not authentication for those clients.
    const invalidOrigin=origin!==undefined&&(!origin||!allows(origin));
    const untrustedContext=production&&origin===undefined&&site!==undefined&&!['same-origin','none'].includes(site);
    if(invalidOrigin||untrustedContext){
      throw Object.assign(new Error('Nguồn yêu cầu không được phép.'),{statusCode:403});
    }
  }};
}
