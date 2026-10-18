// SameSite cookies are defense in depth, not a substitute for checking the
// browser Origin of credentialed writes (including same-site sibling origins).
export function requestOriginPolicy({production=false,publicUrl='http://localhost:8080',origins=''}={}){
  const configured=String(origins).split(',').map(value=>value.trim()).filter(Boolean);
  const allowed=new Set(configured);
  allowed.add(new URL(publicUrl).origin);
  const allows=origin=>!origin||(origin!=='null'&&(allowed.has(origin)||(!production&&!configured.length)));
  return {allows,guard(request){
    if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&!allows(request.headers.origin)){
      throw Object.assign(new Error('Nguồn yêu cầu không được phép.'),{statusCode:403});
    }
  }};
}
