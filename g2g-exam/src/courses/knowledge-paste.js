// Parse only in inert template contents, then rebuild a small formatting allowlist.
// Never parse clipboard HTML into an element belonging to the live application.
export function sanitizeKnowledgePaste(html,document){
  const inert=document.implementation.createHTMLDocument(''),source=inert.createElement('template'),output=inert.createElement('div');
  source.innerHTML=String(html);
  const tags=new Set(['p','h2','strong','b','em','i','u','br','span','ul','ol','li']);
  const discard=new Set(['script','style','img','picture','iframe','object','embed','svg','math','template','link','meta','base','audio','video','source','form','input','button','textarea','select']);
  const copy=(node,parent)=>{
    if(node.nodeType===3){parent.appendChild(inert.createTextNode(node.textContent));return;}
    if(node.nodeType!==1)return;
    const name=node.localName.toLowerCase();if(discard.has(name))return;
    const tag=tags.has(name)?name:['div','h1','h3','h4','h5','h6'].includes(name)?'p':null;
    const target=tag?inert.createElement(tag):parent;
    if(tag){
      if(tag==='ol'){const start=Number(node.getAttribute('start')||1);if(Number.isInteger(start)&&start>0&&start<=9999)target.setAttribute('start',String(start));}
      const align=node.style?.textAlign;if(['left','center','right','justify'].includes(align))target.style.textAlign=align;
      if((tag==='strong'||tag==='span')&&['instruction-token','text-signature','text-headline'].includes(node.getAttribute('class')))target.className=node.getAttribute('class');
      parent.appendChild(target);
    }
    for(const child of node.childNodes)copy(child,target);
  };
  for(const node of source.content.childNodes)copy(node,output);
  return output.innerHTML;
}
