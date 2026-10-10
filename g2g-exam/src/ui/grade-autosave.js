// Serialize saves and drain edits made while a request is in flight.
export function createGradeAutosave(save,onStatus=()=>{},delay=600){
  let revision=0,saved=0,timer=null,running=null;
  async function flush(){
    clearTimeout(timer);
    if(running){if(!await running)return false;return flush();}
    if(saved===revision)return true;
    running=(async()=>{
      while(saved!==revision){
        const current=revision;
        onStatus('Đang lưu…');
        try{
          if(!await save())throw new Error('Chưa lưu được. Kiểm tra điểm và kết nối.');
          saved=current;
        }catch(error){onStatus(error.message);return false;}
      }
      onStatus('Đã lưu');
      return true;
    })();
    try{return await running;}finally{running=null;}
  }
  return {flush,get pending(){return saved!==revision;},change(){
    revision++;clearTimeout(timer);onStatus('Chưa lưu…');
    timer=setTimeout(()=>{void flush();},delay);
  }};
}
