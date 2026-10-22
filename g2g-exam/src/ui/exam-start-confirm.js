import {examSkillDurations} from '../domain/exam-clock.js';
import {confirmAction} from './confirm.js';

export function confirmExamStart(exam,onOrigin=()=>{}){
  const skills=exam.skills||examSkillDurations(exam);
  const totalMinutes=skills.reduce((total,skill)=>total+Math.max(0,Number(skill.minutes)||0),0);
  return new Promise(resolve=>confirmAction(exam.title,origin=>{onOrigin(origin);resolve(true);},{
    heading:'Sẵn sàng bắt đầu?',summary:`${totalMinutes} phút làm bài · ${skills.length} kỹ năng`,dialogClass:'exam-start-confirm',
    details:skills.map(skill=>`${skill.name} — ${Math.max(1,Number(skill.parts)||0)} phần · ${skill.minutes>0?`${skill.minutes} phút`:'Chưa cấu hình thời gian'}`),
    confirmLabel:'Bắt đầu ngay',cancelLabel:'Huỷ thi',onCancel:()=>resolve(false)
  }));
}
