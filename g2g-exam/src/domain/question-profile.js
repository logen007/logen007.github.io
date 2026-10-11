// Paired sections share their spec but alternate answer formats within each pair.
export function questionProfileAt(section,index){
  const profile=section.questionProfile||{};
  return profile.pairedQuestions?{...profile,...profile.pairProfiles[index%2]}:profile;
}
