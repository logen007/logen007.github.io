// Browser code-splitting exposes this CommonJS package through its default export.
export async function drawQr(canvas,text,width=224){
 const {default:QRCode}=await import('qrcode');
 return QRCode.toCanvas(canvas,text,{width,margin:2});
}
