// No default-route render may run while an asynchronous deep link is resolving.
export function createStartupGate(){
  let ready=false;
  return {isReady:()=>ready,finish:()=>{ready=true;}};
}
