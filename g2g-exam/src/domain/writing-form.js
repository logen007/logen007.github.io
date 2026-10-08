export const WRITING_FORM_TYPES=['heading','static','text','truefalse','choice','image'];

const PRESENTATION_TYPES=new Set(['heading','static','image']);

export const isScoredWritingField=row=>!row?.hidden&&!PRESENTATION_TYPES.has(String(row?.type||'text'));

export function writingFormScore(rows=[]){
  const total=(Array.isArray(rows)?rows:[]).reduce((sum,row)=>sum+(isScoredWritingField(row)?Math.max(0,Number(row.maxScore)||0):0),0);
  return Math.abs(total-Math.round(total))<0.02?Math.round(total):Number(total.toFixed(2));
}
