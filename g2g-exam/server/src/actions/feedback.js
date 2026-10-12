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
export function feedbackAttachment(image){
  if(image==null)return [];
  if(typeof image!=='string'||image.length>820000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw appError(400,'Ảnh đính kèm không hợp lệ.');
  const content=Buffer.from(image.split(',')[1],'base64');
  if(content.length>600*1024||content.length<4||content[0]!==255||content[1]!==216||content[2]!==255||content.at(-2)!==255||content.at(-1)!==217)throw appError(400,'Ảnh phải là JPEG dưới 600 KB.');
  return [{filename:'feedback.jpg',content,contentType:'image/jpeg'}];
}
export async function submitFeedback(user,{message,page,image}={}){
  if(!user?.id)throw appError(401,'Vui lòng đăng nhập để gửi góp ý.');
  if(typeof message!=='string'||message.trim().length<5||message.trim().length>2000)throw appError(400,'Góp ý cần từ 5 đến 2.000 ký tự.');
  const attachments=feedbackAttachment(image);
  const settings=await getSettings();
  const to=settings.general.feedbackEmail||'admin@g2gcareer.com';
  if(!settings.smtp.enabled)throw appError(503,'Kênh góp ý chưa sẵn sàng. Vui lòng thử lại sau.');
  reserveFeedback(user.id);
  // Plain text only; never forward query strings, tokens or exam answers.
  const route=typeof page==='string'&&/^\/[a-zA-Z0-9/_-]*$/.test(page)?page.slice(0,120):'/';
  await sendConfiguredMail({to,attachments,subject:'G2G · Góp ý website',text:[
    'Góp ý mới từ website',
    'Người gửi: '+String(user.name||user.id).replace(/[\r\n]/g,' '),
    'Email: '+String(user.email||'').replace(/[\r\n]/g,' '),
    'Trang: '+route,
    '',message.trim(),
  ].join('\n')});
  return {ok:true};
}
