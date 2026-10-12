import {createExamDraft} from '../src/controllers/exam-factory.js';
import {saveHeadingMatchDraft} from '../src/part-templates/default/heading-match-builder.js';
import {saveInlineGapDraft} from '../src/part-templates/default/inline-gap-builder.js';
import {partAudioQuestions} from '../src/domain/part-audio.js';

export function telcFixture(state,teacher){
  const exam=createExamDraft(state,teacher,{provider:'TELC',level:'B1',title:'TELC B1 sheet regression'});
  const rows=s=>s.questionIds.map(id=>state.questions.find(q=>q.id===id));
  for(const section of exam.sections){
    section.instruction='Aufgabenstellung';
    rows(section).forEach((q,i)=>{q.title='Text '+i;if(section.questionProfile.uniqueLetters)q.correctAnswer=i;});
    if(section.audioPolicy)partAudioQuestions(section,rows(section)).forEach(q=>q.audioUrl='/uploads/telc-fixture.mp3');
  }
  const heading=exam.sections[0];
  const cards=rows(heading).map((q,i)=>({dataset:{questionId:q.id},querySelector:selector=>({value:selector==='[data-heading-answer]'?'Heading '+i:'Passage '+i})}));
  saveHeadingMatchDraft({querySelectorAll:()=>cards},state,teacher,exam,heading);
  for(const index of [3,4]){
    const section=exam.sections[index],perQuestion=index===3;
    const values={'[data-gap-text]':'Example [z]. '+Array.from({length:10},(_,i)=>`Text [${String.fromCharCode(97+(perQuestion?i%3:i))}]`).join(' '),'[data-gap-option="z"]':'Demo','[data-gap-options]':Array.from({length:12},(_,i)=>'Word '+i).join('\n')};
    for(let i=0;i<10;i++)for(let j=0;j<3;j++)values[`[data-gap-choice="${i}-${j}"]`]=`Gap ${i} choice ${j}`;
    saveInlineGapDraft({querySelector:key=>key in values?{value:values[key]}:null},state,teacher,exam,section);
  }
  return {exam,rows};
}
