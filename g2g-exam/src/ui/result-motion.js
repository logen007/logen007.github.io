import {gradeBand} from '../domain/gradebook.js';
import {animateResultBadge} from './result-badge-motion.js';
const seen=new WeakSet();
export function animateResult(root,review){
  if(!review||seen.has(review))return;
  seen.add(review);
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof requestAnimationFrame!=='function')return;
  const page=root.querySelector('.result-page');
  if(!page)return;
  const stopMedals=Array.from(page.querySelectorAll('.result-medal'),animateResultBadge);
  const numbers=[];
  page.querySelectorAll('.result-stats strong,.result-bar-score strong,.result-donut strong').forEach(element=>{
    const node=element.firstChild;
    if(node?.nodeType!==3)return;
    const original=node.textContent,match=original.match(/^(\d+(?:\.\d+)?)(%?)$/);
    if(!match)return;
    const decimals=(match[1].split('.')[1]||'').length;
    numbers.push({node,original,value:Number(match[1]),suffix:match[2],decimals});
  });
  const bars=[...page.querySelectorAll('.result-track>span')];
  const grades=[...page.querySelectorAll('.result-bar')].flatMap(row=>{
    const badge=row.querySelector('.score-badge'),track=row.querySelector('.result-track');
    const score=row.querySelector('.result-bar-score strong');
    if(badge?.hasAttribute?.('data-fixed-assessment'))return [];
    const raw=score?.firstChild?.textContent||'',max=Number(score?.querySelector('small')?.textContent.replace('/', '').trim());
    if(!badge||!track||!raw.trim()||!Number.isFinite(Number(raw))||!(max>0))return [];
    return [{badge,track,value:Number(raw),max,decimals:(raw.split('.')[1]||'').length,label:badge.textContent,badgeClass:badge.className,trackClass:track.className}];
  });
  const donuts=[...page.querySelectorAll('.result-donut')].map(node=>({node,correct:node.style.getPropertyValue('--correct-angle'),wrong:node.style.getPropertyValue('--wrong-angle')}));
  const restore=()=>{
    grades.forEach(item=>{item.badge.textContent=item.label;item.badge.className=item.badgeClass;item.track.className=item.trackClass;});
    numbers.forEach(item=>item.node.textContent=item.original);
    bars.forEach(node=>{node.style.removeProperty('transform');node.style.removeProperty('transform-origin');});
    donuts.forEach(item=>{item.node.style.setProperty('--correct-angle',item.correct);item.node.style.setProperty('--wrong-angle',item.wrong);});
  };
  const paint=p=>{
    grades.forEach(item=>{
      const band=gradeBand(Number((item.value*p).toFixed(item.decimals)),item.max);
      if(!band)return;
      item.badge.textContent=band.label;
      item.badge.className='score-badge score-'+band.key;
      item.track.className='result-track result-track--'+band.key;
    });
    numbers.forEach(item=>item.node.textContent=(item.value*p).toFixed(item.decimals)+item.suffix);
    bars.forEach(node=>{node.style.transformOrigin='left';node.style.transform='scaleX('+p+')';});
    donuts.forEach(item=>{item.node.style.setProperty('--correct-angle',parseFloat(item.correct)*p+'deg');item.node.style.setProperty('--wrong-angle',parseFloat(item.wrong)*p+'deg');});
  };
  page.querySelectorAll('.result-hero,#result-panel-overview .the').forEach((node,i)=>{
    node.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:i*60,easing:'ease-out'});
  });
  let start;
  paint(0);
  const frame=time=>{
    if(!page.isConnected||document.hidden){stopMedals.forEach(stop=>stop());restore();return;}
    start??=time;
    const progress=Math.min(1,(time-start)/900);
    paint(1-(1-progress)**3);
    if(progress<1)requestAnimationFrame(frame);else restore();
  };
  requestAnimationFrame(frame);
}
