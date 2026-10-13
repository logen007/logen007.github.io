const cycles=new Map();
export function setDashboardCycle(key,delay,busy=false){cycles.set(key,{at:Date.now(),delay,busy});}
export function cycleProgress(cycle,now=Date.now()){
  return !cycle||cycle.busy?1:Math.min(1,Math.max(0,(now-cycle.at)/Math.max(1,cycle.delay)));
}
export function refreshRing(key){
  return `<svg class="dashboard-refresh-ring" data-refresh-cycle="${key}" viewBox="0 0 20 20" role="img" aria-label="Chu kỳ cập nhật dữ liệu"><circle class="dashboard-refresh-track" cx="10" cy="10" r="8"/><circle class="dashboard-refresh-fill" cx="10" cy="10" r="8" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
}
export function startDashboardProgress(root){
  const paint=()=>{
    if(document.hidden)return;
    for(const ring of root.querySelectorAll('[data-refresh-cycle]')){
      const cycle=cycles.get(ring.dataset.refreshCycle);
      ring.querySelector('.dashboard-refresh-fill').style.strokeDashoffset=String(1-cycleProgress(cycle));
      ring.setAttribute('aria-label',cycle?.busy?'Đang kiểm tra dữ liệu':'Thời gian tới lần kiểm tra dữ liệu tiếp theo');
    }
  };
  const timer=setInterval(paint,250);paint();
  return ()=>clearInterval(timer);
}
