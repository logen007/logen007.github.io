// Never let a client-selected filename turn an authenticated media upload into
// active same-origin HTML/SVG. Image signatures are a separate sanity check,
// not full decoding, malware scanning or proof that a file is harmless.
const imageExtensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif','image/bmp':'.bmp','image/x-icon':'.ico','image/vnd.microsoft.icon':'.ico'};
const audioExtensions={'audio/mpeg':'.mp3','audio/mp3':'.mp3','audio/mp4':'.m4a','audio/x-m4a':'.m4a','audio/wav':'.wav','audio/x-wav':'.wav','audio/ogg':'.ogg','audio/opus':'.opus','audio/webm':'.webm','audio/flac':'.flac','audio/aac':'.aac'};
const mediaType=mime=>String(mime||'').split(';')[0].trim().toLowerCase();
export function uploadExtension(mime,prefix){
  const type=mediaType(mime);
  if(prefix==='image/')return imageExtensions[type]||null;
  return type.startsWith('audio/')?(audioExtensions[type]||'.audio'):null;
}
export function imageHeaderMatches(bytes,mime){
  const type=mediaType(mime),ascii=(start,end)=>bytes.toString('latin1',start,end);
  if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/png')return bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&ascii(12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0;
  if(type==='image/gif')return bytes.length>=10&&['GIF87a','GIF89a'].includes(ascii(0,6))&&bytes.readUInt16LE(6)>0&&bytes.readUInt16LE(8)>0;
  if(type==='image/webp')return bytes.length>=16&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(ascii(12,16));
  if(type==='image/bmp')return bytes.length>=26&&ascii(0,2)==='BM';
  if(type==='image/x-icon'||type==='image/vnd.microsoft.icon')return bytes.length>=22&&bytes.readUInt16LE(0)===0&&bytes.readUInt16LE(2)===1&&bytes.readUInt16LE(4)>0;
  if(type==='image/avif'){
    // Walk bounded ISO-BMFF boxes, allowing a leading free box before ftyp.
    for(let offset=0;offset+8<=bytes.length;){
      const size=bytes.readUInt32BE(offset),end=offset+size;
      if(size<8||end>bytes.length)return false;
      if(ascii(offset+4,offset+8)==='ftyp'){
        if(size<16)return false;
        if(['avif','avis'].includes(ascii(offset+8,offset+12)))return true;
        for(let brand=offset+16;brand+4<=end;brand+=4)if(['avif','avis'].includes(ascii(brand,brand+4)))return true;
        return false;
      }
      offset=end;
    }
  }
  return false;
}
export function inlineMediaName(name){
  return /\.(?:jpe?g|png|webp|gif|avif|bmp|ico|mp3|m4a|mp4|wav|ogg|oga|opus|webm|flac|aac)$/i.test(name);
}
