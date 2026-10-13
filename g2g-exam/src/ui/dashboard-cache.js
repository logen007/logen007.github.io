const key='g2g.dashboard.v1',maxAge=24*60*60*1000;
export function readDashboardCache(owner){
  if(!owner)return null;
  try{const row=JSON.parse(sessionStorage.getItem(key)||'null');return row?.owner===owner&&Date.now()-row.at<maxAge?row:null;}catch{return null;}
}
export function writeDashboardCache(owner,data){
  if(!owner||data.scope==='catalog')return;
  const pick=(row,fields)=>Object.fromEntries(fields.filter(field=>row[field]!==undefined).map(field=>[field,row[field]]));
  const value={
    users:(data.users||[]).map(row=>pick(row,['id','role','name','picture','createdAt','status'])),
    exams:(data.exams||[]).map(row=>({...pick(row,['id','title','provider','level','status']),sections:(row.sections||[]).map(s=>pick(s,['name','questionIds']))})),
    attempts:(data.attempts||[]).map(row=>pick(row,['id','examId','examTitle','studentId','status','submittedAt','createdAt','aiWritingAccuracy'])),
    questions:[],
  };
  try{sessionStorage.setItem(key,JSON.stringify({owner,at:Date.now(),value}));}catch{}
}
export function clearDashboardCache(){try{sessionStorage.removeItem(key);}catch{}}

// Preserve unchanged nodes, focused controls and open disclosures on refresh.
export function patchDashboard(current,next){
  if(current.isEqualNode(next))return;
  if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
  if(current.nodeType===3){current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==1)return;
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name)&&!(current.tagName==='DETAILS'&&attr.name==='open'))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const old=[...current.childNodes],fresh=[...next.childNodes];
  for(let i=0;i<Math.max(old.length,fresh.length);i++){
    if(!fresh[i])old[i].remove();else if(!old[i])current.append(fresh[i].cloneNode(true));else patchDashboard(old[i],fresh[i]);
  }
}
