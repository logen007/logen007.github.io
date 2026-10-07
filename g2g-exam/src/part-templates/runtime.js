import {templateRequest} from './shared/api.js';
import {hasPartTemplate,mountPartTemplateStudent} from './index.js';

let busy=false;
async function mount(){
  if(busy)return;
  const examRoot=document.querySelector('.thi');if(!examRoot)return;
  busy=true;
  try{
    const state=await templateRequest('/state');
    const visibleIds=new Set([...examRoot.querySelectorAll('.cau-thi[data-q]')].map(node=>node.dataset.q));
    const types=[...new Set((state.questions||[]).filter(q=>visibleIds.has(q.id)&&q.groupType).map(q=>q.groupType))].filter(hasPartTemplate);
    for(const type of types)await mountPartTemplateStudent(type,{state,examRoot});
  }catch(error){console.error('Không nạp được Part runtime',error);}finally{busy=false;}
}
let frame=0;const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;mount();});};
new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
schedule();
