import {byId,updateQuestion,updateSection} from '../core.js';

const DEMO_EXAM_TITLE='GOETHE A1 – Bài test 01';

function needsSample(value){
  return !String(value||'').trim()||String(value).trim()==='Nháp';
}

function sampleChoices(question){
  const choices=question.choices||[];
  return choices.map((choice,index)=>{
    const text=typeof choice==='object'?choice.text:choice;
    const imageUrl=typeof choice==='object'?choice.imageUrl||'':'';
    return {text:needsSample(text)?`Đáp án ${String.fromCharCode(65+index)}`:text,imageUrl};
  });
}

/**
 * This is deliberately only a non-destructive fixture for the named test exam.
 * It supplies placeholder content so the author can inspect the complete flow;
 * approved Goethe/TELC content remains defined only in specs/.
 */
export function populateGoetheA1TestFixture(state,user,examId){
  const exam=byId(state.exams,examId);
  if(!exam||exam.title!==DEMO_EXAM_TITLE)return false;
  let changed=false,ordinal=0;
  for(const section of exam.sections||[]){
    if(needsSample(section.instruction)){
      updateSection(state,user,exam.id,section.id,{instruction:`Dữ liệu mẫu cho ${section.name}.`});
      changed=true;
    }
    for(const questionId of section.questionIds||[]){
      const question=byId(state.questions,questionId);
      if(!question)continue;
      ordinal+=1;
      const patch={};
      if(needsSample(question.title))patch.title=`Câu ${ordinal}`;
      if(question.type==='writing'){
        if(needsSample(question.prompt))patch.prompt=`Nội dung mẫu cho ${section.name}, câu ${ordinal}.`;
        const blocks=Array.isArray(question.instructionBlocks)?question.instructionBlocks:[];
        if(section.name==='Viết 1'&&(!blocks.length||blocks.some(block=>needsSample(block.text)))){
          patch.instructionBlocks=(blocks.length?blocks:[{text:'',imageUrl:''}]).map((block,index)=>({
            text:needsSample(block.text)?`Đề bài mẫu ${index+1}: điền thông tin theo yêu cầu.`:block.text,
            imageUrl:block.imageUrl||'',
          }));
          patch.instructionImageUrl=patch.instructionBlocks[0]?.imageUrl||'';
          patch.prompt=patch.instructionBlocks[0]?.text||patch.prompt||'';
        }
        if(Array.isArray(question.rubric)&&question.rubric.some(row=>needsSample(row.label)||needsSample(row.answers))){
          patch.rubric=question.rubric.map((row,index)=>({
            label:needsSample(row.label)?`Thông tin ${index+1}`:row.label,
            answers:needsSample(row.answers)?`Mẫu ${index+1}`:row.answers,
            maxScore:Number(row.maxScore)||1,
          }));
        }
      }else{
        if(needsSample(question.prompt))patch.prompt=`Nội dung mẫu cho ${section.name}, câu ${ordinal}.`;
        if((question.choices||[]).some(choice=>needsSample(typeof choice==='object'?choice.text:choice)))patch.choices=sampleChoices(question);
        if(!Number.isInteger(question.correctAnswer))patch.correctAnswer=0;
      }
      if(Object.keys(patch).length){updateQuestion(state,user,question.id,patch);changed=true;}
    }
  }
  return changed;
}
