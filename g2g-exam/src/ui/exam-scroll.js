export function scrollExamToTop(target=window){
  target.scrollTo({top:0,left:0,behavior:target.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
