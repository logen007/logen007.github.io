// Paired bold markers are formatting; a lone [b] remains a gap marker.
// Other gap markers inside a pair are excluded to preserve existing passages.
export const boldPattern=(letters='abcdefghz')=>new RegExp('\\[b\\]((?:(?!\\[\\/?['+letters+']\\])[\\s\\S])+?)\\[(?:\\/b|b)\\]','gi');
export const italicPattern=()=>/\[i\]([\s\S]+?)\[\/i\]/gi;
export const underlinePattern=()=>/\[u\]([\s\S]+?)\[\/u\]/gi;
export const signaturePattern=()=>/\[signature\]([\s\S]*?)\[\/signature\]/gi;
export const boxPattern=()=>/\[box\]([\s\S]+?)\[\/box\]/gi;
// Convert only instruction tokens with an unambiguous legacy meaning.
// Do not reinterpret bare formatting letters or old paired [b] syntax.
export function modernInstructionText(value=''){
  return String(value).replace(/\[([^\[\]\r\n]+)\]/g,(marker,text)=>{
    if(/^(?:[bi-z]|\d+|img|box|signature|\/[a-z]+)$/i.test(text.trim()))return marker;
    return '[box]'+text+'[/box]';
  });
}
export const stripTextMarkup=value=>String(value).replace(/\[b\]([\s\S]+?)\[\/b\]/gi,'$1').replace(boldPattern(),'$1').replace(italicPattern(),'$1').replace(underlinePattern(),'$1').replace(boxPattern(),'$1').replace(signaturePattern(),'$1');

