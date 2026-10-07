const loaders={
  A1_LISTENING_PART_1:()=>import('./a1-listening-part-1/index.js'),
};

export function hasPartTemplate(type){return Boolean(loaders[type]);}

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
