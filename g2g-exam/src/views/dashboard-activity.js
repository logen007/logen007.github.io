const DAY=86400000;
const stamp=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
const dateKey=value=>new Date(value).toISOString().slice(0,10);
export function dashboardActivity(data,filter={},now=new Date()){
  const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const students=data.users.filter(u=>u.role==='student');
  const dates=students.map(u=>stamp(u.createdAt)).filter(n=>n!==null&&n<=today+DAY);
  const mode=['auto','7','30','90','365','custom'].includes(filter.range)?filter.range:'auto';
  let end=today,start=dates.length?dates.reduce((min,n)=>Math.min(min,n),today):today-6*DAY;
  start=Math.floor(start/DAY)*DAY;
  if(!['auto','custom'].includes(mode))start=end-(Number(mode)-1)*DAY;
  if(mode==='custom'){
    start=stamp(filter.from)??today-6*DAY;end=stamp(filter.to)??today;
    if(start>end)[start,end]=[end,start];
  }
  const days=Math.max(1,Math.ceil((end-start)/DAY)+1);
  const unit=days<=14?'day':days<=90?'week':days<=730?'month':'year';
  const firstYear=new Date(start).getUTCFullYear();
  const yearStep=Math.max(1,Math.ceil((new Date(end).getUTCFullYear()-firstYear+1)/24));
  const bucket=value=>{
    const d=new Date(value);
    if(unit==='year')return String(firstYear+Math.floor((d.getUTCFullYear()-firstYear)/yearStep)*yearStep);
    if(unit==='month')return d.toISOString().slice(0,7);
    if(unit==='week')return dateKey(start+Math.floor((value-start)/(7*DAY))*7*DAY);
    return dateKey(value);
  };
  const bins=new Map();
  for(let cursor=start;cursor<=end;){
    const key=bucket(cursor);
    bins.set(key,{key,label:unit==='year'?key:unit==='month'?key.slice(5)+'/'+key.slice(0,4):key.slice(8)+'/'+key.slice(5,7),count:0});
    const d=new Date(cursor);
    if(unit==='year')cursor=Date.UTC(Number(key)+yearStep,0,1);
    else if(unit==='month')cursor=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
    else cursor+=(unit==='week'?7:1)*DAY;
  }
  for(const n of dates)if(n>=start&&n<end+DAY){const item=bins.get(bucket(n));if(item)item.count++;}
  const counts=new Map();
  for(const a of data.attempts){
    if(!['submitted','grading','ready','published'].includes(a.status))continue;
    counts.set(a.studentId,(counts.get(a.studentId)||0)+1);
  }
  const active=students.map(u=>({...u,count:counts.get(u.id)||0})).filter(u=>u.count).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'vi'));
  return {mode,from:dateKey(start),to:dateKey(end),unit,bins:[...bins.values()],active,unitLabel:{day:'Theo ngày',week:'Theo tuần',month:'Theo tháng',year:'Theo năm'}[unit]};
}
