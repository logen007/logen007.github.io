import {boldPattern,italicPattern,underlinePattern,stripTextMarkup} from './text-markup.js';
// Public passage contains positions, never teacher answer letters.
export function parseGapText(text,limit,letters='abcdefgh'){
  const passage=[],keys=[];let cursor=0;
  const boldSpans=[...String(text||'').matchAll(boldPattern(letters+'z')),...String(text||'').matchAll(italicPattern()),...String(text||'').matchAll(underlinePattern())];
  for(const match of String(text||'').matchAll(new RegExp('\\[(['+letters+'z])\\]','gi'))){
    if(boldSpans.some(span=>match.index>=span.index&&match.index<span.index+span[0].length))continue;
    if(match.index>cursor)passage.push(String(text).slice(cursor,match.index));
    if(match[1].toLowerCase()==='z')passage.push({example:true});
    else{passage.push({gap:keys.length});keys.push(match[1].toUpperCase().charCodeAt(0)-65);}
    cursor=match.index+match[0].length;
  }
  if(cursor<String(text||'').length)passage.push(String(text).slice(cursor));
  if(keys.length>limit)throw new Error(`Đoạn văn chỉ có ${limit} ô tính điểm. Bỏ bớt ký hiệu [a]–[${letters.at(-1)}]; [z] dành cho ví dụ.`);
  return {passage,keys};
}

export function gapAuthorText(section,questions){
  return (section.gapPassage||[]).map(part=>typeof part==='string'?part:part.example?'[z]':`[${String.fromCharCode(97+Number(questions[part.gap]?.correctAnswer??0))}]`).join('');
}

export function inlineGapErrors(section){
  if(section.questionProfile?.layout!=='inline-gaps')return [];
  const parts=section.gapPassage||[],gaps=parts.filter(p=>p&&typeof p==='object'&&Number.isInteger(p.gap)),errors=[];
  const lastLetter=section.questionProfile.gapChoicesPerQuestion?'c':section.questionProfile.dynamicGapOptions?'y':'h';
  if(gaps.length!==section.questionLimit||gaps.some((p,i)=>p.gap!==i))errors.push(`Đoạn văn cần đúng ${section.questionLimit} ô [a]–[${lastLetter}], theo thứ tự trong bài.`);
  if(parts.filter(p=>p?.example).length!==1||!section.gapExample?.trim())errors.push('Thêm một [z] vào đoạn văn và nhập câu ví dụ ở ô z.');
  if(section.questionProfile.gapChoicesPerQuestion){
    if((section.gapOptions||[]).length!==section.questionLimit||section.gapOptions.some(row=>!Array.isArray(row)||row.length!==3||row.some(value=>!String(value||'').trim())))errors.push('Mỗi chỗ trống cần đủ 3 đáp án a, b, c.');
  }else{
    const count=section.questionProfile.dynamicGapOptions?section.questionLimit:8;
    if((section.gapOptions||[]).length<count||(!section.questionProfile.dynamicGapOptions&&section.gapOptions.length!==count)||section.gapOptions.length>25||section.gapOptions.some(value=>!String(value||'').trim()))errors.push(`Nhập ${section.questionProfile.dynamicGapOptions?'ít nhất ':''}${count} câu lựa chọn, tối đa 25; không để trống.`);
  }
  if(parts.some(p=>typeof p==='string'&&/[\[\]]/.test(stripTextMarkup(p))))errors.push(`Hoàn thành ký hiệu [a]–[${lastLetter}] cho đáp án hoặc [z] cho ví dụ; không để dấu ngoặc bị thiếu.`);
  return errors.map(error=>section.name+': '+error);
}
