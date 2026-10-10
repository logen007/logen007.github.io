async function readJson(url){
  if(url.protocol==='file:'){
    const {readFile}=await import('node:fs/promises');
    return JSON.parse(await readFile(url,'utf8'));
  }
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`Không tải được specification: ${url.pathname}`);
  return response.json();
}

function requireApproved(spec,label){
  if(spec?.status!=='APPROVED')throw new Error(`${label} chưa được APPROVED.`);
  return spec;
}

export async function loadApprovedExamSpec(relativePath){
  const examUrl=new URL(relativePath,import.meta.url);
  const source=requireApproved(await readJson(examUrl),`Exam spec ${examUrl.pathname}`);
  const skills=await Promise.all((source.skills||[]).map(async skill=>{
    const parts=await Promise.all((skill.parts||[]).map(async partPath=>{
      const part=requireApproved(await readJson(new URL(partPath,examUrl)),`Part spec ${partPath}`);
      return {
        key:String(part.key||part.id),
        name:String(part.name||part.id),
        questionLimit:Math.max(0,Number(part.questionLimit||0)),
        templateType:String(part.template||'GENERIC'),
        // specs/ là nguồn sự thật cho form authoring của từng phần. Giữ nguyên
        // metadata trình bày ở đây để không phải rải luật Goethe trong UI.
        questionProfile:part.questionProfile&&typeof part.questionProfile==='object'
          ?JSON.parse(JSON.stringify(part.questionProfile))
          :null,
        audioPolicy:part.audio&&typeof part.audio==='object'
          ?JSON.parse(JSON.stringify(part.audio))
          :null,
      };
    }));
    return {
      key:String(skill.key||''),
      label:String(skill.label||skill.key||''),
      defaultTimeMinutes:Math.max(1,Number(skill.defaultTimeMinutes||30)),
      defaultQuestionScore:Math.max(0,Number(skill.defaultQuestionScore??1)),
      parts,
    };
  }));
  return {provider:String(source.provider||'').toUpperCase(),level:String(source.level||'').toUpperCase(),configured:true,skills,...(source.oralMax?{oralMax:Number(source.oralMax)}:{})};
}

export async function loadApprovedPartSpec(relativePath){
  const url=new URL(relativePath,import.meta.url);
  return requireApproved(await readJson(url),`Part spec ${url.pathname}`);
}
