import {renderPartBuilder,bindPartBuilder} from '../part-templates/index.js';
import {saveInlineGapDraft,bindGapPositions} from '../part-templates/default/inline-gap-builder.js';
import {saveHeadingMatchDraft} from '../part-templates/default/heading-match-builder.js';
import {sectionInstructions,instructionPatch,instructionAudioKey,changeInstructions} from '../domain/section-instructions.js';
import {normalizeCourseExercise,COURSE_EXERCISE_TYPES} from '../domain/courses.js';
import {uploadQuestionImage} from '../media.js';
import {collectReadingBlocks,bindReadingBlocks} from '../ui/reading-blocks.js';
import {imageValue} from '../ui/image-remove.js';
import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';
import {scoreInput} from '../ui/score-input.js';

const key=prefix=>prefix+'-'+crypto.randomUUID();
export function newCourseExercise(type='choices'){
  const profile=structuredClone(COURSE_EXERCISE_TYPES[type]||COURSE_EXERCISE_TYPES.choices);
  return normalizeCourseExercise({section:{id:key('part'),name:profile.label,skillKey:profile.audio?'listening':'reading',questionProfile:profile},questions:[newCourseQuestion(profile)]});
}
export function newCourseQuestion(profile){return {id:key('q'),type:profile.type||'single',title:'',choices:(profile.choices||['A','B','C']).map(letter=>profile.layout==='letter-select'||profile.type==='truefalse'?letter:''),
  correctAnswer:profile.type==='multiple'?[]:null,maxScore:1,autoGrade:true,pairs:profile.type==='matching'?[['',''],['','']]:[],instructionBlocks:[],explanation:''};}
export function courseEditorContext(exercise,user){
  const copy=structuredClone(exercise),section=copy.section;
  section.questionIds=copy.questions.map(q=>q.id);section.questionLimit=copy.questions.length;
  const questions=copy.questions.map(q=>({...q,title:q.title||'Nháp',ownerId:user.id,locked:false,status:'active',skill:section.skill,level:'A1'}));
  const exam={id:'course-editor',ownerId:user.id,status:'draft',sections:[section],settings:{defaultQuestionScore:1}};
  return {section,exam,data:{exams:[exam],questions,attempts:[],auditLog:[]}};
}
function matchingCards(questions){return questions.map(q=>`<article class="goethe-question part-question" data-question-id="${esc(q.id)}" data-editor-mode="course-matching">
  <label>Câu hỏi<textarea class="truong" data-match-prompt>${esc(q.title==='Nháp'?'':q.title)}</textarea></label>
  <div class="nhom-nut">${scoreInput(q.maxScore,{attributes:'data-field="maxScore"',label:'Điểm câu hỏi'})}<button type="button" class="icon-btn" data-action="remove-inline-question" data-id="${esc(q.id)}" aria-label="Bỏ câu">${iconHtml('close')}</button></div>
  ${(q.pairs||[]).map((pair,index)=>`<div class="course-pair" data-course-pair><input class="truong" data-pair-left aria-label="Vế trái ${index+1}" value="${esc(pair[0])}"><input class="truong" data-pair-right aria-label="Vế phải đúng ${index+1}" value="${esc(pair[1])}"><button type="button" class="icon-btn" data-course-action="remove-pair" data-q="${esc(q.id)}" data-index="${index}" aria-label="Bỏ cặp">${iconHtml('close')}</button></div>`).join('')}
  <button type="button" class="nut nho" data-course-action="add-pair" data-q="${esc(q.id)}">${iconHtml('plus')} Thêm cặp</button></article>`).join('');}
export function courseExerciseEditorHtml(context){
  const {data,exam,section}=context,matching=section.questionProfile.type==='matching';
  return `<div class="course-exercise-editor" data-course-exercise-editor>${renderPartBuilder('GENERIC',{data:matching?{...data,questions:[]}:data,exam,section})}${matching?matchingCards(data.questions):''}</div>`;
}
export function bindCourseExerciseEditor(root,context,pending,notify,onDirty){
  bindPartBuilder('GENERIC',{root,...context,pendingAudioUploads:pending,notify});
  bindGapPositions(root,context.section);bindReadingBlocks(root,onDirty);
  if(context.section.questionProfile.type==='matching')root.querySelector('.rong')?.remove();
  for(const card of root.querySelectorAll('.part-question')){
    const question=context.data.questions.find(q=>q.id===card.dataset.questionId);if(!question)continue;
    const label=root.ownerDocument.createElement('label');label.className='course-explanation';label.textContent='Giải thích sau khi nộp bài';
    const field=root.ownerDocument.createElement('textarea');field.className='truong';field.dataset.courseExplanation=question.id;field.value=question.explanation||'';label.append(field);(card.hidden?root:card).append(label);
  }
}
async function imageFrom(input,previous,control){
  const file=input?.files?.[0],uploaded=file?await uploadQuestionImage(file,{slot:'course-practice'}):undefined;
  const value=imageValue(input,uploaded,control?.dataset.removeQuestionImage==='true'||control?.dataset.removeSectionImage==='true'?'':previous||'');
  if(file)input.value='';return value;
}
export async function collectCourseExercise(root,context,pending){
  const {data,exam,section}=context;
  const audio=async(key,previous={})=>pending.has(key)?await pending.get(key).promise:{url:previous.audioUrl||'',name:previous.audioName||''};
  const prompts=sectionInstructions(section),blocks=[];
  for(const control of root.querySelectorAll('[data-section-prompt]')){
    const previous=prompts.find(item=>item.id===control.dataset.sectionPrompt)||{};
    const clip=await audio(instructionAudioKey(section,control.dataset.sectionPrompt),previous);
    blocks.push({...previous,text:control.querySelector('[data-prompt-text]')?.value||'',imageUrl:await imageFrom(control.querySelector('[data-section-image],[data-prompt-image]'),previous.imageUrl,control),
      imageMaxWidth:control.querySelector('[data-prompt-width]')?.value||null,audioUrl:clip.url,audioName:clip.name});
  }
  if(blocks.length)Object.assign(section,instructionPatch(blocks));
  const reading=await collectReadingBlocks(root,{slot:'course-reading'});if(reading)section.readingBlocks=reading;
  saveInlineGapDraft(root,data,{id:exam.ownerId,role:'teacher'},exam,section);
  saveHeadingMatchDraft(root,data,{id:exam.ownerId,role:'teacher'},exam,section);
  for(const card of root.querySelectorAll('.part-question')){
    const q=data.questions.find(q=>q.id===card.dataset.questionId);if(!q)continue;
    const explanation=root.querySelector(`[data-course-explanation="${q.id}"]`);if(explanation)q.explanation=explanation.value;
    if(['inline-gaps','heading-match'].includes(card.dataset.editorMode))continue;
    if(q.type==='matching'){
      q.title=card.querySelector('[data-match-prompt]').value;
      q.pairs=[...card.querySelectorAll('[data-course-pair]')].map(pair=>[pair.querySelector('[data-pair-left]').value,pair.querySelector('[data-pair-right]').value]);
      q.maxScore=Number(card.querySelector('[data-field="maxScore"]').value);continue;
    }
    q.title=card.querySelector('[data-field="title"]')?.value||'';
    q.example=card.dataset.example==='true';q.maxScore=Number(card.querySelector('[data-field="maxScore"]')?.value??1);
    const selected=[...card.querySelectorAll('[data-field="correct"]:checked,select[data-field="correct"]')];
    q.correctAnswer=q.type==='multiple'?selected.map(input=>Number(input.value)):selected.length?Number(selected[0].value):null;
    q.choices=await Promise.all([...card.querySelectorAll('[data-choice]')].map(async input=>{
      const old=q.choices[Number(input.dataset.choice)],imageInput=card.querySelector(`[data-choice-image="${input.dataset.choice}"]`);
      const imageUrl=await imageFrom(imageInput,typeof old==='object'?old.imageUrl:'');
      return imageUrl?{text:input.value,imageUrl}:input.value;
    }));
    const clip=await audio(q.id,q);q.audioUrl=clip.url;q.audioName=clip.name;
    q.instructionImageUrl=await imageFrom(card.querySelector('[data-question-card-image]'),q.instructionImageUrl);
    const instructions=[];
    for(const control of card.querySelectorAll('[data-question-instruction-block]')){
      const index=Number(control.dataset.index),old=q.instructionBlocks?.[index]||{},clip=await audio(`question-prompt:${q.id}:${index}`,old);
      instructions.push({...old,text:control.querySelector('[data-instruction-prompt]')?.value||'',imageUrl:await imageFrom(control.querySelector('[data-question-instruction-image]'),old.imageUrl,control),
        imageMaxWidth:control.querySelector('[data-question-prompt-width]')?.value||null,audioUrl:clip.url,audioName:clip.name});
    }
    if(instructions.length){q.instructionBlocks=instructions;q.prompt=instructions[0].text;q.instructionImageUrl=instructions[0].imageUrl;}
  }
  return normalizeCourseExercise({section,questions:data.questions});
}
export function changeCoursePrompt(section,index,action,questions){return changeInstructions(section,index,action,questions);}
