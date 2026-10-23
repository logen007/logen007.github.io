export function imageDimensions(width,height,maxEdge=2400){
  if(!width||!height||width*height>80000000)throw new Error('Ảnh quá lớn hoặc không đọc được.');
  const scale=Math.min(1,maxEdge/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function imagePositionName({skill='exam',part=1,question,slot='prompt'}={}){
  const names={reading:'reading',listening:'listening',writing:'writing',speaking:'speaking','Đọc':'reading','Nghe':'listening','Viết':'writing','Nói':'speaking'};
  const clean=value=>String(value).toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24);
  return [names[skill]||names[String(skill).toLowerCase()]||'exam',Math.max(1,Number(part)||1),question?'q'+Math.max(1,Number(question)||1):'',clean(slot)].filter(Boolean).join('-')+'.jpg';
}
export async function optimizeExamImage(file,position,{maxBytes=8*1024*1024}={}){
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Không đọc được ảnh. Vui lòng chọn JPG, PNG hoặc WebP.'));img.src=url;});
    const size=imageDimensions(img.naturalWidth,img.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Trình duyệt không thể xử lý ảnh.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);
    ctx.drawImage(img,0,0,size.width,size.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
    if(!blob||blob.type!=='image/jpeg')throw new Error('Không thể chuyển ảnh sang JPG.');
    if(blob.size>maxBytes)throw new Error(`Ảnh sau tối ưu vượt ${maxBytes/1024/1024} MB. Vui lòng chọn ảnh nhỏ hơn.`);
    return new File([blob],imagePositionName(position),{type:'image/jpeg'});
  }finally{URL.revokeObjectURL(url);}
}
