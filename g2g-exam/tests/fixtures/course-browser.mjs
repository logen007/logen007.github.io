// Optional synthetic browser fixtures. Never imported by production application code.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCourseService} from '../../server/src/course-service.js';
import {COURSE_EXERCISE_TYPES} from '../../src/domain/courses.js';

export async function seedBrowserCourses(deps,uploadDir){
  const getSettings=deps.getSettings;deps.getSettings=async()=>{const settings=await getSettings();settings.theme.primaryColor='#f9d638';return settings;};
  const teacher={id:'course-teacher',role:'teacher'};
  await deps.query('INSERT INTO users(id,email,role,data) VALUES($1,$2,$3,$4::jsonb)',[teacher.id,'course-teacher@example.test','teacher',JSON.stringify({name:'Giáo viên demo'})]);
  await deps.query("UPDATE users SET data=data||$1::jsonb WHERE id='s0'",[JSON.stringify({name:'Học viên demo',profileCompletedAt:new Date().toISOString()})]);
  const service=createCourseService(deps),fallback=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=','base64');
  for(const [name,source] of [['study','g2g-course-study.jpg'],['group','g2g-course-group.jpg']]){
    let bytes=fallback;
    if(process.env.G2G_COURSE_IMAGE_DIR)bytes=await fs.readFile(path.join(process.env.G2G_COURSE_IMAGE_DIR,source));
    await fs.writeFile(path.join(uploadDir,'course-'+name+'.jpg'),bytes);
  }
  const exercise=(kind,index)=>{
    const profile=structuredClone(COURSE_EXERCISE_TYPES[kind]),q={id:'q-'+kind,type:profile.type,title:'Wählen Sie die passende Antwort.',choices:['Hallo','Danke','Tschüss'],correctAnswer:0,maxScore:1,explanation:'Hallo dùng để chào hỏi; Danke dùng để cảm ơn.'};
    const section={id:'part-'+kind,name:profile.label,questionProfile:profile,instruction:'[b]Übung[/b] · Wählen Sie die richtige Antwort.'};
    if(kind==='binary')Object.assign(q,{title:'Hallo ist eine Begrüßung.',choices:['Richtig','Falsch']});
    if(kind==='multiple')Object.assign(q,{title:'Wählen Sie zwei Begrüßungen.',choices:['Hallo','Danke','Guten Tag','Tschüss'],correctAnswer:[0,2]});
    if(kind==='listening')q.audioUrl='/uploads/synthetic-tone.wav';
    if(kind==='letters')Object.assign(q,{title:'Tom begrüßt Anna.',choices:profile.choices});
    if(kind==='matching')Object.assign(q,{title:'Ordnen Sie zu.',choices:[],correctAnswer:null,pairs:[['Hallo','Xin chào'],['Danke','Cảm ơn'],['Tschüss','Tạm biệt']]});
    if(kind==='headings'){section.headingOptions=['Begrüßung','Essen'];q.choices=['A','B'];q.title='Hallo, mein Name ist Anna.';}
    if(kind==='gaps'){section.gapPassage=['Guten ',{gap:0},'!'];section.gapOptions=['Tag','Nacht','Morgen'];q.choices=['A','B','C'];}
    return {id:'exercise-'+index,kind:'exercise',title:profile.label,trial:kind==='choices',exercise:{section,questions:[q]}};
  };
  for(const [index,title,level,price] of [[1,'Tiếng Đức A1 · Bắt đầu từ số 0','A1',0],[2,'Goethe B1 · Luyện thi từng kỹ năng','B1',690000],[3,'Tiếng Đức A2 · Giao tiếp hằng ngày','A2',390000],[4,'TELC B2 · Luyện tập chuyên sâu','B2',890000]]){
    const course={title,level,price,coverUrl:'/uploads/course-'+(index%2?'study':'group')+'.jpg',shortDescription:'Học kiến thức trọng tâm và luyện tập theo từng kỹ năng.',description:'[headline]Học chắc kiến thức, luyện tập từng bước[/headline]\nKhóa học giúp bạn củng cố từ vựng, ngữ pháp và thực hành với các dạng bài quen thuộc.\n\n[b]Bạn sẽ học được[/b]\n• Chào hỏi và giới thiệu bản thân\n• Nhận biết từ vựng trong tình huống thực tế\n• Luyện tập và xem giải thích ngay sau khi nộp bài',chapters:[{id:'chapter-1',title:'Chào hỏi & giới thiệu bản thân',knowledge:[{id:'knowledge-1',title:'Guten Tag! · Cách chào hỏi',body:'[headline]Chào hỏi trong tiếng Đức[/headline]\n[b]Hallo![/b] — Xin chào.\n[b]Guten Tag![/b] — Chào ban ngày.\n[b]Danke![/b] — Cảm ơn.\n\nHãy nghe, đọc và luyện tập để ghi nhớ cách sử dụng.',trial:true,imageUrl:'/uploads/course-study.jpg'}],exercises:Object.keys(COURSE_EXERCISE_TYPES).map(exercise)}]};
    await service.save(teacher,'browser-course-'+index,{version:0,course});await service.publish(teacher,'browser-course-'+index,{version:1});
  }
}
