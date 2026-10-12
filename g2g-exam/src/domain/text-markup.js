// Paired bold markers are formatting; a lone [b] remains a gap marker.
// Other gap markers inside a pair are excluded to preserve existing passages.
export const boldPattern=(letters='abcdefghz')=>new RegExp('\\[b\\]((?:(?!\\[\\/?['+letters+']\\])[\\s\\S])+?)\\[(?:\\/b|b)\\]','gi');
export const italicPattern=()=>/\[i\]([\s\S]+?)\[\/i\]/gi;
export const underlinePattern=()=>/\[u\]([\s\S]+?)\[\/u\]/gi;
export const stripTextMarkup=value=>String(value).replace(boldPattern(),'$1').replace(italicPattern(),'$1').replace(underlinePattern(),'$1');

