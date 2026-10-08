export function homeForRole(role){
  return role==='master'?'/adm':role==='teacher'?'/teacher':'/student';
}

// Only application pages are valid post-login destinations, never external/API URLs.
export function loginReturnPath(value,role){
  const home=homeForRole(role);
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return home;
  try{
    const url=new URL(value,'https://g2g.invalid');
    if(url.origin!=='https://g2g.invalid'||!['/','/adm','/teacher','/student'].includes(url.pathname))return home;
    if(role==='student')return home;
    return home+url.search+url.hash;
  }catch{return home;}
}
