export const DEFAULT_EXAM_MESSAGES=[
  'Hãy sẵn sàng',
  'Chúc may mắn',
  'Bình tĩnh – tự tin – chiến thắng',
  'Đọc kỹ hướng dẫn trước khi nghe',
  'Chọn câu dễ làm trước',
  'Đọc kỹ yêu cầu của đề',
  'Chú ý những từ khóa quan trọng',
  'Phân chia thời gian hợp lý',
  'Kiểm tra lại trước khi nộp bài',
  'Hít thở sâu, bạn làm được'
].join('\n');

export function examMessages(value){
  const lines=typeof value==='string'?value.split(/\r?\n/).map(line=>line.trim().slice(0,160)).filter(Boolean):[];
  return [...new Set(lines.length?lines:DEFAULT_EXAM_MESSAGES.split('\n'))].slice(0,100);
}
export function pickExamMessages(value,random=Math.random){
  const lines=examMessages(value),first=lines.splice(Math.floor(random()*lines.length),1)[0];
  return [first,lines.length?lines[Math.floor(random()*lines.length)]:first];
}
