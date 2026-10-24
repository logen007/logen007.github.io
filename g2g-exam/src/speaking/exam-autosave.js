// Serialize versioned saves. A failed request keeps its exact payload for an explicit retry.
export function createSpeakingAutosave({version=0,read,write,accept=()=>{},status=()=>{},delay=700}){
 let revision=0,saved=0,timer=null,flight=null,pending=null,disposed=false;
 const flush=()=>{
  clearTimeout(timer);timer=null;
  if(flight)return flight;
  if(disposed||saved===revision)return Promise.resolve();
  flight=(async()=>{
   while(!disposed&&saved!==revision){
    pending??={revision,value:JSON.parse(JSON.stringify(read())),version};
    status('saving');
    try{
     const result=await write(pending.value,pending.version);
     if(disposed)return;
     version=result.version??version;saved=pending.revision;pending=null;
     accept(result,saved===revision);status(saved===revision?'saved':'changed');
    }catch(error){
     // Validation is a confirmed rejection, so a corrected edit must replace it.
     // Network/5xx uncertainty retains the payload for the server's exact retry.
     if(error.status===400||error.statusCode===400)pending=null;
     if(!disposed)status('error',error);throw error;
    }
   }
  })().finally(()=>{flight=null;});
  return flight;
 };
 return {
  changed(){if(disposed)return;revision++;status('changed');clearTimeout(timer);timer=setTimeout(()=>void flush().catch(()=>{}),delay);},
  flush,
  dirty:()=>saved!==revision,
  dispose(){disposed=true;clearTimeout(timer);},
 };
}
