import crypto from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {query,getSettings,appError,now} from './db.js';
import {isPrimaryMasterEmail,normalizeEmail} from './roles.js';
import {loginReturnPath} from './auth-routing.js';
import {externalClassId} from './actions/class-enrollment.js';

const PUBLIC_URL=String(process.env.PUBLIC_URL||'http://localhost:8080').replace(/\/$/,'');
const REDIRECT_URI=process.env.GOOGLE_REDIRECT_URI||`${PUBLIC_URL}/api/auth/google/callback`;
const COOKIE_DOMAIN=process.env.COOKIE_DOMAIN||undefined;
const secure=process.env.NODE_ENV==='production';
const oauth=()=>new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,REDIRECT_URI);

function cookieOpts(maxAge=60*60*24*30){return {path:'/',httpOnly:true,sameSite:'lax',secure,signed:true,maxAge,domain:COOKIE_DOMAIN};}
function teacherEmailSet(settings){return new Set((settings?.auth?.teacherEmails||[]).map(normalizeEmail).filter(Boolean));}
export async function userById(id){const r=await query(`SELECT id,email,role,active,data FROM users WHERE id=$1`,[id]);if(!r.rowCount)return null;const x=r.rows[0];return {...(x.data||{}),id:x.id,email:x.email,role:x.role,active:x.active};}
async function sessionUser(request){const raw=request.cookies.g2g_session;if(!raw)return null;const u=request.unsignCookie(raw);if(!u.valid||!u.value)return null;const user=await userById(u.value);return user?.active===false?null:user;}
export async function currentUser(request){
  const user=await sessionUser(request);if(!user)return null;
  if(user.role!=='master')return user;
  const selected=request.unsignCookie(request.cookies.g2g_test_role||'');
  const role=selected.valid&&['student','teacher','master'].includes(selected.value)?selected.value:'master';
  return {...user,role,canTestRoles:true};
}
export async function requireUser(request){const user=await currentUser(request);if(!user||user.active===false)throw appError(401,'Bạn cần đăng nhập.');return user;}
export async function requireRole(request,...roles){const user=await requireUser(request);if(!roles.includes(user.role))throw appError(403,'Bạn không có quyền thực hiện thao tác này.');return user;}

async function finishGoogleLogin(p,reply){
    if(!p?.sub||!p.email||p.email_verified!==true)throw appError(401,'Tài khoản Google chưa xác minh email.');
    const email=normalizeEmail(p.email),id=`google:${p.sub}`;
    const settings=await getSettings(),teacherEmails=teacherEmailSet(settings);
    const existing=await userById(id),master=isPrimaryMasterEmail(email),preapprovedTeacher=teacherEmails.has(email);
    if(existing?.active===false)throw appError(403,'Tài khoản đã bị vô hiệu hóa.');
    const role=master||existing?.role==='master'?'master':preapprovedTeacher?'teacher':existing?.role||'student';
    if(!existing){
      if(settings.auth.allowNewStudents===false&&!master&&!preapprovedTeacher)throw appError(403,'Hệ thống hiện không nhận thêm tài khoản học viên mới.');
      const domain=String(settings.auth.allowedDomain||'').toLowerCase();
      if(domain&&!email.endsWith(`@${domain}`)&&!master&&!preapprovedTeacher)throw appError(403,`Chỉ email thuộc ${domain} được đăng ký.`);
      const data={name:p.name||email.split('@')[0],picture:p.picture||'',createdAt:now(),...(role==='student'?{level:'A1',classId:await externalClassId()}:{})};
      await query(`INSERT INTO users(id,email,role,active,data) VALUES($1,$2,$3,true,$4::jsonb)`,[id,email,role,JSON.stringify(data)]);
    }else{
      const data={name:existing.profileCompletedAt?existing.name:p.name||existing.name||email.split('@')[0],picture:p.picture||existing.picture||''};
      delete data.id;delete data.email;delete data.role;delete data.active;
      await query(`UPDATE users SET email=$2,role=$3,data=data||$4::jsonb,updated_at=now() WHERE id=$1`,[id,email,role,JSON.stringify(data)]);
    }
    reply.setCookie('g2g_session',id,cookieOpts());

    return {id,role};
}

export async function registerAuthRoutes(fastify){
  fastify.get('/api/auth/google/one-tap',async(request,reply)=>{
    const settings=await getSettings();
    if(settings.auth.googleLoginEnabled===false||!process.env.GOOGLE_CLIENT_ID)return {enabled:false};
    const nonce=crypto.randomBytes(32).toString('hex');
    reply.setCookie('g2g_one_tap',JSON.stringify({nonce,expires:Date.now()+600000}),cookieOpts(600));
    return {enabled:true,clientId:process.env.GOOGLE_CLIENT_ID,nonce};
  });
  fastify.post('/api/auth/google/one-tap',async(request,reply)=>{
    if(request.headers.origin!==new URL(PUBLIC_URL).origin)throw appError(403,'Nguồn đăng nhập không hợp lệ.');
    const settings=await getSettings();
    if(settings.auth.googleLoginEnabled===false)throw appError(403,'Đăng nhập Google đang tạm tắt.');
    if(!process.env.GOOGLE_CLIENT_ID)throw appError(503,'Google Login chưa được cấu hình.');
    const signed=request.unsignCookie(request.cookies.g2g_one_tap||'');
    let challenge;try{challenge=signed.valid?JSON.parse(signed.value):null;}catch{}
    if(!challenge?.nonce||!Number.isFinite(challenge.expires)||challenge.expires<Date.now())throw appError(400,'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.');
    const credential=request.body?.credential;
    if(typeof credential!=='string'||credential.length>16384)throw appError(400,'Thông tin đăng nhập không hợp lệ.');
    let payload;
    try{payload=(await oauth().verifyIdToken({idToken:credential,audience:process.env.GOOGLE_CLIENT_ID})).getPayload();}
    catch{throw appError(401,'Không xác minh được tài khoản Google.');}
    if(payload?.nonce!==challenge.nonce)throw appError(401,'Phiên đăng nhập không khớp.');
    reply.clearCookie('g2g_one_tap',{path:'/',domain:COOKIE_DOMAIN});
    const {role}=await finishGoogleLogin(payload,reply);
    return {returnTo:loginReturnPath(String(request.body?.return||'/'),role)};
  });
  fastify.get('/api/auth/me',async request=>({user:await currentUser(request)}));
  fastify.post('/api/auth/test-role',async(request,reply)=>{
    const user=await sessionUser(request);if(!user)throw appError(401,'Bạn cần đăng nhập.');
    if(user.role!=='master')throw appError(403,'Chỉ tài khoản Admin được đổi vai trò thử nghiệm.');
    const role=String(request.body?.role||'');if(!['student','teacher','master'].includes(role))throw appError(400,'Kiểu tài khoản không hợp lệ.');
    if(role==='master')reply.clearCookie('g2g_test_role',{path:'/',domain:COOKIE_DOMAIN});
    else reply.setCookie('g2g_test_role',role,cookieOpts());
    return {user:{...user,role,canTestRoles:true}};
  });
  fastify.get('/api/auth/google',async(request,reply)=>{
    const settings=await getSettings();
    if(settings.auth.googleLoginEnabled===false)throw appError(403,'Đăng nhập Google đang tạm tắt.');
    if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw appError(503,'Google Login chưa được cấu hình trên máy chủ.');
    const state=crypto.randomBytes(24).toString('hex');
    reply.setCookie('g2g_oauth_state',state,{...cookieOpts(600),maxAge:600});
    const requestedReturn=String(request.query?.return||'/');
    const returnTo=loginReturnPath(requestedReturn,'master');
    reply.setCookie('g2g_return_to',returnTo,{...cookieOpts(600),maxAge:600});
    const url=oauth().generateAuthUrl({access_type:'online',scope:['openid','email','profile'],prompt:'select_account',state});
    return reply.redirect(url);
  });
  fastify.get('/api/auth/google/callback',async(request,reply)=>{
    const {code,state}=request.query||{};
    const signed=request.unsignCookie(request.cookies.g2g_oauth_state||'');
    if(!code||!state||!signed.valid||signed.value!==state)throw appError(400,'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.');
    const returnCookie=request.unsignCookie(request.cookies.g2g_return_to||'');
    reply.clearCookie('g2g_oauth_state',{path:'/',domain:COOKIE_DOMAIN});
    reply.clearCookie('g2g_return_to',{path:'/',domain:COOKIE_DOMAIN});
    const client=oauth();const {tokens}=await client.getToken(String(code));
    if(!tokens.id_token)throw appError(401,'Google không trả về thông tin đăng nhập.');
    const ticket=await client.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID});
    const p=ticket.getPayload();
    const {role}=await finishGoogleLogin(p,reply);
    return reply.redirect(loginReturnPath(returnCookie.valid?returnCookie.value:'/',role));
  });
  fastify.post('/api/auth/logout',async(_request,reply)=>{reply.clearCookie('g2g_session',{path:'/',domain:COOKIE_DOMAIN});reply.clearCookie('g2g_test_role',{path:'/',domain:COOKIE_DOMAIN});return {ok:true};});
}
