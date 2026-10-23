export function bindExamQuestionSidebar(root,view=window){
  const sidebar=root.querySelector('[data-exam-question-sidebar]');
  if(!sidebar)return ()=>{};
  const toggle=sidebar.querySelector('[data-exam-question-sidebar-toggle]');
  const number=sidebar.querySelector('[data-exam-question-sidebar-current]');
  const links=[...sidebar.querySelectorAll('[data-question-jump]')];
  const controls=[...root.querySelectorAll('[data-q]')];
  const entries=links.map(link=>{
    const nodes=controls.filter(node=>node.dataset.q===link.dataset.questionJump);
    const node=nodes.find(node=>node.matches('.cau-thi'))||nodes[0];
    const target=node?.closest('.cau-thi,.heading-match-question,.letter-question,.inline-gap,td')||node;
    return {link,target,number:link.textContent.trim()};
  }).filter(entry=>entry.target);
  let current=entries[0],chosen=null,frame=null,numberAnimation=null;
  const showNumber=value=>{
    if(!number||number.textContent===value)return;
    const direction=Number(value)>Number(number.textContent)?1:-1;
    numberAnimation?.cancel();numberAnimation=null;number.textContent=value;
    if(number.animate&&!view.matchMedia('(prefers-reduced-motion: reduce)').matches)
      numberAnimation=number.animate([{transform:`translateY(${direction*50}%)`,opacity:.5},{transform:'translateY(0)',opacity:1}],{duration:100,easing:'ease-out'});
  };
  const setOpen=open=>{
    sidebar.classList.toggle('is-open',open);
    toggle?.setAttribute('aria-expanded',String(open));
    toggle?.setAttribute('aria-label',`${open?'Đóng':'Mở'} danh sách câu hỏi, câu ${current?.number||1}`);
  };
  const setCurrent=entry=>{
    current=entry;
    showNumber(entry.number);
    for(const item of entries){
      item.link.classList.toggle('is-current',item===entry);
      if(item===entry)item.link.setAttribute('aria-current','true');
      else item.link.removeAttribute('aria-current');
    }
    toggle?.setAttribute('aria-label',`${sidebar.classList.contains('is-open')?'Đóng':'Mở'} danh sách câu hỏi, câu ${entry.number}`);
  };
  const update=()=>{
    frame=null;
    const visible=entries.map(entry=>({entry,rect:entry.target.getBoundingClientRect()}))
      .filter(({rect})=>rect.height>0&&rect.bottom>0&&rect.top<view.innerHeight);
    if(!visible.length)return;
    // Several inline gaps can share a row. Preserve an explicit choice on that row.
    const covering=visible.filter(({rect})=>rect.top<=96&&rect.bottom>96);
    const closest=covering.at(-1)||visible.reduce((best,item)=>Math.abs(item.rect.top-96)<Math.abs(best.rect.top-96)?item:best);
    const active=visible.find(item=>item.entry===current);
    const selected=visible.find(item=>item.entry===chosen);
    const atEnd=view.scrollY+view.innerHeight>=root.ownerDocument.documentElement.scrollHeight-2;
    setCurrent(selected&&(Math.abs(selected.rect.top-closest.rect.top)<4||atEnd)?selected.entry:active&&Math.abs(active.rect.top-closest.rect.top)<4?active.entry:closest.entry);
  };
  const schedule=()=>{if(frame===null)frame=view.requestAnimationFrame(update);};
  const finish=()=>schedule();
  const interrupt=()=>{chosen=null;finish();};
  const toggleOpen=()=>setOpen(!sidebar.classList.contains('is-open'));
  const jump=event=>{
    const link=event.target.closest('[data-question-jump]');
    if(!link||!sidebar.contains(link))return;
    const entry=entries.find(item=>item.link===link);if(!entry)return;
    event.preventDefault();event.stopPropagation();
    chosen=entry;
    if(view.matchMedia('(max-width:680px)').matches)setOpen(false);
    const top=Math.max(0,view.scrollY+entry.target.getBoundingClientRect().top-96);
    view.scrollTo({top,behavior:view.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    schedule();
  };
  toggle?.addEventListener('click',toggleOpen);
  sidebar.addEventListener('click',jump);
  view.addEventListener('scroll',schedule,{passive:true});
  view.addEventListener('scrollend',finish);
  view.addEventListener('resize',schedule);
  view.addEventListener('wheel',interrupt,{passive:true});
  view.addEventListener('touchstart',interrupt,{passive:true});
  const observer=typeof view.ResizeObserver==='function'?new view.ResizeObserver(schedule):null;
  const paper=root.querySelector('.exam-paper--live');if(paper)observer?.observe(paper);
  update();
  return ()=>{
    toggle?.removeEventListener('click',toggleOpen);sidebar.removeEventListener('click',jump);
    view.removeEventListener('scroll',schedule);view.removeEventListener('scrollend',finish);
    view.removeEventListener('resize',schedule);view.removeEventListener('wheel',interrupt);
    view.removeEventListener('touchstart',interrupt);observer?.disconnect();
    if(frame!==null)view.cancelAnimationFrame(frame);
    numberAnimation?.cancel();
    if(number)number.textContent=current?.number||'1';
  };
}
