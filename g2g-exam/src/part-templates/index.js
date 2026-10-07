import {renderBuilder as renderDefaultBuilder,bindBuilder as bindDefaultBuilder} from './default/builder.js';
import {renderBuilder as renderA1ListeningPart1Builder,bindBuilder as bindA1ListeningPart1Builder} from './a1-listening-part-1/builder.js';

const loaders={
  A1_LISTENING_PART_1:()=>import('./a1-listening-part-1/index.js'),
};
const builders={
  A1_LISTENING_PART_1:{render:renderA1ListeningPart1Builder,bind:bindA1ListeningPart1Builder},
};
const fallbackBuilder={render:renderDefaultBuilder,bind:bindDefaultBuilder};

export function hasPartTemplate(type){return Boolean(loaders[type]);}
export function renderPartBuilder(type,options={}){return (builders[type]||fallbackBuilder).render(options);}
export function bindPartBuilder(type,options={}){return (builders[type]||fallbackBuilder).bind(options);}

async function loadPartTemplate(type){
  const load=loaders[type];
  if(!load)throw new Error(`Chưa có module cho template ${type||'không xác định'}.`);
  return load();
}

export async function openPartTemplate(type,options={}){
  const module=await loadPartTemplate(type);
  if(typeof module.openEditor!=='function')throw new Error(`Template ${type} chưa có editor.`);
  return module.openEditor(options);
}

export async function mountPartTemplateStudent(type,options={}){
  const module=await loadPartTemplate(type);
  if(typeof module.mountStudentRuntime!=='function')return;
  return module.mountStudentRuntime(options);
}
