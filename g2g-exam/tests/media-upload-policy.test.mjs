import assert from 'node:assert/strict';
import {imageHeaderMatches,uploadExtension} from '../server/src/media-upload-policy.js';
// Header fixtures deliberately do not claim full decoder/CRC validity.
const png=Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001','hex');
const bmp=Buffer.alloc(26);bmp.write('BM');
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);
const ftyp=(major,compatible=[])=>{
 const bytes=Buffer.alloc(16+compatible.length*4);bytes.writeUInt32BE(bytes.length,0);bytes.write('ftyp',4);bytes.write(major,8);
 compatible.forEach((brand,index)=>bytes.write(brand,16+index*4));return bytes;
};
const fixtures=[
 ['image/png',png],['image/jpeg',Buffer.from('ffd8ffe000104a464946','hex')],
 ['image/gif',Buffer.from('47494638396101000100','hex')],
 ['image/webp',Buffer.from('52494646100000005745425056503820','hex')],
 ['image/bmp',bmp],['image/x-icon',ico],['image/vnd.microsoft.icon',ico],
 ['image/avif',ftyp('avif')],['image/avif',ftyp('mif1',['mif1','avif'])],
 ['image/avif',ftyp('avis')],
];
for(const [type,bytes] of fixtures){
 assert.equal(imageHeaderMatches(bytes,type),true,type);
 assert.equal(imageHeaderMatches(bytes,` ${type.toUpperCase()}; charset=binary `),true);
 for(const invalid of [Buffer.alloc(0),Buffer.from('<html>not an image</html>'),Buffer.from('<svg onload="test()"/>')])assert.equal(imageHeaderMatches(invalid,type),false,type);
}
for(const type of ['image/jpeg','image/gif','image/webp','image/bmp','image/x-icon','image/avif'])assert.equal(imageHeaderMatches(png,type),false);
for(let length=0;length<24;length++)assert.equal(imageHeaderMatches(png.subarray(0,length),'image/png'),false);
const zeroSize=Buffer.from(png);zeroSize.writeUInt32BE(0,16);assert.equal(imageHeaderMatches(zeroSize,'image/png'),false);
const highBitGif=Buffer.from(fixtures[2][1]);highBitGif[0]|=128;assert.equal(imageHeaderMatches(highBitGif,'image/gif'),false);
assert.equal(imageHeaderMatches(ftyp('heic',['mif1']),'image/avif'),false);
assert.equal(imageHeaderMatches(Buffer.from('avif embedded in ordinary text'),'image/avif'),false);
const free=Buffer.from('0000000866726565','hex');assert.equal(imageHeaderMatches(Buffer.concat([free,ftyp('avif')]),'image/avif'),true);
for(const size of [0,1,7,4097,0xffffffff]){const malformed=ftyp('avif');malformed.writeUInt32BE(size);assert.equal(imageHeaderMatches(malformed,'image/avif'),false);}
assert.equal(uploadExtension('image/svg+xml','image/'),null);
assert.equal(uploadExtension('audio/unlisted','audio/'),'.audio','Audio compatibility is unchanged');
console.log('Image signatures: supported format headers, MIME mismatch, HTML/SVG spoofing, truncation and bounded AVIF parsing passed.');
