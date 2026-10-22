import {examSkillDurations} from '../domain/exam-clock.js';
import {confirmAction} from './confirm.js';

export function confirmExamStart(exam){
  const skills=exam.skills||examSkillDurations(exam);
  return new Promise(resolve=>confirmAction(`Đề thi “${exam.title}” gồm các kỹ năng:`,()=>resolve(true),{
    details:skills.map(skill=>`${skill.name} — ${skill.minutes>0?`${skill.minutes} phút`:'Chưa cấu hình thời gian'}`),
    confirmLabel:'Bắt đầu ngay',cancelLabel:'Huỷ thi',onCancel:()=>resolve(false)
  }));
}
