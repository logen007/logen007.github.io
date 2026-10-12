import {validMediaName} from './r2-media.js';

export function registerMediaDeliveryRoutes(app,{uploadDir,r2Media,authenticate}){
  app.get('/api/media/config',async()=>({enabled:r2Media?.enabled??Boolean(r2Media)}));
  app.get('/uploads/:name',async(request,reply)=>{
    await authenticate(request);
    const name=request.params.name;
    if(!validMediaName(name))return reply.code(404).send({error:'Tệp không tồn tại.'});
    if(request.method==='GET'&&request.query.delivery==='r2'&&r2Media){
      try{
        const source=await r2Media.source(name);
        if(source){reply.header('Cache-Control','private, no-store');return reply.redirect(source);}
      }catch{app.log.warn('R2 source unavailable; serving VPS media.');}
    }
    reply.header('Cache-Control','private, max-age=3600');return reply.sendFile(name,uploadDir);
  });
}
