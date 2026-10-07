import {GOETHE_SPECS,GOETHE_LEVELS} from './goethe.js';
import {TELC_SPECS,TELC_LEVELS} from './telc.js';

const PROVIDERS={GOETHE:GOETHE_SPECS,TELC:TELC_SPECS};
const LEVELS={GOETHE:GOETHE_LEVELS,TELC:TELC_LEVELS};

export function getExamSpec(provider,level){
  return PROVIDERS[String(provider||'').toUpperCase()]?.[String(level||'').toUpperCase()]||null;
}

export function getProviderLevels(provider){
  return [...(LEVELS[String(provider||'').toUpperCase()]||[])];
}

export function isConfiguredExamSpec(provider,level){
  return Boolean(getExamSpec(provider,level)?.configured);
}

export function buildSectionsFromSpec(spec,{idFactory=(index)=>`sec-${Date.now()}-${index+1}`}={}){
  if(!spec?.configured)throw new Error('Cấu trúc đề này chưa được cấu hình.');
  let index=0;
  return spec.skills.flatMap(skill=>skill.parts.map(item=>({
    id:idFactory(index++),
    name:item.name,
    skill:skill.label,
    skillKey:skill.key,
    templateType:item.templateType||'GENERIC',
    questionLimit:Number(item.questionLimit||0),
    timeMinutes:Number(skill.defaultTimeMinutes||30),
    maxScore:0,
    showTimer:true,
    autoSubmit:true,
    shuffle:false,
    questionIds:[],
  })));
}

export function buildSkillSettings(spec){
  if(!spec?.configured)return {};
  return Object.fromEntries(spec.skills.map(skill=>[
    skill.label,
    {timeMinutes:Number(skill.defaultTimeMinutes||30),defaultQuestionScore:Number(skill.defaultQuestionScore??1)},
  ]));
}

export function groupSectionsBySkill(exam,spec=getExamSpec(exam?.provider,exam?.level)){
  const sections=exam?.sections||[];
  const labels=(spec?.skills||[]).map(skill=>skill.label);
  const discovered=[...new Set(sections.map(section=>section.skill||'Khác'))];
  const order=[...labels,...discovered.filter(label=>!labels.includes(label))];
  return order.map(label=>[label,sections.filter(section=>(section.skill||'Khác')===label)]).filter(([,items])=>items.length);
}
