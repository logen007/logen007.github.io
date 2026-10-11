import {validateStudentName} from './student-profile.js';
export function nameChangePatch(account,value,{admin=false,now=Date.now()}={}){
  const name=validateStudentName(value);
  if(name===account.name)return {};
  const next=Date.parse(account.nameChangedAt)+30*24*60*60*1000;
  if(!admin&&Number.isFinite(next)&&now<next){
    const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(next);
    throw new Error('Bạn chỉ được đổi tên 1 lần trong 30 ngày. Có thể đổi lại từ '+date+'.');
  }
  return {name,nameChangedAt:new Date(now).toISOString()};
}

export function resolveAccountNames(state,users=state.users||[]){
  const names=new Map(users.map(user=>[user.id,user.name]));
  for(const key of ['exams','questions','attempts']){
    for(const item of state[key]||[]){
      for(const [id,label] of [['ownerId','ownerName'],['studentId','studentName'],['reviewerId','reviewerName']]){
        if(names.get(item[id]))item[label]=names.get(item[id]);
      }
    }
  }
  return state;
}
