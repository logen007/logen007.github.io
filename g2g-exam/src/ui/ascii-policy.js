// Automatic discovery: classes/page names never decide whether ordinary content participates.
export const ASCII_REVEAL_SELECTOR='*:not(html):not(body):not(script):not(style):not(template):not(noscript):not(option):not(optgroup):not(source)';
const critical='.ascii-reveal-layer,.boot-shell,.navigation-loading,.thong-bao,.exam-paper,.grading-detail,.grading-review,.sx-session,.sx-grading,#examMainTime,#examTimeSummary,#saveState,[data-clock],[data-sx-clock],[data-sx-queue-clock],[data-sx-device-status],[data-sx-call-status],[data-device-status],video,audio,iframe,[contenteditable]:not([contenteditable="false"]),[role=alert],[role=timer],[aria-live=assertive],[data-ascii-reveal="off"],input[type=password],input[type=hidden],input[type=file]';
export const ASCII_REVEAL_EXCLUDED=critical+',.dashboard-state,.dashboard-services,.dashboard-warning';
export const ASCII_CONTROL_EXCLUDED=critical;
const controls='button,input,select,textarea,a,summary,[role=button],[role=status]';
const media='img,svg,canvas,progress,meter,video,audio,iframe,[role=img]';
const groups='article,section,aside,figure,thead,tr';
export const isAsciiControl=element=>element.matches?.(controls)||false;
export function asciiExclusion(element){
  if(element.closest(critical))return 'protected-content';
  if(element.tagName==='INPUT'&&element.ownerDocument.defaultView.getComputedStyle(element).opacity==='0')return 'nonvisual-control';
  if(!isAsciiControl(element)&&element.closest(ASCII_REVEAL_EXCLUDED))return 'protected-region';
  if(element.closest('script,style,template,noscript,option,optgroup'))return 'nonvisual-content';
  if(element.closest('svg')&&element.tagName.toLowerCase()!=='svg')return 'vector-child';
  return null;
}
const ownText=element=>[...element.childNodes||[]].some(node=>node.nodeType===3&&node.textContent.trim());
export function isAsciiCandidate(element){
  if(element.nodeType!==1||!element.matches(ASCII_REVEAL_SELECTOR)||asciiExclusion(element))return false;
  if(element.matches(controls+','+media))return true;
  if(element.hasAttribute?.('data-ascii-reveal'))return Boolean(element.textContent.trim()||element.querySelector(media));
  // Leaf semantic surfaces own their contents; layout wrappers never swallow the page.
  if(element.matches(groups)&&!element.querySelector(groups)&&(element.textContent.trim()||element.querySelector(controls+','+media)))return true;
  return ownText(element);
}
export function collectAsciiTargets(nodes){
  const candidates=new Set();
  for(let node of Array.isArray(nodes)?nodes:[nodes]){
    if(node.nodeType===3)node=node.parentElement;
    if(node?.nodeType!==1)continue;
    for(const element of [node,...node.querySelectorAll(ASCII_REVEAL_SELECTOR)])if(isAsciiCandidate(element))candidates.add(element);
  }
  return [...candidates].filter(element=>{
    for(let parent=element.parentElement;parent;parent=parent.parentElement)if(candidates.has(parent))return false;
    return true;
  });
}
export function asciiContentUnits(root){
  return [root,...root.querySelectorAll(ASCII_REVEAL_SELECTOR)].filter(element=>ownText(element)||element.matches?.(controls+','+media));
}
const coveragePath=(element,root)=>{
  const path=[];for(let node=element;node&&node!==root;node=node.parentElement)path.push(node.tagName.toLowerCase()+':nth-child('+(Array.from(node.parentElement?.children||[]).indexOf(node)+1)+')');return path.reverse().join('>');
};
// Audit independently enumerates every text/media/control unit, not just selected targets.
// Counts/reasons contain no text, values, account data or outbound telemetry.
export function asciiCoverage(root,statusFor){
  const result={total:0,covered:0,pending:0,excluded:0,fallback:0,uncovered:0,reasons:{},gaps:[],fallbacks:[]};
  for(const element of asciiContentUnits(root)){
    if(element.closest('.ascii-reveal-layer'))continue;
    const box=element.getBoundingClientRect(),win=root.ownerDocument.defaultView,style=win.getComputedStyle(element);
    if(!box.width||!box.height||box.top>=win.innerHeight||box.top+box.height<=0||box.left+box.width<=0||box.left>=(win.innerWidth||Infinity)||style.display==='none'||style.visibility==='hidden'||style.opacity==='0'||element.closest('[hidden]'))continue;
    result.total++;
    let reason=asciiExclusion(element),state=reason?'excluded':null;
    if(!state){
      const status=statusFor(element);
      if(status){state=status.state;reason=status.reason;}
    }
    if(state==='active'||state==='completed')result.covered++;
    else if(state==='pending')result.pending++;
    else if(state==='excluded')result.excluded++;
    else if(state==='fallback'){result.fallback++;if(result.fallbacks.length<30)result.fallbacks.push({path:coveragePath(element,root),reason});}
    else {result.uncovered++;if(result.gaps.length<30)result.gaps.push({path:coveragePath(element,root),reason:reason||'unregistered'});}
    if(reason)result.reasons[reason]=(result.reasons[reason]||0)+1;
  }
  return result;
}
