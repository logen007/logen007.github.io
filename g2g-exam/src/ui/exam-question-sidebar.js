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
  let current=entries[0],pending=null,chosen=null,frame=null,settle=null;
  let numberFrame=null,numberValue=Number(number?.textContent)||1,numberTarget=null;
  const showNumber=value=>{
    if(!number||numberTarget===Number(value))return;
    numberTarget=Number(value);
    if(numberFrame!==null)view.cancelAnimationFrame(numberFrame);
    numberFrame=null;
    const document=number.ownerDocument||root.ownerDocument;
    if(numberValue===numberTarget||!document?.createElement||view.matchMedia('(prefers-reduced-motion: reduce)').matches){
      numberValue=numberTarget;number.textContent=String(numberTarget);return;
    }
    const from=numberValue,to=numberTarget,track=document.createElement('span');
    const first=document.createElement('span'),second=document.createElement('span');
    track.className='exam-question-number-track';
    first.className=second.className='exam-question-number-digit';
    track.appendChild(first);track.appendChild(second);
    number.setAttribute('aria-hidden','true');number.replaceChildren(track);
    const draw=value=>{
      const base=Math.floor(value);
      first.textContent=String(base);second.textContent=String(base+1);
      track.style.transform=`translateY(${-(value-base)*50}%)`;
    };
    let started=null;
    const tick=time=>{
      numberFrame=null;
      if(started===null)started=time;
      const progress=view.matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(time-started)/240);
      numberValue=from+(to-from)*(1-(1-progress)**3);
      if(progress===1){numberValue=to;number.textContent=String(to);return;}
      draw(numberValue);numberFrame=view.requestAnimationFrame(tick);
    };
    draw(from);numberFrame=view.requestAnimationFrame(tick);
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
    if(pending)return;
    const visible=entries.map(entry=>({entry,rect:entry.target.getBoundingClientRect()}))
      .filter(({rect})=>rect.height>0&&rect.bottom>0&&rect.top<view.innerHeight);
    if(!visible.length)return;
    // Several inline gaps can share a row. Preserve an explicit choice on that row.
    const covering=visible.filter(({rect})=>rect.top<=96&&rect.bottom>96);
    const closest=covering.at(-1)||visible.reduce((best,item)=>Math.abs(item.rect.top-96)<Math.abs(best.rect.top-96)?item:best);
    const active=visible.find(item=>item.entry===current);
    const atEnd=view.scrollY+view.innerHeight>=root.ownerDocument.documentElement.scrollHeight-2;
    setCurrent(active&&(Math.abs(active.rect.top-closest.rect.top)<4||atEnd&&active.entry===chosen)?active.entry:closest.entry);
  };
  const schedule=()=>{if(frame===null)frame=view.requestAnimationFrame(update);};
  const finish=()=>{pending=null;view.clearTimeout(settle);schedule();};
  const interrupt=()=>{chosen=null;finish();};
  const toggleOpen=()=>setOpen(!sidebar.classList.contains('is-open'));
  const jump=event=>{
    const link=event.target.closest('[data-question-jump]');
    if(!link||!sidebar.contains(link))return;
    const entry=entries.find(item=>item.link===link);if(!entry)return;
    event.preventDefault();event.stopPropagation();
    view.clearTimeout(settle);chosen=entry;pending=entry;setCurrent(entry);
    if(view.matchMedia('(max-width:680px)').matches)setOpen(false);
    const top=Math.max(0,view.scrollY+entry.target.getBoundingClientRect().top-96);
    view.scrollTo({top,behavior:view.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    settle=view.setTimeout(finish,1200);
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
    view.clearTimeout(settle);if(frame!==null)view.cancelAnimationFrame(frame);
    if(numberFrame!==null)view.cancelAnimationFrame(numberFrame);
    if(number)number.textContent=current?.number||'1';
  };
}
