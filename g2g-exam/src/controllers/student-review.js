import {buildAttemptReview} from '../domain/attempt-review.js';

// API owns production authorization; local previews enforce the same ownership.
// Never use the metadata-only result list as the production detail payload.
export async function loadStudentReview({repo,data,user,attemptId}){
  if(repo.mode==='api')return repo.call('getAttemptReview',{attemptId});
  const attempt=data.attempts.find(item=>item.id===attemptId);
  if(!attempt||attempt.studentId!==user.id)throw new Error('Không tìm thấy bài làm.');
  const exam=attempt.examSnapshot||data.exams.find(item=>item.id===attempt.examId)||{};
  return buildAttemptReview({exam,questions:exam.questionSnapshot||data.questions,attempt,student:user});
}
