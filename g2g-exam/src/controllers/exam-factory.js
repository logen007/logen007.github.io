import {byId,createExam,createQuestion,updateExam,addQuestionsToSection} from '../core.js';
import {getExamSpec,buildSectionsFromSpec,buildSkillSettings} from '../exam-specs/index.js';

function populateConfiguredSections(state,user,exam){
  for(const section of exam.sections||[]){
    const required=Math.max(0,Number(section.questionLimit)||0);
    const additions=[];
    for(let index=(section.questionIds||[]).length;index<required;index++){
      additions.push(createQuestion(state,user,{
        level:exam.level,skill:section.skill,part:section.name,type:'single',title:'Nháp',
        choices:['Nháp','Nháp','Nháp'],correctAnswer:0,
        maxScore:Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??1),
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
  const expected=spec.skills.flatMap(skill=>skill.parts.map(part=>part.name));
  if(expected.every(name=>(exam.sections||[]).some(section=>section.name===name)))return false;
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
