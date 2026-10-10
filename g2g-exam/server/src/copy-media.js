import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// One mapping per exam keeps repeated references consistent, never linked to the source file.
export function createMediaCopier(uploadDir=process.env.UPLOAD_DIR||'/data/uploads'){
  const root=path.resolve(uploadDir),mapping=new Map();
  async function copy(value){
    if(typeof value==='string'){
      const names=[...value.matchAll(/\/uploads\/([A-Za-z0-9._-]+)/g)].map(m=>m[1]);
      for(const name of names){
        if(name==='.'||name==='..')throw new Error('Đường dẫn media không hợp lệ.');
        if(!mapping.has(name)){
          const target='copy-'+randomUUID()+path.extname(name);
          try{await fs.copyFile(path.join(root,name),path.join(root,target),fs.constants.COPYFILE_EXCL);}
          catch{throw new Error('Không thể sao chép media của đề. Kiểm tra file nguồn và dung lượng lưu trữ.');}
          mapping.set(name,target);
        }
      }
      return value.replace(/\/uploads\/([A-Za-z0-9._-]+)/g,(_,name)=>'/uploads/'+mapping.get(name));
    }
    if(Array.isArray(value))return Promise.all(value.map(copy));
    if(value&&typeof value==='object'){
      const result={};for(const [key,item] of Object.entries(value))result[key]=await copy(item);return result;
    }
    return value;
  }
  return copy;
}
