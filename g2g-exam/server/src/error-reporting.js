// Provider/SQL errors may contain credentials, request/response bodies and query
// details in enumerable properties, message, stack or cause. Never serialize them.
const operations=new Set(['api_request','monitor_sample','attempt_expiry','media_gc','trash_gc','ai_backfill','ai_job','ai_worker','ai_recovery','email_worker']);
const codes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','23505','23503','40001','40P01','FST_ERR_CTP_BODY_TOO_LARGE','FST_ERR_CTP_INVALID_JSON_BODY']);
export function errorStatus(error){
  try{
    const status=Number(error?.statusCode);
    return Number.isInteger(status)&&status>=400&&status<=599?status:500;
  }catch{return 500;}
}
export function safeErrorRecord(error,operation='api_request'){
  return {event:'application_failure',operation:operations.has(operation)?operation:'api_request',
    status:errorStatus(error),code:codes.has(error?.code)?error.code:'UNCLASSIFIED'};
}
export function reportSafeError(logger,error,operation='api_request'){
  const record=safeErrorRecord(error,operation);
  if(record.status>=500)logger?.error?.(record,'Application operation failed.');
  else logger?.warn?.(record,'Application request rejected.');
}
export function registerSafeErrorHandler(app){
  app.setErrorHandler((error,_request,reply)=>{
    reportSafeError(app.log,error);
    const status=errorStatus(error);
    return reply.code(status).send({error:status>=500?'Lỗi máy chủ. Vui lòng thử lại.':error.message,code:status});
  });
}
