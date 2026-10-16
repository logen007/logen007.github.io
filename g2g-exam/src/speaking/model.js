// G2G technical trial, not an official TELC examination specification.
export const LAB_STATES={scheduled:'Đã xếp lịch',waiting:'Chờ sẵn sàng',starting:'Đang bật ghi hình',running:'Đang thi',paused:'Tạm dừng · kiểm tra kết nối',finishing:'Đang đóng phòng',processing:'Đang xử lý bản ghi',completed:'Chờ nhận xét',interrupted:'Gián đoạn',cancelled:'Đã huỷ'};
export const isPhone=agent=>/iPhone|Android.*Mobile/i.test(String(agent||''));
export const isStaff=user=>['master','teacher'].includes(user?.role);
export const canManage=(user,row)=>user?.role==='master'||user?.role==='teacher'&&row.owner_id===user.id;
export function validateTrial(input,now=Date.now()){
 const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
 const title=String(input.title||'').trim(),scheduledAt=Date.parse(input.scheduledAt);
 if(!title||title.length>120)fail('Tên ca thi cần từ 1 đến 120 ký tự.');
 if(!Number.isFinite(scheduledAt)||scheduledAt<now-5*60000||scheduledAt>now+30*86400000)fail('Lịch phải nằm trong 30 ngày tới.');
 const emails=[input.emailA,input.emailB].map(x=>String(x||'').trim().toLowerCase());
 if(emails.some(x=>!/^\S+@\S+\.\S+$/.test(x)||x.length>254)||emails[0]===emails[1])fail('Cần hai email tài khoản khác nhau đã đăng ký trên web.');
 if(!Array.isArray(input.stages)||input.stages.length<1||input.stages.length>4)fail('Cần từ 1 đến 4 phần thử.');
 const stages=input.stages.map(s=>({title:String(s.title||'').trim(),instruction:String(s.instruction||'').trim(),a:String(s.a||'').trim(),b:String(s.b||'').trim(),seconds:Number(s.seconds)}));
 if(stages.some(s=>!s.title||s.title.length>100||!s.instruction||s.instruction.length>3000||!s.a||!s.b||s.a.length>10000||s.b.length>10000||!Number.isInteger(s.seconds)||s.seconds<30||s.seconds>1200))fail('Mỗi phần cần tiêu đề, hướng dẫn, đề A/B và thời lượng 30–1200 giây.');
 if(stages.reduce((n,s)=>n+s.seconds,0)>1800)fail('Bản thử giới hạn tổng thời lượng 30 phút.');
 return {title,scheduledAt:new Date(scheduledAt).toISOString(),emails,stages};
}
export function trialView(row,user,now=Date.now()){
 const d=row.data,manage=canManage(user,row),index=d.members.findIndex(m=>m.id===user.id);
 if(!manage&&index<0)throw Object.assign(new Error('Bạn không được xếp vào ca thi này.'),{statusCode:403});
 const stage=['running','paused'].includes(d.state)?d.stages[d.stageIndex]:null;
 return {id:row.id,title:d.title,scheduledAt:d.scheduledAt,state:d.state,serverNow:now,manage,participant:index>=0,seat:index<0?null:index===0?'A':'B',members:d.members.map(m=>({id:m.id,name:m.name,seat:m.seat,ready:!!d.ready?.[m.id],presence:d.presence?.find(p=>p.id===m.id)||null})),stageIndex:d.stageIndex??null,stageCount:d.stages.length,stage:stage?{title:stage.title,instruction:stage.instruction,prompt:manage&&index<0?'':stage[index===0?'a':'b'],seconds:stage.seconds}:null,deadline:d.deadline||null,remaining:d.remaining??null,error:d.error||'',recordingStatus:d.recordingStatus||null,...(manage?{stages:d.stages,markers:d.markers||[],reviews:d.reviews||{},hasRecording:!!d.assetId,recordingStartedAt:d.recordingStartedAt||null}:{} )};
}
export const clockText=seconds=>{const n=Math.max(0,Math.ceil(seconds||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
