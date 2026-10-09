export const WRITING_FORM_TYPES=['heading','note','text','truefalse','choice','image','signature'];

export const normalizeWritingRows=(rows=[])=>rows.map(row=>{
  const {example,...field}=row;
  return field.type==='static'?{...field,type:'text',answers:field.answers||field.value||'',value:'',maxScore:Number(field.maxScore)>0?Number(field.maxScore):1}:field;
});

const PRESENTATION_TYPES=new Set(['heading','note','static','image','signature']);

export const isScoredWritingField=row=>!row?.hidden&&!PRESENTATION_TYPES.has(String(row?.type||'text'));

// Teacher-entered 0.33 represents one third of a point. Keep exact thirds
// throughout accumulation so later groups do not inherit rounding drift.
export function writingPointLayout(rows=[]){
  const items=normalizeWritingRows(Array.isArray(rows)?rows:[]),markers=items.map(()=>'');
  let units=0;
  items.forEach((row,index)=>{
    if(row.hidden)return;
    const score=isScoredWritingField(row)?Math.max(0,Number(row.maxScore)||0):0;
    if(score>0&&Math.abs(units/300-Math.round(units/300))<1e-9)markers[index]=`(${Math.round(units/300)})`;
    units+=score===0.33?100:score*300;
  });
  return {markers,total:Number((units/300).toFixed(2))};
}

export const writingFormScore=(rows=[])=>writingPointLayout(rows).total;

export function isAutomaticWritingForm(exam,section,question){
  return exam?.provider==='GOETHE'&&exam?.level==='A1'&&(section?.questionProfile?.layout==='form-fields'||section?.key==='writing-1')&&question?.writingFormVersion===1;
}

export function scoreWritingForm(rows=[],answer={}){
  const values=answer&&typeof answer==='object'?answer:{};
  const normalize=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
  let units=0;
  normalizeWritingRows(rows).forEach((row,index)=>{
    if(!isScoredWritingField(row))return;
    const given=normalize(values[index]);
    if(!given)return;
    const accepted=['choice','truefalse'].includes(row.type)
      ?[row.correctIndex!=null?writingOptions(row)[Number(row.correctIndex)]:null]
      :String(row.answers||'').split('|');
    if(accepted.some(value=>value&&normalize(value)===given))units+=Number(row.maxScore)===0.33?100:Number(row.maxScore||0)*300;
  });
  return Number((units/300).toFixed(2));
}

export function writingOptions(row){
  if(Array.isArray(row.options))return row.options;
  return row.type==='truefalse'?['Richtig','Falsch']:String(row.answers||'').split('|').map(x=>x.trim()).filter(Boolean);
}

export function addWritingRow(rows,type,index){
  const result=structuredClone(rows||[]),source=result[index];
  result.push({type:type||source?.type||'text',label:'',value:'',answers:'',options:['truefalse','choice'].includes(type||source?.type)?['Richtig','Falsch']:[],maxScore:isScoredWritingField({type:type||source?.type})?1:0,hidden:false,imageUrl:''});
  return result;
}

export function removeWritingRow(rows,index){
  const result=structuredClone(rows||[]);
  if(index>=0&&index<result.length)result.splice(index,1);
  return result;
}

// Explicit allowlist: learners need the form, never the teacher's expected answers.
export function publicWritingRows(rows=[]){
  return normalizeWritingRows(rows).map(row=>({type:row.type,label:row.label||'',hidden:Boolean(row.hidden),value:isScoredWritingField({...row,hidden:false})?'':String(row.value??row.answers??''),imageUrl:row.imageUrl||'',options:['choice','truefalse'].includes(row.type)?writingOptions(row):[],maxScore:row.maxScore||0}));
}
