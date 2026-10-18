// Never let a client-selected filename turn an authenticated media upload into
// active same-origin HTML/SVG. This policy does not inspect or trust file bytes.
const imageExtensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif','image/bmp':'.bmp','image/x-icon':'.ico','image/vnd.microsoft.icon':'.ico'};
const audioExtensions={'audio/mpeg':'.mp3','audio/mp3':'.mp3','audio/mp4':'.m4a','audio/x-m4a':'.m4a','audio/wav':'.wav','audio/x-wav':'.wav','audio/ogg':'.ogg','audio/opus':'.opus','audio/webm':'.webm','audio/flac':'.flac','audio/aac':'.aac'};
export function uploadExtension(mime,prefix){
  const type=String(mime||'').split(';')[0].trim().toLowerCase();
  if(prefix==='image/')return imageExtensions[type]||null;
  return type.startsWith('audio/')?(audioExtensions[type]||'.audio'):null;
}
export function inlineMediaName(name){
  return /\.(?:jpe?g|png|webp|gif|avif|bmp|ico|mp3|m4a|mp4|wav|ogg|oga|opus|webm|flac|aac)$/i.test(name);
}
