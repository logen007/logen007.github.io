import {courseSlugFromTitle} from '../../src/domain/course-url.js';
import {normalizeCourse,assertCoursePublishable,courseMetadata,courseOutline,courseLessons,publicCourseExercise,validateCourseAnswers,gradeCourseExercise,normalizeCourseExercise} from '../../src/domain/courses.js';
import {KNOWLEDGE_LAYOUT_VERSION} from '../../src/domain/course-knowledge.js';
import {createHash} from 'node:crypto';
import {publicationLabel} from './exam-release-content.js';

const contentHash=course=>createHash('sha256').update(JSON.stringify(normalizeCourse(course))).digest('hex');

export async function loadTrashedCourses(query){
  return (await query(`SELECT c.id,c.version,c.metadata->>'title' AS title,c.metadata->>'deletedAt' AS "deletedAt",coalesce(u.data->>'name',u.email) AS "ownerName"
    FROM courses c JOIN users u ON u.id=c.owner_id WHERE c.metadata->>'deletedAt' IS NOT NULL ORDER BY c.updated_at DESC,c.id`)).rows;
}

// Injected database boundary lets the same service run against isolated SQL in CI.
export function createCourseService({query,withTx,uid,audit}){
  const fail=(status,message)=>{throw Object.assign(new Error(message),{statusCode:status});};
  const staff=user=>['teacher','master'].includes(user?.role);
  const teacher=user=>{if(!staff(user))fail(403,'Chỉ giáo viên được quản lý khóa học.');};
  const student=user=>{if(user?.role!=='student')fail(403,'Chỉ học viên được đăng ký học.');};
  const normalize=fn=>{try{return fn();}catch(error){fail(400,error.message);}};
  const expected=(row,version)=>{if(row.version!==Number(version))fail(409,'Nội dung đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.');};
  const owned=async(client,user,id,lock=false,includeDeleted=false)=>{
    teacher(user);
    const row=(await client.query(`SELECT * FROM courses WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
    if(!row)fail(404,'Không tìm thấy khóa học.');
    if(row.owner_id!==user.id&&user.role!=='master')fail(403,'Bạn không quản lý khóa học này.');
    if(row.metadata.deletedAt&&!includeDeleted)fail(404,'Khóa học đã được xóa.');
    return row;
  };
  const db={query};
  const publication=async(client,id,version)=>{
    if(!version)return {};
    const row=(await client.query('SELECT metadata,(SELECT count(*)::int FROM course_releases WHERE course_id=$1 AND version<=$2) AS ordinal FROM course_releases WHERE course_id=$1 AND version=$2',[id,version])).rows[0];
    if(!row)return {};
    const ordinal=Number(row.metadata.publicationVersion)||row.ordinal;
    return {publicationVersion:ordinal,publicationLabel:row.metadata.publicationLabel||publicationLabel(ordinal)};
  };
  const enrollment=async(client,user,id,lock=false)=>{
    const row=(await client.query(`SELECT e.*,r.snapshot FROM course_enrollments e JOIN course_releases r ON r.course_id=e.course_id AND r.version=e.release_version WHERE e.course_id=$1 AND e.student_id=$2${lock?' FOR UPDATE OF e':''}`,[id,user.id])).rows[0];
    if(!row||row.status!=='active')fail(403,'Bạn chưa được mở quyền học khóa này.');
    return row;
  };
  const lessonIn=(snapshot,lessonId)=>{const lesson=courseLessons(snapshot).find(item=>item.id===lessonId);if(!lesson)fail(404,'Không tìm thấy bài học trong phiên bản đã đăng ký.');return lesson;};
  const progress=async(client,enrollmentId)=>{
    const rows=(await client.query('SELECT lesson_id,revision,completed_at,last_seen_at FROM course_progress WHERE enrollment_id=$1 ORDER BY last_seen_at DESC',[enrollmentId])).rows;
    return rows.map(row=>({lessonId:row.lesson_id,revision:row.revision,completedAt:row.completed_at,lastSeenAt:row.last_seen_at}));
  };

  async function catalog(user,params={}){
    const manage=params.manage==='1',mine=params.mine==='1';if(manage)teacher(user);
    const values=[user.id],where=[];
    const add=value=>{values.push(value);return `$${values.length}`;};
    if(manage){where.push("c.metadata->>'deletedAt' IS NULL");if(user.role!=='master')where.push('c.owner_id=$1');}
    else if(mine)where.push('e.id IS NOT NULL');
    else where.push("c.status='published'");
    if(params.search)where.push(`m.metadata->>'title' ILIKE ${add('%'+String(params.search).slice(0,150)+'%')}`);
    if(params.level)where.push(`m.metadata->>'level'=${add(String(params.level))}`);
    if(params.fee==='free')where.push("(m.metadata->>'price')::numeric=0");
    if(params.fee==='paid')where.push("(m.metadata->>'price')::numeric>0");
    const limit=Math.min(60,Math.max(1,Math.floor(Number(params.limit)||40))),offset=Math.min(1000000,Math.max(0,Math.floor(Number(params.offset)||0)));
    const result=await query(`SELECT c.id,c.owner_id,c.status,c.version,c.published_version,c.updated_at,c.metadata->>'slug' AS current_slug,m.metadata-'contentHash' AS metadata,
      coalesce(u.data->>'name',u.email) AS teacher_name,e.id AS enrollment_id,e.status AS enrollment_status,e.amount,
      (SELECT count(*)::int FROM course_progress p WHERE p.enrollment_id=e.id AND p.completed_at IS NOT NULL) AS completed,
      count(*) OVER()::int AS total
      FROM courses c JOIN users u ON u.id=c.owner_id
      LEFT JOIN course_enrollments e ON e.course_id=c.id AND e.student_id=$1
      LEFT JOIN course_releases r ON r.course_id=c.id AND r.version=${mine?'e.release_version':'c.published_version'}
      CROSS JOIN LATERAL (SELECT ${manage?'c.metadata':'r.metadata'} AS metadata) m
      ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY c.updated_at DESC,c.id LIMIT ${add(limit)} OFFSET ${add(offset)}`,values);
    return {courses:result.rows.map(row=>({id:row.id,...row.metadata,slug:row.current_slug||'',teacherName:row.teacher_name,status:row.status,version:row.version,updatedAt:row.updated_at,completed:row.completed,
      enrollment:row.enrollment_id?{id:row.enrollment_id,status:row.enrollment_status,amount:row.amount}:null})),total:result.rows[0]?.total||0};
  }
  async function getCourse(user,id,{edit=false}={}){
    if(edit){const row=await owned(db,user,id);return {id:row.id,version:row.version,status:row.status,publishedVersion:row.published_version,...await publication(db,id,row.published_version),course:row.draft};}
    const existing=(await query('SELECT id,status,release_version,amount FROM course_enrollments WHERE course_id=$1 AND student_id=$2',[id,user.id])).rows[0];
    const release=(await query(`SELECT r.snapshot,r.version,r.metadata,c.metadata->>'slug' AS current_slug,u.data->>'name' AS teacher_name FROM courses c JOIN course_releases r ON r.course_id=c.id AND r.version=${existing?'$2':'c.published_version'} JOIN users u ON u.id=c.owner_id WHERE c.id=$1 ${existing?'':"AND c.status='published'"}`,existing?[id,existing.release_version]:[id])).rows[0];
    if(!release)fail(404,'Khóa học chưa được xuất bản hoặc đã ngừng đăng ký.');
    return {id,version:release.version,publicationLabel:release.metadata.publicationLabel,...courseMetadata(release.snapshot),slug:release.current_slug||'',description:release.snapshot.description,...(release.snapshot.descriptionBlocks?{descriptionBlocks:release.snapshot.descriptionBlocks}:{}),teacherName:release.teacher_name,
      chapters:courseOutline(release.snapshot),enrollment:existing?{id:existing.id,status:existing.status,amount:existing.amount}:null,
      progress:existing?.status==='active'?await progress(db,existing.id):[]};
  }
  async function byUrl(user,slug){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)fail(404,'Không tìm thấy khóa học.');
    const row=(await query('SELECT course_id FROM course_urls WHERE slug=$1',[slug])).rows[0];
    if(!row)fail(404,'Không tìm thấy khóa học.');
    return getCourse(user,row.course_id);
  }
  async function save(user,id,input){
    teacher(user);if(!/^[\w-]{1,100}$/.test(id))fail(400,'Mã khóa học không hợp lệ.');
    const course=normalize(()=>normalizeCourse(input.course));
    return withTx(async client=>{
      const found=(await client.query('SELECT * FROM courses WHERE id=$1 FOR UPDATE',[id])).rows[0];
      const autoSlug=Boolean(input.autoSlug)&&!course.slug;
      if(autoSlug)course.slug=found?.draft.slug||courseSlugFromTitle(course.title);
      if(found&&input.course.slug===undefined&&found.draft.slug!==undefined)course.slug=found.draft.slug;
      if(found){if(found.owner_id!==user.id&&user.role!=='master')fail(403,'Bạn không quản lý khóa học này.');
        if(found.metadata.deletedAt)fail(409,'Khóa học đã được xóa. Vui lòng tải lại danh sách.');
        if(found.draft.descriptionBlocks?.some(block=>block.list)&&input.knowledgeLayout!==KNOWLEDGE_LAYOUT_VERSION)fail(409,'Mô tả có danh sách. Vui lòng tải lại trang trước khi chỉnh sửa.');
        if(Array.isArray(found.draft.descriptionBlocks)&&!Array.isArray(input.course.descriptionBlocks))fail(409,'Mô tả khóa học dùng trình soạn thảo mới. Vui lòng tải lại trang trước khi chỉnh sửa.');
        const incoming=new Map(courseLessons(input.course).map(lesson=>[lesson.id,lesson]));
        if(courseLessons(found.draft).some(lesson=>incoming.has(lesson.id)&&(lesson.contentVersion>=1&&!Array.isArray(incoming.get(lesson.id).blocks)||lesson.contentVersion>=2&&input.knowledgeLayout!==KNOWLEDGE_LAYOUT_VERSION)))fail(409,'Bài kiến thức dùng trình soạn thảo mới. Vui lòng tải lại trang trước khi chỉnh sửa.');
        if(JSON.stringify(normalizeCourse(found.draft))===JSON.stringify(course))return {id,version:found.version,status:found.status,publishedVersion:found.published_version,course};
        if(found.status==='published')fail(409,'Khóa học đã xuất bản. Hãy bỏ xuất bản trước khi chỉnh sửa.');
        expected(found,input.version);
        await client.query('UPDATE courses SET draft=$2::jsonb,metadata=$3::jsonb,version=version+1,updated_at=now() WHERE id=$1',[id,JSON.stringify(course),JSON.stringify(courseMetadata(course))]);
      }else{
        if(Number(input.version)!==0)fail(409,'Khóa học đã thay đổi. Vui lòng tải lại.');
        await client.query('INSERT INTO courses(id,owner_id,draft,metadata) VALUES($1,$2,$3::jsonb,$4::jsonb)',[id,user.id,JSON.stringify(course),JSON.stringify(courseMetadata(course))]);
      }
      if(course.slug){
        const base=course.slug;let suffix=1;
        while(true){
          await client.query('INSERT INTO course_urls(slug,course_id) VALUES($1,$2) ON CONFLICT(slug) DO NOTHING',[course.slug,id]);
          const reserved=(await client.query('SELECT course_id FROM course_urls WHERE slug=$1',[course.slug])).rows[0];
          if(reserved?.course_id===id)break;
          if(!autoSlug||suffix>=1000)fail(409,'URL này đã được khóa học khác sử dụng. Vui lòng chọn URL khác.');
          const tail='-'+(++suffix);course.slug=base.slice(0,80-tail.length).replace(/-$/,'')+tail;
        }
        if(course.slug!==base)await client.query('UPDATE courses SET draft=$2::jsonb,metadata=$3::jsonb WHERE id=$1',[id,JSON.stringify(course),JSON.stringify(courseMetadata(course))]);
      }
      await audit(user,'save_course','course',id,{},client);
      return {id,version:(found?.version||0)+1,status:found?.status||'draft',publishedVersion:found?.published_version||null,course};
    });
  }
  async function publish(user,id,{version}){
    return withTx(async client=>{
      const row=await owned(client,user,id,true);
      if(row.status==='published'){
        if(![row.version,row.version-1].includes(Number(version)))expected(row,version);
        return {id,version:row.version,status:'published',publishedVersion:row.published_version,...await publication(client,id,row.published_version),reused:true};
      }
      expected(row,version);
      const course=normalize(()=>{const c=normalizeCourse(row.draft);assertCoursePublishable(c);return c;}),next=row.version+1;
      const previous=(await client.query('SELECT version,metadata,snapshot,(SELECT count(*)::int FROM course_releases WHERE course_id=$1) AS ordinal FROM course_releases WHERE course_id=$1 ORDER BY version DESC LIMIT 1',[id])).rows[0];
      const hash=contentHash(course),reused=Boolean(previous&&(previous.metadata.contentHash||contentHash(previous.snapshot))===hash);
      const ordinal=reused?(Number(previous.metadata.publicationVersion)||previous.ordinal):(Number(previous?.metadata.publicationVersion)||previous?.ordinal||0)+1;
      const label=publicationLabel(ordinal),releaseVersion=reused?previous.version:next;
      if(!reused)await client.query('INSERT INTO course_releases(course_id,version,metadata,snapshot) VALUES($1,$2,$3::jsonb,$4::jsonb)',[id,next,JSON.stringify({...courseMetadata(course),contentHash:hash,publicationVersion:ordinal,publicationLabel:label}),JSON.stringify(course)]);
      await client.query("UPDATE courses SET status='published',published_version=$2,version=$3,updated_at=now() WHERE id=$1",[id,releaseVersion,next]);
      await audit(user,'publish_course','course',id,{version:label,reused},client);return {id,version:next,status:'published',publishedVersion:releaseVersion,publicationVersion:ordinal,publicationLabel:label,reused};
    });
  }
  async function unpublish(user,id,{version}){
    return withTx(async client=>{
      const row=await owned(client,user,id,true);
      if(row.status==='draft'&&[row.version,row.version-1].includes(Number(version)))return {id,version:row.version,status:'draft'};
      expected(row,version);
      if(row.status!=='published')fail(409,'Khóa học này chưa được xuất bản.');
      await client.query("UPDATE courses SET status='draft',version=version+1,updated_at=now() WHERE id=$1",[id]);
      await audit(user,'unpublish_course','course',id,{},client);return {id,version:row.version+1,status:'draft'};
    });
  }
  async function archive(user,id,{version}){
    return withTx(async client=>{const row=await owned(client,user,id,true);
      if(row.status==='archived'&&row.version===Number(version)+1)return {id,version:row.version,status:'archived'};
      expected(row,version);
      await client.query("UPDATE courses SET status='archived',version=version+1,updated_at=now() WHERE id=$1",[id]);
      await audit(user,'archive_course','course',id,{},client);return {id,version:row.version+1,status:'archived'};
    });
  }
  async function enroll(user,id){
    student(user);
    return withTx(async client=>{
      const row=(await client.query("SELECT c.published_version,r.metadata FROM courses c JOIN course_releases r ON r.course_id=c.id AND r.version=c.published_version WHERE c.id=$1 AND c.status='published' FOR UPDATE OF c",[id])).rows[0];
      if(!row)fail(404,'Khóa học không nhận đăng ký.');
      const price=Number(row.metadata.price),status=price===0?'active':'pending';
      const found=(await client.query('SELECT id,status,amount FROM course_enrollments WHERE course_id=$1 AND student_id=$2',[id,user.id])).rows[0];
      if(found)return found;
      const key=uid('enrollment');
      await client.query('INSERT INTO course_enrollments(id,course_id,student_id,release_version,status,amount) VALUES($1,$2,$3,$4,$5,$6)',[key,id,user.id,row.published_version,status,price]);
      await audit(user,'enroll_course','course',id,{enrollmentId:key,status,amount:price},client);return {id:key,status,amount:price};
    });
  }
  async function remove(user,id,{version}){
    return withTx(async client=>{
      const row=await owned(client,user,id,true,true);
      if(row.metadata.deletedAt)return {id,version:row.version,status:'archived'};
      expected(row,version);
      await client.query("UPDATE courses SET status='archived',metadata=metadata||jsonb_build_object('deletedAt',now()),version=version+1,updated_at=now() WHERE id=$1",[id]);
      await audit(user,'trash_course','course',id,{},client);return {id,version:row.version+1,status:'archived'};
    });
  }
  async function restore(user,id,{version}){
    if(user.role!=='master')fail(403,'Chỉ quản trị cấp cao được khôi phục từ Thùng rác.');
    return withTx(async client=>{
      const row=await owned(client,user,id,true,true);
      if(!row.metadata.deletedAt)return {id,version:row.version,status:row.status};
      expected(row,version);
      await client.query("UPDATE courses SET status='draft',metadata=metadata-'deletedAt',version=version+1,updated_at=now() WHERE id=$1",[id]);
      await audit(user,'restore_course','course',id,{},client);return {id,version:row.version+1,status:'draft'};
    });
  }
  async function confirmEnrollment(user,id,enrollmentId,{approve}){
    if(user.role!=='master')fail(403,'Chỉ quản trị được xác nhận học phí và mở khóa đăng ký.');
    if(typeof approve!=='boolean')fail(400,'Trạng thái xác nhận không hợp lệ.');
    return withTx(async client=>{
      const row=(await client.query('SELECT * FROM course_enrollments WHERE id=$1 AND course_id=$2 FOR UPDATE',[enrollmentId,id])).rows[0];
      if(!row)fail(404,'Không tìm thấy đăng ký.');
      const status=approve?'active':'rejected';
      if(row.status===status)return {id:enrollmentId,status};
      if(row.status!=='pending')fail(409,'Đăng ký này đã được xử lý.');
      await client.query('UPDATE course_enrollments SET status=$2,confirmed_by=$3,confirmed_at=now() WHERE id=$1',[enrollmentId,status,user.id]);
      await audit(user,'confirm_course_enrollment','course',id,{enrollmentId,status},client);return {id:enrollmentId,status};
    });
  }
  async function getLesson(user,id,lessonId){
    let member;
    try{member=await enrollment(db,user,id);}catch(error){if(error.statusCode!==403)throw error;}
    let snapshot=member?.snapshot;
    if(!snapshot){const row=(await query("SELECT r.snapshot FROM courses c JOIN course_releases r ON r.course_id=c.id AND r.version=c.published_version WHERE c.id=$1 AND c.status='published'",[id])).rows[0];snapshot=row?.snapshot;}
    if(!snapshot)fail(404,'Không tìm thấy khóa học.');
    const lesson=lessonIn(snapshot,lessonId);if(!member&&!lesson.trial)fail(403,'Bạn chưa được mở quyền học bài này.');
    const state=member?(await query('SELECT answers,revision,completed_at,last_seen_at FROM course_progress WHERE enrollment_id=$1 AND lesson_id=$2',[member.id,lessonId])).rows[0]:null;
    const last=member?(await query('SELECT id,result,created_at FROM course_submissions WHERE enrollment_id=$1 AND lesson_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1',[member.id,lessonId])).rows[0]:null;
    return {lesson:lesson.kind==='exercise'?{...lesson,exercise:publicCourseExercise(lesson.exercise)}:lesson,trial:!member,
      draft:state?.answers||{},revision:state?.revision||0,completedAt:state?.completed_at||null,
      hasDraft:Boolean(state&&last&&new Date(state.last_seen_at)>new Date(last.created_at)),result:last?{id:last.id,...last.result,createdAt:last.created_at}:null};
  }
  async function saveProgress(user,id,lessonId,{answers={},complete=false,revision=0,operationKey}){
    if(operationKey!==undefined&&!/^[\w-]{16,100}$/.test(String(operationKey)))fail(400,'Mã lưu tiến độ không hợp lệ.');
    return withTx(async client=>{
      const member=await enrollment(client,user,id,true),lesson=lessonIn(member.snapshot,lessonId);
      if(complete&&lesson.kind!=='knowledge')fail(400,'Bài tập chỉ hoàn thành sau khi nộp và chấm tự động.');
      const clean=lesson.kind==='exercise'?normalize(()=>validateCourseAnswers(lesson.exercise,answers)):{};
      const previous=(await client.query('SELECT revision,last_operation,completed_at FROM course_progress WHERE enrollment_id=$1 AND lesson_id=$2',[member.id,lessonId])).rows[0];
      if(operationKey&&previous?.last_operation===operationKey)return {revision:previous.revision,completedAt:previous.completed_at};
      if(complete&&lesson.kind==='knowledge'&&previous?.completed_at)return {revision:previous.revision,completedAt:previous.completed_at};
      if((previous?.revision||0)!==Number(revision))fail(409,'Bài học đã thay đổi ở tab khác. Vui lòng tải lại.');
      const result=await client.query(`INSERT INTO course_progress(enrollment_id,lesson_id,answers,completed_at,last_operation) VALUES($1,$2,$3::jsonb,CASE WHEN $4::boolean THEN now() ELSE NULL END,$5)
        ON CONFLICT(enrollment_id,lesson_id) DO UPDATE SET answers=EXCLUDED.answers,revision=course_progress.revision+1,
        completed_at=coalesce(course_progress.completed_at,EXCLUDED.completed_at),last_seen_at=now(),last_operation=EXCLUDED.last_operation RETURNING revision,completed_at`,[member.id,lessonId,JSON.stringify(clean),Boolean(complete),operationKey||null]);
      return {revision:result.rows[0].revision,completedAt:result.rows[0].completed_at};
    });
  }
  async function submit(user,id,lessonId,{answers,requestKey}){
    if(!/^[\w-]{16,100}$/.test(String(requestKey)))fail(400,'Mã nộp bài không hợp lệ.');
    return withTx(async client=>{
      const member=await enrollment(client,user,id,true),lesson=lessonIn(member.snapshot,lessonId);
      if(lesson.kind!=='exercise')fail(400,'Bài học này không phải bài tập.');
      const prior=(await client.query('SELECT id,lesson_id,result FROM course_submissions WHERE enrollment_id=$1 AND request_key=$2',[member.id,requestKey])).rows[0];
      if(prior){if(prior.lesson_id!==lessonId)fail(409,'Mã nộp bài đã dùng cho bộ bài khác.');const p=(await client.query('SELECT revision FROM course_progress WHERE enrollment_id=$1 AND lesson_id=$2',[member.id,lessonId])).rows[0];return {id:prior.id,...prior.result,revision:p?.revision||0};}
      const result=normalize(()=>gradeCourseExercise(lesson.exercise,answers)),key=uid('practice');
      await client.query('INSERT INTO course_submissions(id,enrollment_id,lesson_id,request_key,result) VALUES($1,$2,$3,$4,$5::jsonb)',[key,member.id,lessonId,requestKey,JSON.stringify(result)]);
      const saved=await client.query(`INSERT INTO course_progress(enrollment_id,lesson_id,answers,completed_at) VALUES($1,$2,$3::jsonb,now()) ON CONFLICT(enrollment_id,lesson_id) DO UPDATE SET answers=EXCLUDED.answers,revision=course_progress.revision+1,completed_at=coalesce(course_progress.completed_at,now()),last_seen_at=now() RETURNING revision`,[member.id,lessonId,JSON.stringify(result.answers)]);
      await audit(user,'submit_course_exercise','course',id,{lessonId,submissionId:key,score:result.score},client);return {id:key,...result,revision:saved.rows[0].revision};
    });
  }
  async function members(user,id){
    await owned(db,user,id);
    const result=await query(`SELECT e.id,e.status,e.amount,e.created_at,e.release_version,u.id AS student_id,u.data->>'name' AS name,u.email,
      (SELECT count(*)::int FROM course_progress p WHERE p.enrollment_id=e.id AND p.completed_at IS NOT NULL) AS completed,
      r.metadata->>'lessonCount' AS total FROM course_enrollments e JOIN users u ON u.id=e.student_id JOIN course_releases r ON r.course_id=e.course_id AND r.version=e.release_version WHERE e.course_id=$1 ORDER BY e.created_at DESC LIMIT 500`,[id]);
    return {members:result.rows};
  }
  async function memberResults(user,id,enrollmentId){
    await owned(db,user,id);
    const member=(await query('SELECT e.id,r.snapshot FROM course_enrollments e JOIN course_releases r ON r.course_id=e.course_id AND r.version=e.release_version WHERE e.course_id=$1 AND e.id=$2',[id,enrollmentId])).rows[0];if(!member)fail(404,'Không tìm thấy đăng ký.');
    const titles=new Map(courseLessons(member.snapshot).map(lesson=>[lesson.id,lesson.title]));
    return {submissions:(await query('SELECT id,lesson_id,result,created_at FROM course_submissions WHERE enrollment_id=$1 ORDER BY created_at DESC LIMIT 300',[enrollmentId])).rows.map(row=>({...row,lessonTitle:titles.get(row.lesson_id)||row.lesson_id}))};
  }
  async function sources(user,examId,sectionId){
    teacher(user);
    if(!examId){
      const rows=(await query(`SELECT id,data->>'title' AS title,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s->>'id','name',s->>'name','skill',s->>'skill')),'[]'::jsonb) FROM jsonb_array_elements(coalesce(data->'sections','[]'::jsonb)) s WHERE coalesce(s->>'skillKey','') NOT IN ('writing','speaking') AND coalesce(s->'questionProfile'->>'type','') NOT IN ('writing','speaking')) AS sections FROM exams WHERE status<>'trash'${user.role==='master'?'':' AND owner_id=$1'} ORDER BY updated_at DESC LIMIT 300`,user.role==='master'?[]:[user.id])).rows;
      return {exams:rows};
    }
    const exam=(await query(`SELECT id,owner_id,data FROM exams WHERE id=$1 AND status<>'trash'${user.role==='master'?'':' AND owner_id=$2'}`,[examId,...(user.role==='master'?[]:[user.id])])).rows[0];if(!exam)fail(403,'Bạn không được sao chép đề này.');
    const section=exam.data.sections?.find(item=>item.id===sectionId);if(!section)fail(404,'Không tìm thấy phần thi.');
    const rows=(await query(`SELECT id,data FROM questions WHERE id=ANY($1::text[])${user.role==='master'?'':' AND owner_id=$2'}`,[section.questionIds||[],...(user.role==='master'?[]:[user.id])])).rows;
    if(rows.length!==(section.questionIds||[]).length)fail(403,'Không được sao chép câu hỏi không thuộc quyền quản lý.');
    const map=new Map(rows.map(row=>[row.id,{...row.data,id:row.id}]));
    return normalize(()=>normalizeCourseExercise({section,questions:(section.questionIds||[]).map(key=>map.get(key))}));
  }
  async function tryExercise(user,id,lessonId,{answers}){
    const row=(await query("SELECT r.snapshot FROM courses c JOIN course_releases r ON r.course_id=c.id AND r.version=c.published_version WHERE c.id=$1 AND c.status='published'",[id])).rows[0];
    if(!row)fail(404,'Không tìm thấy khóa học.');
    const lesson=lessonIn(row.snapshot,lessonId);if(!lesson.trial||lesson.kind!=='exercise')fail(403,'Bài tập này không cho học thử.');
    return normalize(()=>gradeCourseExercise(lesson.exercise,answers));
  }
  return {catalog,getCourse,byUrl,save,publish,unpublish,archive,remove,restore,enroll,confirmEnrollment,getLesson,saveProgress,submit,tryExercise,members,memberResults,sources};
}
