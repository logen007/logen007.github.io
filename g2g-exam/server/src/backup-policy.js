export const backupDefaults={time:'03:00',intervalDays:1,dailyCopies:7,monthlyCopies:1,enabled:false,timeZone:'Asia/Ho_Chi_Minh'};
export function validateBackupPreferences(data){
 const {time,intervalDays,dailyCopies,monthlyCopies,enabled=false}=data;
 if(typeof enabled!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||'')||!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>30||!Number.isInteger(dailyCopies)||dailyCopies<1||dailyCopies>90||!Number.isInteger(monthlyCopies)||monthlyCopies<0||monthlyCopies>24)throw Error('Giờ hoặc số bản lưu không hợp lệ.');
 return {time,intervalDays,dailyCopies,monthlyCopies,enabled,timeZone:'Asia/Ho_Chi_Minh'};
}
export function backupDue(p,last,now=new Date()){
 if(!p.enabled)return false;
 const local=new Date(now.getTime()+7*3600000).toISOString();
 if(local.slice(11,16)<p.time)return false;
 if(!last)return true;
 const previous=new Date(new Date(last).getTime()+7*3600000).toISOString().slice(0,10);
 return (Date.parse(local.slice(0,10))-Date.parse(previous))/86400000>=p.intervalDays;
}
export function retainedBackupIds(files,p){
 const ordered=files.filter(x=>/^g2g-.*\.tar\.gz$/.test(x.name)&&x.description?.startsWith('g2g-backup-v2 sha256=')).sort((a,b)=>b.createdTime.localeCompare(a.createdTime));
 const keep=new Set(ordered.slice(0,p.dailyCopies).map(x=>x.id)),months=new Set();
 for(const file of ordered){const month=file.createdTime.slice(0,7);if(months.has(month))continue;if(months.size>=p.monthlyCopies)break;months.add(month);keep.add(file.id);}
 return {keep,ordered};
}
