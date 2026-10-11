export function resolveBuilderSection(exam,sectionId){
  return exam?.sections?.find(section=>section.id===sectionId)?.id||exam?.sections?.[0]?.id||null;
}
