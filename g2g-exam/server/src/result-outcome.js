import {getSettings,now,audit} from './db.js';
import {renderTemplate} from './mail.js';
import {resultSummary,scoreDetails} from '../../src/domain/result-summary.js';
import {promotionTarget,examLearningLevel} from '../../src/domain/student-profile.js';
import {questionMap} from './actions/shared.js';

export async function finalizeOutcome(client,row,exam,marks,actor,{notificationId=`result-${row.id}`}={}){
  const summary=resultSummary(exam,await questionMap(exam),marks);
  const found=await client.query('SELECT role,data FROM users WHERE id=$1 FOR UPDATE',[row.student_id]);
  const profile=found.rows[0]?.data||{};
  const target=found.rows[0]?.role==='student'?promotionTarget(profile.level||'A1',examLearningLevel(exam),summary.passed&&summary.complete):null;
  let promotion=(await client.query('SELECT from_level AS "fromLevel",to_level AS "toLevel" FROM level_promotions WHERE attempt_id=$1',[row.id])).rows[0]||null;
  if(target&&!promotion){
    promotion={fromLevel:profile.level||'A1',toLevel:target};
    await client.query('INSERT INTO level_promotions(attempt_id,student_id,from_level,to_level) VALUES($1,$2,$3,$4)',[row.id,row.student_id,promotion.fromLevel,target]);
    await client.query('UPDATE users SET data=data||$2::jsonb,updated_at=now() WHERE id=$1',[row.student_id,JSON.stringify({level:target})]);
    await audit(actor,'promote_student','user',row.student_id,{attemptId:row.id,...promotion},client);
  }
  const patch={result:summary.result,totalScore:summary.total,resultSummary:summary,promotion};
  const settings=await getSettings(client);
  const vars={exam:row.public_data.examTitle||exam.title,student:profile.name||row.public_data.studentName||'học viên',score:String(summary.total),result:summary.result,url:settings.general.publicUrl,
    scoreDetails:scoreDetails(summary),passCondition:summary.condition,
    previousLevel:promotion?.fromLevel||'',newLevel:promotion?.toLevel||'',
    promotion:promotion&&summary.passed?`Chúc mừng bạn đã đạt trình độ ${promotion.toLevel}! (${promotion.fromLevel} → ${promotion.toLevel})`:''};
  let html=settings.email.resultHtml||'',text=settings.email.resultText||'';
  for(const [key,label] of [['scoreDetails','Điểm từng kỹ năng'],['passCondition','Điều kiện đạt'],['promotion','']]){
    if(!html.includes(`{${key}}`))html+=`<div style="margin-top:20px;padding:16px;background:#f3f7f5;border-radius:12px;white-space:pre-line"><strong>${label}</strong><br>{${key}}</div>`;
    if(!text.includes(`{${key}}`))text+=`\n\n${label}\n{${key}}`;
  }
  const to=row.public_data.studentEmail||'';
  if(!/<html[\s>]/i.test(html))html=`<div style="background:#f1f5f4;padding:32px 12px;font-family:Arial,sans-serif;color:#172321"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e0e8e4;border-radius:20px;padding:28px"><p style="color:#188454;font-weight:bold;letter-spacing:2px">G2G CAREER</p><h1 style="font-size:24px">Kết quả luyện thi</h1>${html}</div></div>`;
  const status=!settings.email.enabled||!settings.smtp.enabled?'email_disabled':to?'queued':'no_email';
  const notification={type:'result_published',to,studentId:row.student_id,attemptId:row.id,
    subject:renderTemplate(settings.email.resultSubject,vars),text:renderTemplate(text,vars),html:renderTemplate(html,vars,true),createdAt:now()};
  await client.query('INSERT INTO notifications(id,student_id,attempt_id,status,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING',[notificationId,row.student_id,row.id,status,JSON.stringify(notification)]);
  return {patch,notificationStatus:status};
}
