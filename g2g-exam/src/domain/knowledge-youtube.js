// Store only a validated video ID; never persist caller-provided iframe HTML.
export function youtubeVideoId(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error('Hãy nhập link video YouTube hợp lệ.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Hãy dùng link HTTPS của YouTube.');
  const host=url.hostname,path=url.pathname.split('/').filter(Boolean);let id;
  if(host==='youtu.be')id=path.length===1?path[0]:null;
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
    if(url.pathname==='/watch')id=url.searchParams.get('v');
    else if(path.length===2&&['embed','shorts','live'].includes(path[0]))id=path[1];
  }
  return validateYoutubeId(id);
}
export function validateYoutubeId(id){if(typeof id!=='string'||! /^[A-Za-z0-9_-]{11}$/.test(id))throw Error('Hãy nhập link video YouTube hợp lệ.');return id;}
export const youtubeEmbedUrl=id=>'https://www.youtube-nocookie.com/embed/'+validateYoutubeId(id);
