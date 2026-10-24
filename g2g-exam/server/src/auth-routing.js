export function homeForRole(role){
  return role==='master'?'/adm':role==='teacher'?'/teacher':'/student';
}

// Only application pages are valid post-login destinations, never external/API URLs.
export function loginReturnPath(value,role){
  const home=homeForRole(role);
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return home;
  try{
    const url=new URL(value,'https://g2g.invalid');
    if(url.origin==='https://g2g.invalid'&&url.pathname==='/speaking-lab.html'&&/^[a-f0-9-]{36}$/.test(url.searchParams.get('session')||''))return '/speaking-lab.html?session='+encodeURIComponent(url.searchParams.get('session'));
    if(url.origin!=='https://g2g.invalid'||!['/','/adm','/teacher','/student'].includes(url.pathname))return home;
    if(role==='student'){
      const page=url.searchParams.get('speaking-page'),idKey=page==='queue'?'speaking-exam':'speaking-session',id=url.searchParams.get(idKey)||'';
      if(url.searchParams.get('view')==='speaking-exams'&&['queue','session','results'].includes(page)&&
        (page==='results'||/^[a-zA-Z0-9_-]{1,120}$/.test(id))){
        const params=new URLSearchParams({view:'speaking-exams','speaking-page':page});
        if(page!=='results')params.set(idKey,id);
        return home+'?'+params;
      }
      return home;
    }
    return home+url.search+url.hash;
  }catch{return home;}
}
