// Read the visible controls before saving or changing sections, including edits
// whose debounced autosave has not run yet.
export function readExamAnswers(root){
  const answers={};
  for(const input of root.querySelectorAll('.answer-one')){
    answers[input.dataset.q]??=null;
    if(input.checked)answers[input.dataset.q]=Number(input.value);
  }
  for(const input of root.querySelectorAll('.answer-match')){
    answers[input.dataset.q]??=[];
    answers[input.dataset.q][Number(input.dataset.i)]=input.value;
  }
  for(const input of root.querySelectorAll('.answer-text'))answers[input.dataset.q]=input.value;
  for(const input of root.querySelectorAll('.answer-form-field')){
    answers[input.dataset.q]??={};
    answers[input.dataset.q][input.dataset.fieldIndex]??='';
    if(input.type!=='radio'||input.checked)answers[input.dataset.q][input.dataset.fieldIndex]=input.value;
  }
  return answers;
}

export function revealUnansweredQuestion(root,questionId){
  const card=[...root.querySelectorAll('.cau-thi[data-q]')].find(item=>item.dataset.q===questionId);
  if(!card)return;
  card.classList.remove('is-unanswered');
  void card.offsetWidth;
  card.classList.add('is-unanswered');
  card.addEventListener('animationend',()=>card.classList.remove('is-unanswered'),{once:true});
  card.setAttribute('tabindex','-1');
  card.focus({preventScroll:true});
  card.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
}
