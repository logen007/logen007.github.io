const now = '2026-10-05T13:00:00.000Z';

export const seedState = {
  schemaVersion: 2,
  revision: 1,
  users: [
    { id: 'student-a', email: 'hocvien.demo@g2gcareer.com', name: 'Nguyễn Văn A', role: 'student', active: true, createdAt: now },
    { id: 'teacher-lan', email: 'lan@g2gcareer.com', name: 'Cô Lan', role: 'teacher', active: true, createdAt: now },
    { id: 'teacher-mai', email: 'mai@g2gcareer.com', name: 'Cô Mai', role: 'teacher', active: true, createdAt: now },
    { id: 'teacher-huong', email: 'huong@g2gcareer.com', name: 'Cô Hương', role: 'teacher', active: true, createdAt: now },
    { id: 'master-1', email: 'admin@g2gcareer.com', name: 'Quản trị cấp cao', role: 'master', active: true, createdAt: now },
  ],
  questions: [
    { id:'q-read-1', code:'Q-B1-001', level:'B1', skill:'Đọc hiểu', part:'Phần 1', type:'single', title:'Homeoffice und Zusammenarbeit', instruction:'Lesen Sie den Text und wählen Sie die passende Überschrift.', prompt:'Viele Menschen arbeiten heute teilweise von zu Hause. Für Unternehmen entstehen dadurch neue Möglichkeiten, aber auch neue Regeln für Zusammenarbeit und Kommunikation.', choices:['Arbeiten ohne Büro','Neue Regeln im Team','Freizeit am Wochenende'], correctAnswer:1, maxScore:5, autoGrade:true, ownerId:'teacher-lan', ownerName:'Cô Lan', status:'active', usedCount:4, correctRate:0.50, createdAt:now, updatedAt:now },
    { id:'q-read-2', code:'Q-B1-002', level:'B1', skill:'Đọc hiểu', part:'Phần 1', type:'single', title:'Kochsendungen', instruction:'Wählen Sie die passende Überschrift.', prompt:'Kochsendungen im Fernsehen gibt es schon lange. Heute verbinden sie Unterhaltung, Information und Gemeinschaftserlebnis.', choices:['Ein Trend, der bleibt','Kleidung im Beruf','Nur wer kocht, lernt'], correctAnswer:0, maxScore:5, autoGrade:true, ownerId:'teacher-lan', ownerName:'Cô Lan', status:'active', usedCount:9, correctRate:0.75, createdAt:now, updatedAt:now },
    { id:'q-read-3', code:'Q-B1-003', level:'B1', skill:'Đọc hiểu', part:'Phần 3', type:'matching', title:'Situationen und Anzeigen', instruction:'Ordnen Sie die Situationen den Anzeigen zu.', prompt:'Sie suchen passende Anzeigen für verschiedene Alltagssituationen.', pairs:[['Sprachkurs','Volkshochschule'],['Autoreparatur','Werkstatt']], maxScore:10, autoGrade:true, ownerId:'teacher-mai', ownerName:'Cô Mai', status:'active', usedCount:5, correctRate:0.55, createdAt:now, updatedAt:now },
    { id:'q-grammar-1', code:'Q-B1-021', level:'B1', skill:'Ngữ pháp', part:'Phần 1', type:'cloze', title:'Geschäftsjahr – Lückentext', instruction:'Wählen Sie für jede Lücke die richtige Lösung.', prompt:'Zum Start in das neue Geschäftsjahr ___ wir uns für Sie etwas ganz Besonderes ausgedacht.', choices:['haben','hat','sind'], correctAnswer:0, maxScore:5, autoGrade:true, ownerId:'teacher-lan', ownerName:'Cô Lan', status:'active', usedCount:6, correctRate:0.60, createdAt:now, updatedAt:now },
    { id:'q-listen-1', code:'Q-B1-041', level:'B1', skill:'Nghe hiểu', part:'Phần 2', type:'truefalse', title:'Wochenendreise', instruction:'Sie hören den Text. Entscheiden Sie: richtig oder falsch.', prompt:'Die Sprecherin möchte am kommenden Wochenende verreisen.', choices:['Richtig','Falsch'], correctAnswer:0, maxScore:5, autoGrade:true, ownerId:'teacher-mai', ownerName:'Cô Mai', status:'active', usedCount:7, correctRate:0.65, audioUrl:'', createdAt:now, updatedAt:now },
    { id:'q-write-1', code:'Q-B1-061', level:'B1', skill:'Viết', part:'Bài viết', type:'writing', title:'E-Mail an die Kursleitung', instruction:'Schreiben Sie eine E-Mail und bearbeiten Sie alle vier Punkte.', prompt:'Sie haben an einem Deutschkurs teilgenommen und möchten der Kursleitung schreiben.', maxScore:45, autoGrade:false, rubric:[{id:'task',label:'Hoàn thành yêu cầu',max:15},{id:'structure',label:'Tổ chức và diễn đạt',max:15},{id:'language',label:'Ngữ pháp và chính tả',max:15}], ownerId:'teacher-lan', ownerName:'Cô Lan', status:'active', usedCount:10, correctRate:null, createdAt:now, updatedAt:now },
    { id:'q-speak-1', code:'Q-B1-071', level:'B1', skill:'Nói', part:'Phần 1', type:'speaking', title:'Sich vorstellen', instruction:'Stellen Sie sich kurz vor.', prompt:'Sprechen Sie über Name, Herkunft, Wohnort, Familie und Beruf.', maxScore:75, autoGrade:false, rubric:[{id:'content',label:'Nội dung',max:25},{id:'fluency',label:'Độ trôi chảy',max:25},{id:'language',label:'Ngôn ngữ',max:25}], ownerId:'teacher-lan', ownerName:'Cô Lan', status:'active', usedCount:8, correctRate:null, createdAt:now, updatedAt:now },
  ],
  exams: [
    {
      id:'exam-b1-01', title:'TELC B1 – Đề thi thử 01', level:'B1', ownerId:'teacher-lan', ownerName:'Cô Lan', status:'published', version:1, passScore:180,
      sections:[
        {id:'sec-read',name:'Đọc hiểu',timeMinutes:35,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-read-1','q-read-2','q-read-3']},
        {id:'sec-grammar',name:'Ngữ pháp',timeMinutes:20,maxScore:30,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-grammar-1']},
        {id:'sec-listen',name:'Nghe hiểu',timeMinutes:30,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-listen-1']},
        {id:'sec-write',name:'Viết',timeMinutes:30,maxScore:45,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-write-1']},
        {id:'sec-speak',name:'Nói',timeMinutes:15,maxScore:75,showTimer:true,autoSubmit:false,shuffle:false,questionIds:['q-speak-1']},
      ], createdAt:now, updatedAt:now,
    },
    { id:'exam-b1-02', title:'TELC B1 – Đề thi thử 02', level:'B1', ownerId:'teacher-mai', ownerName:'Cô Mai', status:'published', version:1, passScore:180, sections:[
      {id:'e2-read',name:'Đọc hiểu',timeMinutes:35,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-read-1','q-read-3']},
      {id:'e2-grammar',name:'Ngữ pháp',timeMinutes:20,maxScore:30,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-grammar-1']},
      {id:'e2-listen',name:'Nghe hiểu',timeMinutes:30,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-listen-1']},
      {id:'e2-write',name:'Viết',timeMinutes:30,maxScore:45,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-write-1']},
      {id:'e2-speak',name:'Nói',timeMinutes:15,maxScore:75,showTimer:true,autoSubmit:false,shuffle:false,questionIds:['q-speak-1']},
    ], createdAt:now, updatedAt:now },
    { id:'exam-b1-03', title:'TELC B1 – Đề thi thử 03', level:'B1', ownerId:'teacher-lan', ownerName:'Cô Lan', status:'published', version:1, passScore:180, sections:[
      {id:'e3-read',name:'Đọc hiểu',timeMinutes:35,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-read-1','q-read-2']},
      {id:'e3-grammar',name:'Ngữ pháp',timeMinutes:20,maxScore:30,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-grammar-1']},
      {id:'e3-listen',name:'Nghe hiểu',timeMinutes:30,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-listen-1']},
      {id:'e3-write',name:'Viết',timeMinutes:30,maxScore:45,showTimer:true,autoSubmit:true,shuffle:false,questionIds:['q-write-1']},
      {id:'e3-speak',name:'Nói',timeMinutes:15,maxScore:75,showTimer:true,autoSubmit:false,shuffle:false,questionIds:['q-speak-1']},
    ], createdAt:now, updatedAt:now },
  ],
  attempts: [
    { id:'att-001', examId:'exam-b1-01', examTitle:'TELC B1 – Đề thi thử 01', studentId:'student-a', studentName:'Nguyễn Văn A', studentEmail:'hocvien.demo@g2gcareer.com', attemptNo:1, status:'published', startedAt:'2026-09-29T02:00:00.000Z', submittedAt:'2026-09-29T04:00:00.000Z', publishedAt:'2026-09-29T09:00:00.000Z', answers:{}, autoScore:115, manualScores:{writing:34,speaking:35}, sectionScores:{'Đọc hiểu':60,'Ngữ pháp':22,'Nghe hiểu':55,'Viết':34,'Nói':35}, totalScore:206, result:'Đạt', reviewerId:'teacher-lan', reviewerName:'Cô Lan', feedback:'Bài làm khá chắc, cần chú ý thêm phần nghe.' },
    { id:'att-002', examId:'exam-b1-02', examTitle:'TELC B1 – Đề thi thử 02', studentId:'student-a', studentName:'Nguyễn Văn A', studentEmail:'hocvien.demo@g2gcareer.com', attemptNo:1, status:'published', startedAt:'2026-10-04T02:00:00.000Z', submittedAt:'2026-10-04T04:00:00.000Z', publishedAt:'2026-10-04T09:00:00.000Z', answers:{}, autoScore:149, manualScores:{writing:36,speaking:33}, sectionScores:{'Đọc hiểu':65,'Ngữ pháp':24,'Nghe hiểu':60,'Viết':36,'Nói':33}, totalScore:218, result:'Đạt', reviewerId:'teacher-mai', reviewerName:'Cô Mai', feedback:'Bố cục tốt, cần chú ý trật tự động từ.' },
  ],
  gradingRequests: [],
  notifications: [],
  auditLog: [],
};
