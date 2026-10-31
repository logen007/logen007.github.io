// Animation history follows the tab's UI-cache lifetime. Never persist text/values/URLs.
const storageKey='g2g.ascii.history.v1';
const digest=value=>{
  let a=2166136261,b=2246822507;
  for(let i=0;i<value.length;i++){const char=value.charCodeAt(i);a=Math.imul(a^char,16777619);b=Math.imul(b^char,3266489909);}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
};
export function createAsciiHistory(win){
  let storage,queued=false;const keys=new Set();
  try{storage=win.sessionStorage;const saved=JSON.parse(storage.getItem(storageKey)||'[]');if(Array.isArray(saved))for(const key of saved.slice(0,50000))if(typeof key==='string'&&/^[a-f0-9]{16}$/.test(key))keys.add(key);}catch{}
  return {
    has:key=>keys.has(digest(key)),
    add(key){
      const hash=digest(key);if(keys.has(hash))return;keys.add(hash);
      if(!storage||queued)return;queued=true;
      Promise.resolve().then(()=>{queued=false;try{storage.setItem(storageKey,JSON.stringify([...keys]));}catch{}});
    },
  };
}
