import {boldPattern} from './text-markup.js';
// Public passage contains positions, never teacher answer letters.
export function parseGapText(text,limit){
  const passage=[],keys=[];let cursor=0;
  const boldSpans=[...String(text||'').matchAll(boldPattern())];
  for(const match of String(text||'').matchAll(/\[([a-hz])\]/gi)){
    if(boldSpans.some(span=>match.index>=span.index&&match.index<span.index+span[0].length))continue;
    if(match.index>cursor)passage.push(String(text).slice(cursor,match.index));
    if(match[1].toLowerCase()==='z')passage.push({example:true});
    else{passage.push({gap:keys.length});keys.push(match[1].toUpperCase().charCodeAt(0)-65);}
    cursor=match.index+match[0].length;
  }
  if(cursor<String(text||'').length)passage.push(String(text).slice(cursor));
  if(keys.length>limit)throw new Error(`Đoạn văn chỉ có ${limit} ô tính điểm. Bỏ bớt ký hiệu [a]–[h]; [z] dành cho ví dụ.`);
  return {passage,keys};
}

export function gapAuthorText(section,questions){
  return (section.gapPassage||[]).map(part=>typeof part==='string'?part:part.example?'[z]':`[${String.fromCharCode(97+Number(questions[part.gap]?.correctAnswer??0))}]`).join('');
}

export function inlineGapErrors(section){
  if(section.questionProfile?.layout!=='inline-gaps')return [];
  const parts=section.gapPassage||[],gaps=parts.filter(p=>p&&typeof p==='object'&&Number.isInteger(p.gap)),errors=[];
  if(gaps.length!==section.questionLimit||gaps.some((p,i)=>p.gap!==i))errors.push('Đoạn văn cần đúng '+section.questionLimit+' ô [a]–[h], theo thứ tự trong bài.');
  if(parts.filter(p=>p?.example).length!==1||!section.gapExample?.trim())errors.push('Thêm một [z] vào đoạn văn và nhập câu ví dụ ở ô z.');
  if((section.gapOptions||[]).length!==8||section.gapOptions.some(value=>!String(value||'').trim()))errors.push('Nhập đủ các câu lựa chọn a–h, kể cả câu không dùng.');
  if(parts.some(p=>typeof p==='string'&&/[\[\]]/.test(p.replace(boldPattern(),'$1'))))errors.push('Hoàn thành ký hiệu [a]–[h] cho đáp án hoặc [z] cho ví dụ; không để dấu ngoặc bị thiếu.');
  return errors.map(error=>section.name+': '+error);
}
