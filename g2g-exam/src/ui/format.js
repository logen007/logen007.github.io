export function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

export function fmtDate(v){
  if(!v)return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN',{
      day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
    }).format(new Date(v));
  }catch{
    return '—';
  }
}

export function statusText(s){
  return ({
    in_progress:'Đang làm',
    grading:'Đang chờ chấm',
    ready:'Đang chờ chấm',
    published:'Đã chấm',
    abandoned:'Bỏ dở',
    draft:'Bản nháp',
    trash:'Thùng rác',
  })[s]||s;
}

export function statusClass(s){
  return s==='published'||s==='ready'?'xanh':s==='grading'?'vang':s==='abandoned'||s==='trash'?'xam':'';
}

export function typeLabel(t){
  return ({
    single:'Một đáp án',
    truefalse:'Đúng / Sai',
    matching:'Ghép nội dung',
    cloze:'Điền từ',
    writing:'Viết',
    speaking:'Nói',
  })[t]||t;
}

export function countWords(v){
  return (String(v).trim().match(/\S+/g)||[]).length;
}
