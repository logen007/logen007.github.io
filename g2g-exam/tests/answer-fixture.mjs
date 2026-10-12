import {isPrefilledQuestion} from '../src/domain/question-display.js';

// Grading tests need a completed attempt now. Fill missing responses with wrong
// answers so the fixtures retain their existing zero-score expectations.
export function completeWrongAnswers(state,attempt){
  const exam=state.exams.find(exam=>exam.id===attempt.examId);
  for(const id of exam.sections.flatMap(section=>section.questionIds)){
    const question=state.questions.find(question=>question.id===id);
    if(!question||isPrefilledQuestion(question)||attempt.answers[id]!=null)continue;
    attempt.answers[id]=question.type==='writing'
      ?question.rubric?.length?Object.fromEntries(question.rubric.map((_,i)=>[i,'wrong fixture answer'])):'wrong fixture answer'
      :question.type==='matching'?question.pairs.map(()=> 'wrong fixture answer')
      :question.choices?.length?(Number(question.correctAnswer||0)+1)%question.choices.length:'wrong fixture answer';
  }
}

export async function completeStoredWrongAnswers(query,attemptId){
  const row=(await query('SELECT public_data,private_data FROM attempts WHERE id=$1',[attemptId])).rows[0];
  const exam=row.private_data.examSnapshot,attempt=row.public_data;
  completeWrongAnswers({exams:[exam],questions:exam.questionSnapshot},attempt);
  await query('UPDATE attempts SET public_data=$2::jsonb WHERE id=$1',[attemptId,JSON.stringify(attempt)]);
}

