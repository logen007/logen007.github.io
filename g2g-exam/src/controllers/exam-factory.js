import {byId,clone,createExam,createQuestion,updateQuestion,updateExam,addQuestionsToSection} from '../core.js';
import {getExamSpec,buildSectionsFromSpec,buildSkillSettings} from '../exam-specs/index.js';
import {writingFormScore} from '../domain/writing-form.js';

export function questionDraftChoices(profile={}){
  const configured=Array.isArray(profile.choices)&&profile.choices.length>=2?clone(profile.choices):['Nháp','Nháp','Nháp'];
  return profile.layout==='true-false'?configured:configured.map((_,index)=>index<2?'Nháp':'');
}

function populateConfiguredSections(state,user,exam){
  for(const section of exam.sections||[]){
    const required=Math.max(0,Number(section.questionLimit)||0);
    const profile=section.questionProfile||{};
    const choices=questionDraftChoices(profile);
    const hasFormRows=['form-fields','mixed-form'].includes(profile.layout)
    const initialRubric=hasFormRows
      ?Array.from({length:Math.max(1,Number(profile.formFieldCount)||1)},(_,index)=>({type:'text',label:'',answers:'',maxScore:Number(profile.formDefaultScores?.[index]??1),hidden:false,imageUrl:''}))
      :[];
    const initialInstructionBlocks=profile.layout==='mixed-form'?[{text:'',imageUrl:''}]:[];
    for(const [questionIndex,questionId] of (section.questionIds||[]).entries()){
      const question=byId(state.questions,questionId);
      if(!question)continue;
      const patch={};
      if(profile.type&&question.type!==profile.type)patch.type=profile.type;
      if(Array.isArray(profile.choices)&&question.choices?.length>profile.choices.length)patch.choices=question.choices.slice(0,profile.choices.length);
      if(profile.layout==='true-false'&&JSON.stringify(question.choices||[])===JSON.stringify(['Đúng','Sai']))patch.choices=clone(profile.choices||['Richtig','Falsch']);
      if(hasFormRows&&(!Array.isArray(question.rubric)||!question.rubric.length))patch.rubric=clone(initialRubric);
      if(profile.formFrame===true&&question.writingFormVersion!==1)patch.writingFormVersion=1;
      if(profile.layout==='mixed-form'&&!Array.isArray(question.instructionBlocks))patch.instructionBlocks=clone(initialInstructionBlocks);
      if((profile.stimulusStarts||[]).map(Number).includes(questionIndex)&&(!Array.isArray(question.instructionBlocks)||!question.instructionBlocks.length))patch.instructionBlocks=[{text:'',imageUrl:''}];
      if(Object.keys(patch).length)updateQuestion(state,user,questionId,patch);
    }
    const additions=[];
    const realQuestionCount=(section.questionIds||[]).filter(questionId=>!byId(state.questions,questionId)?.example).length;
    for(let index=realQuestionCount;index<required;index++){
      const isStimulusStart=(profile.stimulusStarts||[]).map(Number).includes(index);
      additions.push(createQuestion(state,user,{
        level:exam.level,skill:section.skill,part:section.name,type:profile.type||'single',title:'Nháp',
        choices,correctAnswer:0,
        rubric:clone(initialRubric),
        writingFormVersion:profile.formFrame===true?1:null,
        instructionBlocks:isStimulusStart?[{text:'',imageUrl:''}]:clone(initialInstructionBlocks),
        maxScore:hasFormRows&&initialRubric.length?writingFormScore(initialRubric)+(profile.layout==='mixed-form'?Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??1):0):Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??1),
      }).id);
    }
    if(additions.length)addQuestionsToSection(state,user,exam.id,section.id,additions);
  }
}

export function createExamDraft(state,user,{provider,level,title,stamp=Date.now()}){
  const normalizedProvider=String(provider||'').toUpperCase();
  const spec=getExamSpec(normalizedProvider,level);
  const configured=Boolean(spec?.configured);
  const sections=configured
    ?buildSectionsFromSpec(spec,{idFactory:index=>`sec-${stamp}-${index+1}`})
    :[{id:`sec-${stamp}-1`,name:'Phần 1',timeMinutes:30,maxScore:0,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]}];
  const settings=configured?{skillSettings:buildSkillSettings(spec)}:undefined;
  const exam=createExam(state,user,{title,level,provider:normalizedProvider,settings,sections});
  if(configured)populateConfiguredSections(state,user,exam);
  return exam;
}

export function ensureExamMatchesConfiguredSpec(state,user,examId,{stamp=Date.now()}={}){
  const exam=byId(state.exams,examId);
  if(!exam)return false;
  const spec=getExamSpec(exam.provider,exam.level);
  if(!spec?.configured)return false;
  const expectedSections=buildSectionsFromSpec(spec,{idFactory:index=>`spec-${stamp}-${index+1}`});
  const expected=expectedSections.map(section=>section.name);
  const hasAllParts=expected.every(name=>(exam.sections||[]).some(section=>section.name===name));
  const hasStaleProfile=hasAllParts&&expectedSections.some(expectedSection=>{
    const existing=(exam.sections||[]).find(section=>section.name===expectedSection.name);
    return JSON.stringify(existing?.questionProfile||null)!==JSON.stringify(expectedSection.questionProfile||null)
      ||JSON.stringify(existing?.audioPolicy||null)!==JSON.stringify(expectedSection.audioPolicy||null);
  });
  if(hasAllParts&&!hasStaleProfile)return false;
  if(hasAllParts){
    const expectedByName=new Map(expectedSections.map(section=>[section.name,section]));
    const sections=exam.sections.map(section=>{
      const expectedSection=expectedByName.get(section.name);if(!expectedSection)return section;
      return {...section,questionProfile:expectedSection.questionProfile||null,audioPolicy:expectedSection.audioPolicy||null};
    });
    updateExam(state,user,exam.id,{settings:{skillSettings:{...(exam.settings?.skillSettings||{}),...buildSkillSettings(spec)}},sections});
    populateConfiguredSections(state,user,byId(state.exams,exam.id));
    return true;
  }
  const legacyFirst=exam.sections?.[0];
  const sections=buildSectionsFromSpec(spec,{idFactory:index=>index===0&&legacyFirst?.id?legacyFirst.id:`sec-${stamp}-${index+1}`});
  if(sections[0]&&legacyFirst){
    sections[0].instruction=legacyFirst.instruction||'';
    sections[0].questionIds=legacyFirst.questionIds||[];
  }
  updateExam(state,user,exam.id,{settings:{skillSettings:{...(exam.settings?.skillSettings||{}),...buildSkillSettings(spec)}},sections});
  populateConfiguredSections(state,user,byId(state.exams,exam.id));
  return true;
}
