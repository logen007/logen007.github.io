import {PassThrough} from 'node:stream';
import {publishExamRelease} from './exam-releases.js';

export function registerPublicationRoute(app,requireUser){
  app.post('/api/exams/:id/publish',async(request,reply)=>{
    const user=await requireUser(request);
    const stream=new PassThrough();
    reply.header('Content-Type','application/x-ndjson; charset=utf-8').header('Cache-Control','no-store').header('X-Accel-Buffering','no');
    const send=value=>{if(!stream.destroyed)stream.write(JSON.stringify(value)+'\n');};
    void publishExamRelease(user,{examId:request.params.id},stage=>send({stage}))
      .then(receipt=>send({stage:'done',...receipt}))
      .catch(error=>send({stage:'error',message:error.statusCode?error.message:'Không thể xuất bản. Vui lòng thử lại.'}))
      .finally(()=>stream.end());
    return reply.send(stream);
  });
}
