import {normalizeCourseSlug} from './course-url.js';
import {scoreQuestion} from './question-score.js';
import {letterAnswerError} from './letter-answers.js';
import {isPrefilledQuestion} from './question-display.js';
import {inlineGapErrors} from './inline-gaps.js';
import {normalizeKnowledgeBlocks,knowledgeBlocks} from './course-knowledge.js';

export const COURSE_LEVELS=['A1','A2','B1','B2','C1','C2'];
export const COURSE_EXERCISE_TYPES={
  choices:{label:'Chọn đáp án',type:'single',layout:'choices',choices:['A','B','C'],choiceImages:true},
  binary:{label:'Đúng / Sai',type:'truefalse',layout:'true-false',choices:['Richtig','Falsch'],choiceImages:false},
  multiple:{label:'Chọn nhiều đáp án',type:'multiple',layout:'choices',choices:['A','B','C','D'],choiceImages:true},
  listening:{label:'Nghe và chọn đáp án',type:'single',layout:'choices',choices:['A','B','C'],audio:true,choiceImages:true},
  letters:{label:'Ghép chữ cái',type:'single',layout:'letter-select',choices:['A','B','C','D','E','F','X'],uniqueLetters:true,repeatableLetters:['X']},
  headings:{label:'Ghép tiêu đề',type:'single',layout:'heading-match',choices:['A','B','C','D','E','F'],uniqueLetters:true},
  gaps:{label:'Điền khuyết lựa chọn',type:'cloze',layout:'inline-gaps',choices:['A','B','C'],uniqueLetters:true,dynamicGapOptions:true},
  matching:{label:'Ghép cặp',type:'matching',layout:'matching',choices:[]},
};
const text=(value,max=20000)=>String(value??'').slice(0,max);
const id=value=>{const out=text(value,100);if(!/^[\w-]{1,100}$/.test(out))throw new Error('Mã nội dung không hợp lệ.');return out;};
const number=(value,max=1000000000)=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>max)throw new Error('Giá trị số không hợp lệ.');return n;};
export function courseMediaUrl(value){
  const url=text(value,2000).trim();
  if(!url||/^\/(?:uploads|media|api\/media)\//.test(url))return url;
  try{const parsed=new URL(url);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)return parsed.href;}catch{}
  throw new Error('Địa chỉ hình ảnh hoặc audio không hợp lệ.');
}
const block=value=>({text:text(value?.text),imageUrl:courseMediaUrl(value?.imageUrl),imageMaxWidth:value?.imageMaxWidth||null,audioUrl:courseMediaUrl(value?.audioUrl),audioName:text(value?.audioName,200)});
const choice=value=>typeof value==='object'?{text:text(value?.text,4000),imageUrl:courseMediaUrl(value?.imageUrl)}:text(value,4000);
const list=(value,max)=>{if(!Array.isArray(value)||value.length>max)throw new Error('Số lượng nội dung không hợp lệ.');return value;};

export function normalizeCourseQuestion(q){
  if(!['single','truefalse','cloze','matching','multiple'].includes(q?.type))throw new Error('Bài luyện tập chỉ dùng câu hỏi chấm tự động.');
  return {id:id(q.id),type:q.type,title:text(q.title,8000),prompt:text(q.prompt),instruction:text(q.instruction),
    instructionImageUrl:courseMediaUrl(q.instructionImageUrl),instructionImageMaxWidth:q.instructionImageMaxWidth||null,
    instructionBlocks:list(q.instructionBlocks||[],30).map(block),audioUrl:courseMediaUrl(q.audioUrl),audioName:text(q.audioName,200),
    choices:list(q.choices||[],30).map(choice),pairs:list(q.pairs||[],30).map(pair=>[text(pair?.[0],2000),text(pair?.[1],2000)]),
    correctAnswer:q.type==='multiple'?list(q.correctAnswer||[],30).map(Number):q.correctAnswer==null||q.correctAnswer===''?null:Number(q.correctAnswer),
    maxScore:number(q.maxScore??1,1000),autoGrade:true,example:Boolean(q.example),explanation:text(q.explanation,8000)};
}

export function normalizeCourseExercise(value={}){
  const profile=value.section?.questionProfile||{},layout=profile.layout||'choices';
  if(!['choices','true-false','letter-select','letter-table','heading-match','inline-gaps','matching'].includes(layout))throw new Error('Mẫu bài tập này chưa hỗ trợ luyện tập tự động.');
  const questions=list(value.questions||[],150).map(normalizeCourseQuestion),ids=questions.map(q=>q.id);
  if(new Set(ids).size!==ids.length)throw new Error('Các câu hỏi phải có mã khác nhau.');
  const source=value.section||{};
  const section={id:id(source.id||'practice'),name:text(source.name||'Bài tập',200),questionLimit:questions.length,templateType:'GENERIC',skillKey:source.skillKey==='listening'||profile.audio?'listening':'reading',
    skill:source.skillKey==='listening'?'Nghe':'Đọc',instruction:text(source.instruction),instructionImageUrl:courseMediaUrl(source.instructionImageUrl),
    instructionImageMaxWidth:source.instructionImageMaxWidth||null,instructionAudioUrl:courseMediaUrl(source.instructionAudioUrl),
    instructionAfterQuestion:Number(source.instructionAfterQuestion)||0,instructionAfterExample:Number(source.instructionAfterExample)||0,
    additionalInstructions:list(source.additionalInstructions||[],30).map(item=>({...block(item),afterQuestion:Number(item.afterQuestion)||0,afterExample:Number(item.afterExample)||0})),
    gapPassage:list(source.gapPassage||[],400).map(part=>typeof part==='string'?text(part):part?.example?{example:true}:{gap:Math.max(0,Math.min(149,Number(part?.gap)||0))}),
    gapTitle:text(source.gapTitle,200),gapExample:text(source.gapExample,2000),
    gapOptions:list(source.gapOptions||[],150).map(item=>Array.isArray(item)?list(item,30).map(v=>text(v,4000)):text(item,4000)),
    headingOptions:list(source.headingOptions||[],30).map(v=>text(v,4000)),
    readingBlocks:list(source.readingBlocks||[],30).map(item=>({...block(item),title:text(item?.title,200)})),
    audioPolicy:{mode:'per_question_segment',maxSessions:1,segmentRepeat:Math.max(1,Math.min(2,Number(source.audioPolicy?.segmentRepeat)||1))},
    gapSentences:list(source.gapSentences||[],100).map(v=>text(v,4000)),
    headings:list(source.headings||[],30).map(v=>text(v,4000)),tableHeading:text(source.tableHeading||'Person',100),questionIds:ids,
    questionProfile:{type:profile.type||questions[0]?.type||'single',layout,choices:list(profile.choices||['A','B','C'],30).map(v=>text(v,200)),
      audio:Boolean(profile.audio),choiceImages:Boolean(profile.choiceImages),instructionImage:true,questionImage:Boolean(profile.questionImage),
      uniqueLetters:layout==='heading-match'||Boolean(profile.uniqueLetters),repeatableLetters:list(profile.repeatableLetters||[],30).map(v=>text(v,10)),
      gapSplitLayout:false,inlineExample:Boolean(profile.inlineExample),gapChoicesPerQuestion:Boolean(profile.gapChoicesPerQuestion),
      dynamicGapOptions:Boolean(profile.dynamicGapOptions),readingBlocks:Boolean(profile.readingBlocks)},
  };
  if(profile.pairedQuestions){
    section.questionProfile.pairedQuestions=true;
    section.questionProfile.pairProfiles=list(profile.pairProfiles||[],2).map(p=>({type:['single','truefalse','cloze'].includes(p.type)?p.type:'single',layout:p.layout||'choices',
      choices:list(p.choices||['A','B','C'],30).map(v=>text(v,200)),choiceImages:Boolean(p.choiceImages),audio:Boolean(p.audio),instructionImage:Boolean(p.instructionImage)}));
    if(section.questionProfile.pairProfiles.length!==2)throw new Error('Mẫu câu cặp cần đúng hai kiểu câu.');
  }
  return {section,questions};
}

export function courseLessons(course){return (course.chapters||[]).flatMap(chapter=>[...(chapter.knowledge||[]),...(chapter.exercises||[])]);}
export function normalizeCourse(input={}){
  const seen=new Set(),takeId=value=>{const key=id(value);if(seen.has(key))throw new Error('Mã chương/bài học bị trùng.');seen.add(key);return key;};
  const price=number(input.price??0);if(!Number.isSafeInteger(price))throw new Error('Học phí phải là số nguyên VND.');
  const chapters=list(input.chapters||[],50).map(chapter=>({id:takeId(chapter.id),title:text(chapter.title,200),
    knowledge:list(chapter.knowledge||[],100).map(lesson=>({id:takeId(lesson.id),kind:'knowledge',title:text(lesson.title,200),body:text(lesson.body,100000),imageUrl:courseMediaUrl(lesson.imageUrl),trial:Boolean(lesson.trial),...(lesson.blocks!==undefined?normalizeKnowledgeBlocks(lesson.blocks,courseMediaUrl):{})})),
    exercises:list(chapter.exercises||[],100).map(lesson=>({id:takeId(lesson.id),kind:'exercise',title:text(lesson.title,200),trial:Boolean(lesson.trial),exercise:normalizeCourseExercise(lesson.exercise)})),
  }));
  const result={title:text(input.title,200),coverUrl:courseMediaUrl(input.coverUrl),price,level:COURSE_LEVELS.includes(input.level)?input.level:'A1',
    shortDescription:text(input.shortDescription,600),description:text(input.description,30000),chapters};
  if(input.slug!==undefined)result.slug=normalizeCourseSlug(input.slug);
  if(input.descriptionBlocks!==undefined){
    const content=normalizeKnowledgeBlocks(input.descriptionBlocks,courseMediaUrl);
    if(content.body.length>30000)throw new Error('Mô tả khóa học tối đa 30.000 ký tự.');
    result.description=content.body;result.descriptionBlocks=content.blocks;
  }
  if(courseLessons(result).length>300||JSON.stringify(result).length>800000)throw new Error('Khóa học quá lớn. Vui lòng chia nhỏ nội dung.');
  return result;
}

export function assertCoursePublishable(course){
  if(!course.title.trim()||!course.shortDescription.trim()||!course.coverUrl)throw new Error('Cần tên khóa học, ảnh đại diện và mô tả ngắn trước khi xuất bản.');
  if(!course.chapters.length||!courseLessons(course).length)throw new Error('Khóa học cần ít nhất một chương có bài học.');
  for(const chapter of course.chapters){
    if(!chapter.title.trim())throw new Error('Vui lòng đặt tên chương.');
    for(const lesson of [...chapter.knowledge,...chapter.exercises]){
      if(!lesson.title.trim())throw new Error('Vui lòng đặt tên bài học.');
      if(lesson.kind==='knowledge'&&!knowledgeBlocks(lesson).some(block=>block.type==='youtube'?block.videoId:block.type==='image'?block.url:block.text.trim()))throw new Error(`Bài “${lesson.title}” chưa có nội dung.`);
      if(lesson.kind==='exercise'){
        if(lesson.exercise.section.questionProfile.pairedQuestions&&lesson.exercise.questions.length%2)throw new Error('Bài tập dạng cặp cần đủ hai câu mỗi nhóm.');
        const gapErrors=inlineGapErrors(lesson.exercise.section);if(gapErrors.length)throw new Error(gapErrors[0]);
        const scored=lesson.exercise.questions.filter(q=>!isPrefilledQuestion(q));
        if(!scored.length)throw new Error(`Bộ bài “${lesson.title}” chưa có câu hỏi.`);
        for(const q of lesson.exercise.questions){
          if(q.type==='matching'){if(!q.pairs.length||q.pairs.some(pair=>!pair[0].trim()||!pair[1].trim()))throw new Error('Câu ghép cặp chưa đầy đủ.');continue;}
          if(q.choices.length<2||q.choices.some(c=>!(typeof c==='object'?c.text?.trim()||c.imageUrl:c.trim())))throw new Error('Cần điền đầy đủ các phương án.');
          const indices=q.type==='multiple'?q.correctAnswer:[q.correctAnswer];
          if(!indices.length||indices.some(n=>!Number.isInteger(n)||n<0||n>=q.choices.length)||new Set(indices).size!==indices.length)throw new Error('Cần chọn đáp án đúng hợp lệ cho mỗi câu.');
        }
      }
    }
  }
}

export function courseMetadata(course){return {...(course.slug!==undefined?{slug:course.slug}:{}),title:course.title,coverUrl:course.coverUrl,price:course.price,level:course.level,shortDescription:course.shortDescription,chapterCount:course.chapters.length,lessonCount:courseLessons(course).length};}
export function courseOutline(course){return course.chapters.map(chapter=>({id:chapter.id,title:chapter.title,knowledge:chapter.knowledge.map(outlineLesson),exercises:chapter.exercises.map(outlineLesson)}));}
const outlineLesson=lesson=>({id:lesson.id,title:lesson.title,kind:lesson.kind,trial:lesson.trial,questionCount:lesson.kind==='exercise'?lesson.exercise.questions.filter(q=>!isPrefilledQuestion(q)).length:0});

export function publicCourseExercise(exercise){
  return {section:exercise.section,questions:exercise.questions.map(q=>{
    const {correctAnswer,explanation,pairs,...visible}=q;
    if(isPrefilledQuestion(q))return {...visible,correctAnswer,pairs};
    return {...visible,...(q.type==='matching'?{pairs:pairs.map(pair=>[pair[0],'']),matchOptions:[...new Set(pairs.map(pair=>pair[1]))].sort()}: {})};
  })};
}

export function validateCourseAnswers(exercise,answers,{complete=false}={}){
  if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new Error('Câu trả lời không hợp lệ.');
  const ids=new Set(exercise.questions.map(q=>q.id));
  if(Object.keys(answers).some(key=>!ids.has(key)))throw new Error('Câu trả lời không thuộc bài tập này.');
  const normalized={};
  for(const q of exercise.questions){
    if(isPrefilledQuestion(q))continue;
    const value=answers[q.id],blank=value==null||value==='';
    if(blank){if(complete)throw new Error('Vui lòng trả lời đầy đủ trước khi kiểm tra.');continue;}
    if(q.type==='matching'){
      const options=new Set(q.matchOptions||q.pairs.map(pair=>pair[1]));
      if(!Array.isArray(value)||value.length>q.pairs.length||value.some(v=>v!==''&&!options.has(v))||complete&&(value.length!==q.pairs.length||value.some(v=>!v)))throw new Error('Câu ghép cặp chưa hợp lệ.');
      normalized[q.id]=value.map(String);
    }else if(q.type==='multiple'){
      if(!Array.isArray(value)||value.length>q.choices.length||new Set(value).size!==value.length||value.some(n=>!Number.isInteger(n)||n<0||n>=q.choices.length)||complete&&!value.length)throw new Error('Các phương án đã chọn không hợp lệ.');
      normalized[q.id]=[...value].sort((a,b)=>a-b);
    }else{
      const n=Number(value);if(!Number.isInteger(n)||n<0||n>=q.choices.length)throw new Error('Phương án đã chọn không hợp lệ.');normalized[q.id]=n;
    }
  }
  const error=letterAnswerError(exercise.section,exercise.questions,normalized);if(error)throw new Error(error);
  return normalized;
}

export function gradeCourseExercise(exercise,answers){
  const clean=validateCourseAnswers(exercise,answers,{complete:true});
  const items=exercise.questions.filter(q=>!isPrefilledQuestion(q)).map(q=>{
    const answer=clean[q.id],score=q.type==='multiple'
      ?JSON.stringify(answer)===JSON.stringify([...q.correctAnswer].sort((a,b)=>a-b))?q.maxScore:0
      :scoreQuestion(q,answer);
    return {id:q.id,title:q.title||q.prompt,answer,correctAnswer:q.correctAnswer,pairs:q.pairs,choices:q.choices,maxScore:q.maxScore,score,explanation:q.explanation};
  });
  return {answers:clean,items,score:Math.round(items.reduce((sum,item)=>sum+item.score,0)*100)/100,maxScore:items.reduce((sum,item)=>sum+item.maxScore,0)};
}
