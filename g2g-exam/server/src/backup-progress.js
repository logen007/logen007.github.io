// Counts completed operations, never estimates byte percentages or time remaining.
const backupStages=[['prepare','Chuẩn bị backup'],['database','Xuất dữ liệu database'],['uploads','Sao chép ảnh và audio'],['inventory','Kiểm tra danh sách và mã file'],['compress','Nén bản backup'],['upload','Tải bản backup lên Google Drive'],['download','Tải lại bản trên Drive để kiểm tra'],['extract','Giải nén bản kiểm tra'],['verify','Phục hồi thử và xác minh dữ liệu'],['retention','Dọn bản cũ theo cài đặt']];
const restoreStages=[['prepare','Chuẩn bị phục hồi thử'],...backupStages.filter(([key])=>['download','extract','verify'].includes(key))];
export function createBackupProgress({kind,startedAt,lastBackupAt,write,now=()=>new Date().toISOString()}){
 const steps=(kind==='restore'?restoreStages:backupStages).map(([id,label])=>({id,label}));
 let current={state:'running',kind,startedAt,lastBackupAt,steps,stepCount:steps.length,completedSteps:0};
 return {
  snapshot:()=>({...current}),
  async phase(id){
   const index=steps.findIndex(step=>step.id===id);
   if(index<0)throw Error('Unknown backup phase');
   const timestamp=now();
   current={...current,phase:id,step:index+1,completedSteps:index,phaseStartedAt:timestamp,updatedAt:timestamp,message:steps[index].label+'…'};
   await write({...current});
  }
 };
}
