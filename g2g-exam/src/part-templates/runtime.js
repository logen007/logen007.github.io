import {hasPartTemplate,mountPartTemplateStudent} from './index.js';
const mounted=new WeakSet();
// The owning view supplies authorized state. Timer/answer DOM changes never
// fetch the question bank or mount a runtime a second time.
export async function mountExamRuntime({state,examRoot,saveAnswer}={}){
  if(!state||!examRoot||examRoot.classList.contains('thi--preview')||mounted.has(examRoot))return;
  mounted.add(examRoot);
  const visibleIds=new Set([...examRoot.querySelectorAll('.cau-thi[data-q]')].map(node=>node.dataset.q));
  const types=[...new Set((state.questions||[]).filter(q=>visibleIds.has(q.id)&&q.groupType).map(q=>q.groupType))].filter(hasPartTemplate);
  for(const type of types){
    if(!examRoot.isConnected)return;
    await mountPartTemplateStudent(type,{state,examRoot,saveAnswer});
  }
}
