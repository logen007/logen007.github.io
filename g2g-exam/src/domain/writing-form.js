export const WRITING_FORM_TYPES=['heading','note','static','text','truefalse','choice','image','signature'];

const PRESENTATION_TYPES=new Set(['heading','note','static','image','signature']);

export const isScoredWritingField=row=>!row?.hidden&&!PRESENTATION_TYPES.has(String(row?.type||'text'));

export function writingFormScore(rows=[]){
  const total=(Array.isArray(rows)?rows:[]).reduce((sum,row)=>sum+(isScoredWritingField(row)?Math.max(0,Number(row.maxScore)||0):0),0);
  return Math.abs(total-Math.round(total))<0.02?Math.round(total):Number(total.toFixed(2));
}

export function writingOptions(row){
  if(Array.isArray(row.options))return row.options;
  return row.type==='truefalse'?['Ja','Nein']:String(row.answers||'').split('|').map(x=>x.trim()).filter(Boolean);
}

export function addWritingRow(rows,type,index){
  const result=structuredClone(rows||[]),source=result[index];
  if(source?.hidden){result.splice(index,1);result.push({...source,hidden:false});}
  else result.push({type:type||source?.type||'text',label:'',value:'',answers:'',options:['truefalse','choice'].includes(type||source?.type)?['Ja','Nein']:[],maxScore:isScoredWritingField({type:type||source?.type})?1:0,hidden:false,imageUrl:''});
  return result;
}

export function removeWritingRow(rows,index){
  const result=structuredClone(rows||[]),source=result[index];
  if(!source)return result;
  if(result.filter(row=>!row.hidden&&row.type===source.type).length<=1)result[index]={...source,hidden:true};
  else result.splice(index,1);
  return result;
}

// Explicit allowlist: learners need the form, never the teacher's expected answers.
export function publicWritingRows(rows=[]){
  return rows.map(row=>({type:row.type,label:row.label||'',hidden:Boolean(row.hidden),value:isScoredWritingField({...row,hidden:false})?'':String(row.value??row.answers??''),imageUrl:row.imageUrl||'',example:Boolean(row.example),options:['choice','truefalse'].includes(row.type)?writingOptions(row):[],maxScore:row.maxScore||0}));
}
