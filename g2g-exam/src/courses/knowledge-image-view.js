import {closeHistory} from '@tiptap/pm/history';
import {knowledgeImageWidth} from '../domain/course-knowledge.js';

// Percentage widths remain responsive. Drag only previews DOM; pointer-up commits
// one document transaction, so autosave/history never receive every pointer move.
export function createKnowledgeImageView({node,editor,getPos}){
  const doc=editor.options.element.ownerDocument,dom=doc.createElement('div'),image=doc.createElement('img');
  dom.className='course-knowledge-image-node';dom.contentEditable='false';dom.draggable=true;
  image.className='course-lesson-image';image.draggable=false;dom.append(image);
  let current=node,cleanup=null;
  const sync=next=>{
    current=next;const attrs=next.attrs;
    dom.dataset.knowledgeId=attrs.blockId;dom.dataset.align=attrs.align||'center';dom.style.width=knowledgeImageWidth(attrs.width)+'%';
    image.dataset.knowledgeId=attrs.blockId;image.dataset.align=attrs.align||'center';image.dataset.width=String(knowledgeImageWidth(attrs.width));
    if(image.getAttribute('src')!==attrs.src)image.setAttribute('src',attrs.src);
    image.alt=attrs.alt||'';
  };
  const commit=width=>{
    const pos=getPos();if(typeof pos!=='number'||editor.isDestroyed||editor.state.doc.nodeAt(pos)?.attrs.blockId!==current.attrs.blockId)return;
    const value=knowledgeImageWidth(width);if(value===current.attrs.width){sync(current);return;}
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.chain().setNodeSelection(pos).updateAttributes('image',{width:value}).run();
  };
  for(const side of ['left','right']){
    const handle=doc.createElement('button');handle.type='button';handle.className='course-knowledge-resize-handle';handle.dataset.knowledgeResize=side;
    handle.setAttribute('aria-label','Đổi kích thước ảnh — phím mũi tên tăng giảm 1%, Shift tăng giảm 10%');handle.title='Kéo góc để đổi kích thước ảnh';dom.append(handle);
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false)return;
      event.preventDefault();event.stopPropagation();cleanup?.();
      const width=editor.view.dom.getBoundingClientRect().width;if(width<=0)return;
      const startX=event.clientX,start=knowledgeImageWidth(current.attrs.width),scale=current.attrs.align==='center'?2:1;let value=start;
      dom.draggable=false;dom.dataset.resizing='true';
      try{handle.setPointerCapture?.(event.pointerId);}catch{}
      const move=e=>{if(e.pointerId!==event.pointerId)return;e.preventDefault();value=knowledgeImageWidth(start+(e.clientX-startX)*(side==='left'?-1:1)*scale/width*100);dom.style.width=value+'%';};
      const stop=e=>{if(e.pointerId!==event.pointerId)return;const cancel=e.type==='pointercancel';cleanup?.();if(cancel)sync(current);else commit(value);};
      const cancel=()=>{cleanup?.();sync(current);};
      cleanup=()=>{doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',stop,true);doc.removeEventListener('pointercancel',stop,true);handle.removeEventListener('lostpointercapture',cancel);doc.defaultView.removeEventListener('blur',cancel);try{handle.releasePointerCapture?.(event.pointerId);}catch{}dom.draggable=true;delete dom.dataset.resizing;cleanup=null;};
      doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',stop,true);doc.addEventListener('pointercancel',stop,true);
      handle.addEventListener('lostpointercapture',cancel);doc.defaultView.addEventListener('blur',cancel);
    });
    handle.addEventListener('keydown',event=>{
      const delta={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[event.key];if(!delta&&event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();event.stopPropagation();commit(event.key==='Home'?10:event.key==='End'?100:Number(current.attrs.width)+delta*(event.shiftKey?10:1));
    });
  }
  sync(node);
  return {dom,update(next){if(next.type!==current.type)return false;sync(next);return true;},
    selectNode(){dom.dataset.selected='true';},deselectNode(){delete dom.dataset.selected;},
    stopEvent:event=>Boolean(event.target.closest?.('[data-knowledge-resize]')),ignoreMutation:()=>true,
    destroy(){cleanup?.();},
  };
}
