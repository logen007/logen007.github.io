import {boldPattern,italicPattern,underlinePattern,stripTextMarkup} from './text-markup.js';
export const hasGapExample=section=>section.questionProfile?.inlineExample!==false;
// This author-only syntax is stripped before any passage is persisted or published.
export function parseGapAnswerText(text,limit,questionNumbers=[],plain=false){
  const source=String(text||'');
  const tokens=[...source.matchAll(/\{((?:\\.|[^{}\\])*)\}/g)];
  const authored=plain||tokens.some(match=>!/^(?:\d+|[a-z])$/i.test(match[1]));
  if(!authored){
    if(/[{}]/.test(source.replace(/\{(?:\d+|[a-z])\}/gi,'')))throw new Error('Đóng đủ ký hiệu {đáp án} trước khi lưu.');
    return {...parseGapText(source,limit,'abcdefghijklmnopqrstuvwxy',questionNumbers),embeddedAnswers:null};
  }
  const answers=[];
  const normalized=source.replace(/\{((?:\\.|[^{}\\])*)\}/g,(_,answer)=>{
    if(answer==='z')return '{z}';
    if(!plain&&/^\d+$/.test(answer))throw new Error('Không trộn số câu với đáp án trực tiếp.');
    if(answer.startsWith('`')&&answer.endsWith('`'))answer=answer.slice(1,-1);
    answers.push(answer.replace(/\\([`{}\\])/g,'$1').trim());
    if(answers.length>limit)throw new Error(`Đoạn văn chỉ có ${limit} ô tính điểm.`);
    return `{${String.fromCharCode(96+answers.length)}}`;
  });
  if(/[{}]/.test(normalized.replace(/\{[a-z]\}/gi,'')))throw new Error('Đóng đủ ký hiệu {đáp án} trước khi lưu.');
  const parsed=parseGapText(normalized,limit,'abcdefghijklmnopqrstuvwxy',questionNumbers);
  if(answers.length&&(parsed.keys.length!==answers.length||parsed.keys.some((key,index)=>key!==index)))throw new Error('Không trộn ký hiệu cũ với {`đáp án`}.');
  return {...parsed,embeddedAnswers:answers.length?answers:null};
}

export function gapAnswerAuthorText(section,questions){
  return (section.gapPassage||[]).map(part=>{
    if(typeof part==='string')return part;
    if(part.example)return hasGapExample(section)?'{z}':section.gapExample||'';
    const question=questions[part.gap];
    const value=question?.correctAnswer!=null&&question.correctAnswer!==''?section.gapOptions?.[Number(question.correctAnswer)]||'':'';
    return '{'+String(value).replace(/[\\{}]/g,'\\$&')+'}';
  }).join('');
}
// Public passage contains positions, never teacher answer letters.
export function parseGapText(text,limit,letters='abcdefgh',questionNumbers=[]){
  if(/\{`|`\}/.test(String(text||'')))throw new Error('Cú pháp {`đáp án`} chỉ dùng cho bài có ngân hàng đáp án chung.');
  text=String(text||'').replace(/\{(\d+)\}/g,(_,number)=>{
    const index=questionNumbers.indexOf(Number(number));
    if(index<0)throw new Error(`Số câu {${number}} không thuộc bài này.`);
    return `{${String.fromCharCode(97+index)}}`;
  });
  const passage=[],keys=[];let cursor=0;
  const positional=/\{[a-z]\}/i.test(text);
  const boldSpans=[...String(text||'').matchAll(boldPattern(letters+'z')),...String(text||'').matchAll(italicPattern()),...String(text||'').matchAll(underlinePattern())];
  const pattern=positional?/\{([a-z])\}/gi:new RegExp('\\[(['+letters+'z])\\]','gi');
  for(const match of String(text||'').matchAll(pattern)){
    if(!positional&&boldSpans.some(span=>match.index>=span.index&&match.index<span.index+span[0].length))continue;
    if(match.index>cursor)passage.push(String(text).slice(cursor,match.index));
    if(match[1].toLowerCase()==='z')passage.push({example:true});
    else{passage.push({gap:keys.length});keys.push(match[1].toUpperCase().charCodeAt(0)-65);}
    cursor=match.index+match[0].length;
  }
  if(cursor<String(text||'').length)passage.push(String(text).slice(cursor));
  if(keys.length>limit)throw new Error(`Đoạn văn chỉ có ${limit} ô tính điểm. Dùng {a}, {b}… theo thứ tự; {z} dành cho ví dụ.`);
  return {passage,keys};
}

export function gapAuthorText(section,questions,numbers){
  return (section.gapPassage||[]).map(part=>typeof part==='string'?part:part.example?(hasGapExample(section)?'{z}':section.gapExample||''):`{${numbers?(numbers.get(questions[part.gap]?.id)??Number(part.gap)+1):String.fromCharCode(97+Number(part.gap))}}`).join('');
}

export function inlineGapErrors(section){
  if(section.questionProfile?.layout!=='inline-gaps')return [];
  const parts=section.gapPassage||[],gaps=parts.filter(p=>p&&typeof p==='object'&&Number.isInteger(p.gap)),errors=[];
  const lastLetter=section.questionProfile.gapChoicesPerQuestion?String.fromCharCode(96+section.questionLimit):section.questionProfile.dynamicGapOptions?'y':'h';
  if(gaps.length!==section.questionLimit||gaps.some((p,i)=>p.gap!==i))errors.push(`Đoạn văn cần đúng ${section.questionLimit} ô {a}, {b}… theo thứ tự trong bài.`);
  if(hasGapExample(section)&&(parts.filter(p=>p?.example).length!==1||!section.gapExample?.trim()))errors.push('Thêm một {z} vào đoạn văn và nhập câu ví dụ ở ô z.');
  if(section.questionProfile.gapChoicesPerQuestion){
    if((section.gapOptions||[]).length!==section.questionLimit||section.gapOptions.some(row=>!Array.isArray(row)||row.length!==3||row.some(value=>!String(value||'').trim())))errors.push('Mỗi ký hiệu vị trí trong đoạn văn cần đủ 3 lựa chọn A, B, C.');
  }else{
    const count=section.questionProfile.dynamicGapOptions?section.questionLimit:8;
    if((section.gapOptions||[]).length<count||(!section.questionProfile.dynamicGapOptions&&section.gapOptions.length!==count)||section.gapOptions.length>25||section.gapOptions.some(value=>!String(value||'').trim()))errors.push(`Nhập ${section.questionProfile.dynamicGapOptions?'ít nhất ':''}${count} câu lựa chọn, tối đa 25; không để trống.`);
  }
  const plain=stripTextMarkup(parts.filter(p=>typeof p==='string').join('')).replace(/\[img\]/gi,'');
  if(/[\[\]{}]/.test(plain))errors.push('Kiểm tra cú pháp: dùng {a}, {b}… cho vị trí ô, {z} cho ví dụ; đóng đủ cặp định dạng.');
  return errors.map(error=>section.name+': '+error);
}
