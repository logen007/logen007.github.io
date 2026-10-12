// Move the existing nodes, keeping answers, audio and input listeners intact.
export function responsiveStimuli(container){
  const columns=[...container.children],groups=columns.map(column=>[...column.children]);
  let mobile=false;
  return narrow=>{
    if(narrow===mobile)return;
    mobile=narrow;
    if(narrow){
      container.replaceChildren(...groups.flat().sort((a,b)=>Number(a.dataset.stimulusOrder)-Number(b.dataset.stimulusOrder)));
    }else{
      columns.forEach((column,i)=>column.replaceChildren(...groups[i]));
      container.replaceChildren(...columns);
    }
  };
}
// Let the shorter column follow the page without a second scrollbar.
export function bindSplitReading(root,view=window){
  const arrangements=[...root.querySelectorAll('[data-responsive-stimuli]')].map(responsiveStimuli);
  const pairs=[...root.querySelectorAll('.exam-reading-split')].map(el=>[...el.children].slice(0,2)).filter(pair=>pair.length===2);
  if(!pairs.length)return ()=>{};
  const clear=el=>{el.classList.remove('split-follow');el.style.removeProperty('--split-top');};
  const refresh=()=>{
    arrangements.forEach(arrange=>arrange(view.innerWidth<=760));
    for(const pair of pairs){
      const heights=pair.map(el=>el.getBoundingClientRect().height);
      const shorter=Math.abs(heights[0]-heights[1])<1?-1:heights[0]<heights[1]?0:1;
      pair.forEach((el,i)=>{
        if(view.innerWidth<=760||i!==shorter){clear(el);return;}
        el.style.setProperty('--split-top',Math.min(16,view.innerHeight-heights[i]-16)+'px');
        el.classList.add('split-follow');
      });
    }
  };
  const observer=new view.ResizeObserver(refresh);
  pairs.flat().forEach(el=>observer.observe(el));
  view.addEventListener('resize',refresh);
  refresh();
  return ()=>{observer.disconnect();view.removeEventListener('resize',refresh);pairs.flat().forEach(clear);arrangements.forEach(arrange=>arrange(false));};
}
