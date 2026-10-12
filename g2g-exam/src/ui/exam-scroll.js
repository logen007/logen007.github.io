export function scrollExamToTop(target=window,root=document){
  const paper=root.querySelector('.noi-dung-thi');
  if(!paper)return;
  paper.scrollIntoView({block:'start',behavior:target.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
