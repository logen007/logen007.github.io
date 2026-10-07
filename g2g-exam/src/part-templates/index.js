const loaders={
  A1_LISTENING_PART_1:()=>import('../question-groups/bootstrap.js'),
};

export function hasPartTemplate(type){return Boolean(loaders[type]);}

export async function openPartTemplate(type,options={}){
  const load=loaders[type];
  if(!load)throw new Error(`Chưa có editor cho template ${type||'không xác định'}.`);
  const module=await load();
  if(type==='A1_LISTENING_PART_1')return module.openA1ListeningPart1Editor(options);
  throw new Error(`Template ${type} chưa có hàm mở editor.`);
}
