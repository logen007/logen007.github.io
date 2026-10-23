export function registerCourseRoutes(app,{service,userFor}){
  const route=(method,url,action)=>app.route({method,url,handler:async request=>{
    const user=await userFor(request);return action(user,request.params||{},request.body||{},request.query||{});
  }});
  route('GET','/api/courses',(u,p,b,q)=>service.catalog(u,q));
  route('GET','/api/courses/exercise-sources',u=>service.sources(u));
  route('GET','/api/courses/exercise-sources/:examId/:sectionId',(u,p)=>service.sources(u,p.examId,p.sectionId));
  route('GET','/api/courses/:id',(u,p,b,q)=>service.getCourse(u,p.id,{edit:q.edit==='1'}));
  route('PUT','/api/courses/:id',(u,p,b)=>service.save(u,p.id,b));
  route('POST','/api/courses/:id/publish',(u,p,b)=>service.publish(u,p.id,b));
  route('POST','/api/courses/:id/unpublish',(u,p,b)=>service.unpublish(u,p.id,b));
  route('POST','/api/courses/:id/archive',(u,p,b)=>service.archive(u,p.id,b));
  route('POST','/api/courses/:id/enroll',(u,p)=>service.enroll(u,p.id));
  route('POST','/api/courses/:id/enrollments/:enrollmentId/confirm',(u,p,b)=>service.confirmEnrollment(u,p.id,p.enrollmentId,b));
  route('GET','/api/courses/:id/members',(u,p)=>service.members(u,p.id));
  route('GET','/api/courses/:id/members/:enrollmentId/results',(u,p)=>service.memberResults(u,p.id,p.enrollmentId));
  route('GET','/api/courses/:id/lessons/:lessonId',(u,p)=>service.getLesson(u,p.id,p.lessonId));
  route('PUT','/api/courses/:id/lessons/:lessonId/progress',(u,p,b)=>service.saveProgress(u,p.id,p.lessonId,b));
  route('POST','/api/courses/:id/lessons/:lessonId/submit',(u,p,b)=>service.submit(u,p.id,p.lessonId,b));
  route('POST','/api/courses/:id/lessons/:lessonId/try',(u,p,b)=>service.tryExercise(u,p.id,p.lessonId,b));
}
