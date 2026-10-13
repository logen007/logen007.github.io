import {boldPattern,italicPattern,underlinePattern,boxPattern} from '../domain/text-markup.js';

export function esc(v=''){
  return String(v??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

// Only our marker becomes HTML. User-supplied HTML is always escaped first.
export function textHtml(value=''){
  return esc(value).replace(/\[b\]([\s\S]+?)\[\/b\]/gi,'<strong class="text-bold">$1</strong>').replace(boldPattern(),'<strong class="text-bold">$1</strong>').replace(italicPattern(),'<em>$1</em>').replace(underlinePattern(),'<u>$1</u>').replace(boxPattern(),'<strong class="instruction-token">$1</strong>');
}

export function instructionTextHtml(value=''){
  return textHtml(value).replace(/\[([^\[\]\r\n]+)\]/g,(marker,text)=>{
    if(/^(?:[i-z]|\d+|img|\/[biu])$/i.test(text.trim()))return marker;
    return '<strong class="instruction-token">'+text+'</strong>';
  });
}

// Format complete text before inserting trusted controls, so paired tags may
// surround gaps without interpreting generated control HTML as author content.
export function textPartsHtml(parts){
  let prefix='G2GSLOT';
  const source=parts.filter(part=>typeof part==='string').join('');
  while(source.includes(prefix))prefix+='X';
  const slots=[];
  const text=parts.map(part=>typeof part==='string'?part:`${prefix}${slots.push(part.html)-1}END`).join('');
  return textHtml(text).replace(new RegExp(prefix+'(\\d+)END','g'),(_,index)=>slots[Number(index)]);
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
    incomplete:'Không hoàn thành',
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
