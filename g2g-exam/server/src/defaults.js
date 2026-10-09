export const DEFAULT_SETTINGS={
  version:5,
  general:{systemName:'Thi thử tiếng Đức',organizationName:'G2G Career',supportEmail:'admin@g2gcareer.com',publicUrl:process.env.PUBLIC_URL||'https://exam.g2gcareer.com'},
  theme:{primaryColor:'#111827'},
  auth:{googleLoginEnabled:true,allowNewStudents:true,allowedDomain:'',teacherEmails:[]},
  exam:{allowRestart:true},
  smtp:{enabled:false,host:'',port:587,security:'starttls',username:'',fromName:'G2G Career',fromEmail:'admin@g2gcareer.com',replyTo:'admin@g2gcareer.com',timeoutMs:20000,rejectUnauthorized:true},
  email:{enabled:false,resultSubject:'G2G – Đã có kết quả {exam}',resultText:'Xin chào {student},\n\nKết quả bài thi {exam} của bạn đã được công bố.\nĐiểm: {score}\nKết quả: {result}\n\nXem chi tiết: {url}',resultHtml:'<p>Xin chào <strong>{student}</strong>,</p><p>Kết quả bài thi <strong>{exam}</strong> của bạn đã được công bố.</p><p>Điểm: <strong>{score}</strong><br>Kết quả: <strong>{result}</strong></p><p><a href="{url}">Đăng nhập để xem chi tiết</a></p>'},
  operations:{maintenanceMode:false,maintenanceMessage:'Hệ thống đang bảo trì. Vui lòng quay lại sau.'}
};

export function mergeSettings(input={}){
  return {
    ...structuredClone(DEFAULT_SETTINGS),...input,
    general:{...DEFAULT_SETTINGS.general,...(input.general||{})},
    theme:{...DEFAULT_SETTINGS.theme,...(input.theme||{})},
    auth:{...DEFAULT_SETTINGS.auth,...(input.auth||{})},
    exam:{...DEFAULT_SETTINGS.exam,...(input.exam||{})},
    smtp:{...DEFAULT_SETTINGS.smtp,...(input.smtp||{})},
    email:{...DEFAULT_SETTINGS.email,...(input.email||{})},
    operations:{...DEFAULT_SETTINGS.operations,...(input.operations||{})}
  };
}
