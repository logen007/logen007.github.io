// Paired bold markers are formatting; a lone [b] remains a gap marker.
// Other gap markers inside a pair are excluded to preserve existing passages.
export const boldPattern=()=>/\[b\]((?:(?!\[\/?[a-hz]\])[\s\S])+?)\[(?:\/b|b)\]/gi;

