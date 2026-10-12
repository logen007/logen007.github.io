export function initialStateScope(user,href=globalThis.location?.href){
  const params=new URL(href||'https://local.invalid/').searchParams;
  if(params.has('edit')||params.has('preview')||params.has('view'))return 'full';
  if(user?.role==='student')return 'catalog';
  return ['exams','settings'].includes(params.get('tab')||(user?.role==='master'?'dashboard':'exams'))?'catalog':'full';
}

export function viewStateScope(view,tab){
  return view==='student-home'||(view==='admin'&&['exams','settings'].includes(tab))?'catalog':'full';
}
