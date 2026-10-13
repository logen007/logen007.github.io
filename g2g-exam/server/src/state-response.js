import {createHash} from 'node:crypto';

export function stateResponse(state,request,reply,{prehashed=false}={}){
  const revision=prehashed?state.revision:createHash('sha256').update(JSON.stringify({...state,revision:undefined})).digest('hex');
  const etag='"'+revision+'"';
  reply.header('Cache-Control','private, no-cache').header('ETag',etag).header('Vary','Cookie');
  if(request.headers['if-none-match']===etag)return reply.code(304).send();
  return {...state,revision};
}
