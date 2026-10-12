// Presentation only: stored names remain the keys for specs, answers and scores.
export function sectionLabel(exam,section){
  const name=String(section?.name||'');
  if(String(exam?.provider).toUpperCase()==='TELC'&&['B1','B2'].includes(exam?.level)){
    if(name==='Đọc 4')return 'SB 1';
    if(name==='Đọc 5')return 'SB 2';
  }
  return name;
}
