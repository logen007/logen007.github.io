// User-supplied demo 1. Only seed the explicitly requested exam/part.
export function patientWritingDemo(){
  const given=(label,value,extra={})=>({type:'static',label,value,maxScore:0,...extra});
  const blank=(label,answers)=>({type:'text',label,answers,maxScore:1});
  return {
    instruction:'Ihr Freund, Wladimir Serjakov, 30 Jahre alt, kommt aus Sankt Petersburg in Russland und lebt seit einem Monat in Hamburg. Er hat eine neue Stelle bei TUI als Reiseleiter. Seit gestern hat er 39 Grad Fieber. Heute geht er zum Arzt.\nHelfen Sie Ihrem Freund und schreiben Sie die fünf fehlenden Informationen in das Formular.\nAm Ende schreiben Sie Ihre Lösungen bitte auf den Antwortbogen.',
    question:{title:'Patienteninformation',type:'writing',writingFormVersion:1,autoGrade:false,maxScore:5,rubric:[
      {type:'heading',value:'Dr. Arnold Friedrich   Patienteninformation',maxScore:0},
      given('Name, Vorname:','Serjakov, Wladimir',{example:true}),
      given('Telefon:','040 / 456 78 89'),
      {type:'note',value:'Adresse:',maxScore:0},
      given('Straße, Hausnummer:','August-Bebel-Str.'),given('Straße, Hausnummer:','22'),
      given('Postleitzahl, Wohnort:','20969'),blank('Postleitzahl, Wohnort:','Hamburg'),
      blank('Alter:','30|30 Jahre'),given('Krankenkasse:','AOK'),blank('Beruf:','Reiseleiter'),
      blank('Seit wann sind Sie krank?','seit gestern|gestern'),blank('Was fehlt Ihnen?','Fieber|39 Grad Fieber'),
      given('Datum:','16.06.'),{type:'signature',label:'Unterschrift:',value:'Wladimir Serjakov',maxScore:0},
    ],mixedChoiceHidden:true},
  };
}
