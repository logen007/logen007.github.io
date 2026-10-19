// Pure merge rules for the Google Sheet worker. No credentials, file downloads,
// generation or website writes happen here; Sheets remains the durable registry.
export function mergeRestorationRegistry(rows,manifest){
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.assets))throw Error('Unsupported image inventory');
  const merged=structuredClone(rows),byId=new Map(),byAppliedUrl=new Map();
  for(const row of merged){
    if(!row.sourceId||byId.has(row.sourceId))throw Error('Missing or duplicate sourceId in registry');
    byId.set(row.sourceId,row);
    for(const alias of row.sourceAliases||[]){
      if(byId.has(alias.sourceId)&&byId.get(alias.sourceId)!==row)throw Error('Ambiguous source alias in registry');
      byId.set(alias.sourceId,row);
    }
    if(row.appliedUrl){
      const previous=byAppliedUrl.get(row.appliedUrl);
      if(previous&&(previous.restoredUrl!==row.restoredUrl||previous.sourceSha256!==row.sourceSha256))throw Error('Ambiguous applied image URL in registry');
      if(!previous)byAppliedUrl.set(row.appliedUrl,row);
    }
  }
  const seen=new Set();
  for(const asset of manifest.assets){
    if(!asset.sourceId||!asset.sourceUrl||seen.has(asset.sourceId))throw Error('Invalid or duplicate exported image');
    seen.add(asset.sourceId);
    let row=byId.get(asset.sourceId)||byAppliedUrl.get(asset.sourceUrl);
    if(row){
      if(row.sourceId!==asset.sourceId&&!(row.sourceAliases||[]).some(a=>a.sourceId===asset.sourceId)){
        row.sourceAliases=[...(row.sourceAliases||[]),{sourceId:asset.sourceId,sourceUrl:asset.sourceUrl}];
        byId.set(asset.sourceId,row);
      }
    }else{
      row={sourceId:asset.sourceId,sourceUrl:asset.sourceUrl,sourceSha256:'',restoredUrl:'',restoredSha256:'',status:'pending',appliedUrl:'',sourceAliases:[],notes:''};
      merged.push(row);byId.set(row.sourceId,row);
    }
  }
  return merged;
}

export function restorationDecision(row,registry,{sourceSha256=row.sourceSha256}={}){
  if(sourceSha256&&!/^[a-f0-9]{64}$/.test(sourceSha256))throw Error('Invalid source file checksum');
  if(row.sourceSha256&&sourceSha256&&row.sourceSha256!==sourceSha256)return {action:'hold',reason:'source-bytes-changed'};
  if(row.restoredUrl)return {action:'reuse',sourceId:row.sourceId,restoredUrl:row.restoredUrl};
  if(sourceSha256){
    const completed=registry.filter(other=>other.sourceSha256===sourceSha256&&other.restoredUrl);
    if(new Set(completed.map(other=>other.restoredUrl)).size>1)return {action:'hold',reason:'conflicting-restorations'};
    if(completed.length)return {action:'reuse',sourceId:completed[0].sourceId,restoredUrl:completed[0].restoredUrl};
  }
  if(row.status==='processing')return {action:'hold',reason:'reconcile-previous-job-first'};
  if(!sourceSha256)return {action:'hold',reason:'download-and-hash-source-first'};
  return {action:'restore'};
}
