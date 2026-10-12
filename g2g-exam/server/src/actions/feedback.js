import {getSettings,appError} from '../db.js';
import {sendConfiguredMail} from '../mail.js';

const windows=new Map();
let globalWindow={start:0,count:0};
export function reserveFeedback(userId,now=Date.now()){
  const duration=10*60*1000;
  for(const [id,item] of windows)if(now-item.start>=duration)windows.delete(id);
  if(now-globalWindow.start>=60000)globalWindow={start:now,count:0};
  const item=windows.get(userId)||{start:now,count:0};
  if(item.count>=3||globalWindow.count>=30||(!windows.has(userId)&&windows.size>=5000))throw appError(429,'Bạn gửi hơi nhanh. Vui lòng thử lại sau ít phút.');
  item.count++;globalWindow.count++;windows.set(userId,item);
}
export async function submitFeedback(user,{message,page}={}){
  if(!user?.id)throw appError(401,'Vui lòng đăng nhập để gửi góp ý.');
  if(typeof message!=='string'||message.trim().length<5||message.trim().length>2000)throw appError(400,'Góp ý cần từ 5 đến 2.000 ký tự.');
  const settings=await getSettings();
  const to=settings.general.feedbackEmail||'admin@g2gcareer.com';
  if(!settings.smtp.enabled)throw appError(503,'Kênh góp ý chưa sẵn sàng. Vui lòng thử lại sau.');
  reserveFeedback(user.id);
  // Plain text only; never forward query strings, tokens or exam answers.
  const route=typeof page==='string'&&/^\/[a-zA-Z0-9/_-]*$/.test(page)?page.slice(0,120):'/';
  await sendConfiguredMail({to,subject:'G2G · Góp ý website',text:[
    'Góp ý mới từ website',
    'Người gửi: '+String(user.name||user.id).replace(/[\r\n]/g,' '),
    'Email: '+String(user.email||'').replace(/[\r\n]/g,' '),
    'Trang: '+route,
    '',message.trim(),
  ].join('\n')});
  return {ok:true};
}
