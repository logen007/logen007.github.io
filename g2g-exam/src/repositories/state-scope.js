export function initialStateScope(user,href=globalThis.location?.href){
  const params=new URL(href||'https://local.invalid/').searchParams;
  if(params.has('edit')||params.has('preview')||params.has('view'))return 'full';
  if(user?.role==='student')return 'catalog';
  return (params.get('tab')||(user?.role==='master'?'dashboard':'exams'))==='exams'?'catalog':'full';
}

export function viewStateScope(view,tab){
  return view==='student-home'||(view==='admin'&&tab==='exams')?'catalog':'full';
}
