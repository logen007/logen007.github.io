import {createHash} from 'node:crypto';
import {mergeRestorationRegistry} from './image-restoration-registry.js';

export const IMAGE_COLUMNS=['Mã nguồn','Link gốc','Link phục chế','Trạng thái','SHA256 gốc','SHA256 phục chế','Link đã gắn web','Ghi chú','Alias nguồn'];
export const USAGE_COLUMNS=['Mã vị trí','Mã đề','Tên đề','Đơn vị','Trình độ','Trạng thái đề','Phiên bản','Loại','Mã đối tượng','Vị trí JSON','Mã nguồn'];
export const SHEET_TABS=[{title:'Ảnh',headers:IMAGE_COLUMNS},{title:'Vị trí',headers:USAGE_COLUMNS}];
const hash=value=>createHash('sha256').update(value).digest('hex');
const cell=value=>({userEnteredValue:{stringValue:String(value??'')}});
export const sheetRows=rows=>rows.map(row=>({values:row.map(cell)}));

// Append only. Human-owned output/status/notes never get rewritten, even when
// an old source disappears. File-content hashes remain worker-owned, not URLs.
export function planImageSheetSync(manifest,images,usages){
  const registry=images.filter(row=>row.some(Boolean)).map(row=>({sourceId:row[0],sourceUrl:row[1],restoredUrl:row[2]||'',status:row[3]||'',sourceSha256:row[4]||'',restoredSha256:row[5]||'',appliedUrl:row[6]||'',notes:row[7]||'',sourceAliases:row[8]?JSON.parse(row[8]):[]}));
  const oldIds=new Set(registry.map(row=>row.sourceId));
  const merged=mergeRestorationRegistry(registry,manifest),sourceMap=new Map();
  for(const row of merged){
    sourceMap.set(row.sourceId,row.sourceId);
    for(const alias of row.sourceAliases)sourceMap.set(alias.sourceId,row.sourceId);
  }
  const imageRows=merged.filter(row=>!oldIds.has(row.sourceId)).map(row=>[row.sourceId,row.sourceUrl,row.restoredUrl,row.status,row.sourceSha256,row.restoredSha256,row.appliedUrl,row.notes,JSON.stringify(row.sourceAliases)]);
  const known=new Set(usages.filter(row=>row.some(Boolean)).map(row=>row[0]));
  if(known.has('')||known.has(undefined))throw Error('Missing usage ID');
  const usageRows=[];
  for(const usage of manifest.usages){
    const values=[usage.examId,usage.examTitle,usage.provider,usage.level,usage.examStatus,usage.publicationVersion??'',usage.entity,usage.entityId,usage.pointer,sourceMap.get(usage.sourceId)];
    if(!values.at(-1))throw Error('Unknown image source in usage');
    const id=hash(JSON.stringify(values));
    if(!known.has(id)){usageRows.push([id,...values]);known.add(id);}
  }
  return {imageRows,usageRows,skipped:manifest.assets.length-imageRows.length};
}

// One request is atomic across both tabs. On timeout the next run reads the
// Sheet again and reconciles IDs instead of blindly replaying an append.
export async function syncImageSheet({google,spreadsheetId,manifest}){
  const metadata=await google('sheets','GET',`/${spreadsheetId}?fields=spreadsheetUrl,sheets(properties)`);
  const tabs=[];
  for(const spec of SHEET_TABS){
    const tab=metadata.sheets?.find(s=>s.properties.title===spec.title)?.properties;
    if(!tab||tab.gridProperties.columnCount<spec.headers.length||tab.gridProperties.rowCount>50000)throw Error('Image Sheet structure changed or exceeds sync limit');
    const rows=[];
    for(let start=1;start<=tab.gridProperties.rowCount;start+=1000){
      const end=Math.min(start+999,tab.gridProperties.rowCount),last=String.fromCharCode(64+spec.headers.length);
      const range=encodeURIComponent(`'${spec.title}'!A${start}:${last}${end}`);
      const result=await google('sheets','GET',`/${spreadsheetId}/values/${range}?valueRenderOption=FORMULA`);
      rows.push(...(result.values||[]));
    }
    if(JSON.stringify(rows.shift())!==JSON.stringify(spec.headers))throw Error('Image Sheet headers changed; refusing to overwrite');
    tabs.push({...tab,rows});
  }
  const plan=planImageSheetSync(manifest,tabs[0].rows,tabs[1].rows);
  const batches=[plan.imageRows,plan.usageRows];
  for(let offset=0;offset<Math.max(...batches.map(rows=>rows.length));offset+=200){
    const requests=batches.flatMap((rows,i)=>rows.slice(offset,offset+200).length?[{appendCells:{sheetId:tabs[i].sheetId,rows:sheetRows(rows.slice(offset,offset+200)),fields:'userEnteredValue'}}]:[]);
    await google('sheets','POST',`/${spreadsheetId}:batchUpdate`,{requests});
  }
  return {added:plan.imageRows.length,positionsAdded:plan.usageRows.length,skipped:plan.skipped,warnings:manifest.warnings.length};
}
