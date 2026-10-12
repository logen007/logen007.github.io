export function openExamStore(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('g2g-exam-drafts',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      resolve({
        read:key=>new Promise((ok,fail)=>{const r=db.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);}),
        write:(key,value)=>new Promise((ok,fail)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(value,key);tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);tx.onabort=()=>fail(tx.error);}),
        close:()=>db.close(),
      });
    };
  });
}

// One editing tab per attempt; durable snapshots are serialized before network IO.
export class ExamOutbox{
  constructor({store,key,send,onStatus=()=>{}}){
    Object.assign(this,{store,key,send,onStatus});this.draft={pending:{},index:null};
    this.persisted=Promise.resolve();this.timer=null;this.running=null;this.closed=false;
  }
  async init(){this.draft=await this.store.read(this.key)||this.draft;return this;}
  persist(){
    const snapshot=structuredClone(this.draft);
    this.persisted=this.persisted.catch(()=>{}).then(()=>this.store.write(this.key,snapshot)).catch(error=>{error.localStorageFailure=true;throw error;});
    return this.persisted;
  }
  edit(id,value,version=null){
    const previous=this.draft.pending[id];
    this.draft.pending[id]={value:structuredClone(value),base:previous?previous.base:version,operation:crypto.randomUUID()};
    this.onStatus('pending');this.persist().catch(()=>this.onStatus('storage-error'));
    if(!this.timer)this.schedule(1200);
  }
  move(index){this.draft.index=index;this.persist().catch(()=>this.onStatus('storage-error'));}
  schedule(delay=3000){
    clearTimeout(this.timer);if(this.closed)return;
    this.timer=setTimeout(()=>{this.timer=null;this.flush().catch(()=>{});},delay);
  }
  async flush(){
    if(this.running){await this.running;if(Object.keys(this.draft.pending).length)return this.flush();return;}
    if(this.closed)return;
    clearTimeout(this.timer);this.timer=null;
    this.running=this.drain();
    try{await this.running;}finally{this.running=null;}
  }
  async drain(){
    try{
      while(!this.closed&&Object.keys(this.draft.pending).length){
        await this.persisted;
        const changes=structuredClone(this.draft.pending);
        this.onStatus('saving');
        const result=await this.send(changes);
        for(const [id,sent] of Object.entries(changes)){
          const current=this.draft.pending[id];
          if(current?.operation===sent.operation)delete this.draft.pending[id];
          else if(current)current.base=result.versions[id];
        }
        await this.persist();
      }
      this.onStatus('saved');
    }catch(error){
      const terminal=error.status>=400&&error.status<500&&error.status!==429;
      this.onStatus(error.localStorageFailure?'storage-error':terminal?'conflict':'offline');
      if(!terminal)this.schedule(5000);
      throw error;
    }
  }
  overlay(attempt){
    if(!attempt)return;
    for(const [id,item] of Object.entries(this.draft.pending))attempt.answers={...attempt.answers,[id]:item.value};
    if(this.draft.index!=null)attempt.currentSectionIndex=this.draft.index;
  }
  close(){this.closed=true;clearTimeout(this.timer);}
}
