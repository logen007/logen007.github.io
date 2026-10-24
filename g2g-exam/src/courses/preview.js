import {courseLessons,courseMetadata,courseOutline,publicCourseExercise,gradeCourseExercise} from '../domain/courses.js';

// A learner-shaped session over a saved authoring snapshot. Never calls an API.
export function createCoursePreview(editor,lessonId=''){
  const course=structuredClone(editor.course);
  const preview={course,detail:{...courseMetadata(course),...course,id:editor.id,chapters:courseOutline(course),enrollment:{status:'active'},progress:[]},sessions:Object.create(null),current:null};
  if(lessonId)openPreviewLesson(preview,lessonId);
  return preview;
}
function openPreviewLesson(preview,id){
  const source=courseLessons(preview.course).find(lesson=>lesson.id===id);
  if(!source)return;
  preview.current=preview.sessions[id]??={detail:preview.detail,lesson:{lesson:source.kind==='exercise'?{...source,exercise:publicCourseExercise(source.exercise)}:source,completedAt:null,trial:false},practiceAnswers:{},practiceResult:null,practiceSaveStatus:'Bản xem trước · Không lưu bài làm thật.'};
}
function complete(preview){
  const view=preview.current?.lesson;if(!view)return;
  view.completedAt??=new Date().toISOString();
  if(!preview.detail.progress.some(item=>item.lessonId===view.lesson.id))preview.detail.progress.push({lessonId:view.lesson.id,completedAt:view.completedAt});
}
export function coursePreviewAction(preview,name,{lessonId,answers}={}){
  if(name==='detail'){preview.current=null;return;}
  if(name==='learn'){openPreviewLesson(preview,preview.detail.progress.at(-1)?.lessonId||courseLessons(preview.course)[0]?.id);return;}
  if(name==='lesson'){openPreviewLesson(preview,lessonId);return;}
  const current=preview.current;if(!current)return;
  const lessons=courseLessons(preview.course),index=lessons.findIndex(lesson=>lesson.id===current.lesson.lesson.id);
  if(['complete-lesson','next-lesson','previous-lesson'].includes(name)){
    if(name==='complete-lesson')complete(preview);
    const next=lessons[index+(name==='previous-lesson'?-1:1)];
    if(next)openPreviewLesson(preview,next.id);else preview.current=null;
  }else if(name==='submit-practice'){
    const source=lessons[index];if(source?.kind!=='exercise')return;
    current.practiceResult=gradeCourseExercise(source.exercise,answers);complete(preview);
  }else if(name==='retake'){
    current.practiceAnswers={};current.practiceResult=null;
  }
}
