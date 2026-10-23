export function initialStateScope(user,href=globalThis.location?.href){
  const params=new URL(href||'https://local.invalid/').searchParams;
  if(params.get('view')==='courses'||params.get('tab')==='courses')return 'catalog';
  if(user?.role==='student'&&['results','home'].includes(params.get('view')))return 'catalog';
  if(params.has('edit')||params.has('preview')||params.has('view'))return 'full';
  if(user?.role==='student')return 'catalog';
  if(['dashboard','grades'].includes(params.get('tab')||(user?.role==='master'?'dashboard':'exams')))return 'summary';
  return ['exams','settings','speaking'].includes(params.get('tab')||(user?.role==='master'?'dashboard':'exams'))?'catalog':'full';
}

export function viewStateScope(view,tab){
  if(view==='courses')return 'catalog';
  if(view==='admin'&&['dashboard','grades'].includes(tab))return 'summary';
  return ['student-home','student-results','student-attempt-detail'].includes(view)||(view==='admin'&&['exams','settings','speaking'].includes(tab))?'catalog':'full';
}

export function needsStateLoad(scope,current){
  return scope==='full'?['catalog','summary'].includes(current):scope==='catalog'?current!=='catalog':scope==='summary'&&current==='catalog';
}
