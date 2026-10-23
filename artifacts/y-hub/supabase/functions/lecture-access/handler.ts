/** Portable edge handler: no browser/service authority supplied by request bodies. */
export interface LectureEnvironment {supabaseUrl:string;anonKey:string;serviceKey:string;livekitUrl:string;apiKey:string;apiSecret:string;reconcileSecret:string;origins:string[]}
type Gate={identity:string;name:string;room:string;moderator:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const utf8=new TextEncoder();
const base64=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function signToken(key:string,secret:string,claims:Record<string,unknown>,now=Date.now()){
 const header=base64(utf8.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));
 const body=base64(utf8.encode(JSON.stringify({...claims,iss:key,nbf:Math.floor(now/1000)-5,exp:Math.floor(now/1000)+30})));
 const cryptoKey=await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return header+'.'+body+'.'+base64(new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,utf8.encode(header+'.'+body))));
}
export function joinClaims(gate:Gate){return {sub:gate.identity,name:gate.name,metadata:JSON.stringify({moderator:gate.moderator}),video:{roomJoin:true,room:gate.room,canPublish:true,canSubscribe:true,canPublishData:true,canUpdateOwnMetadata:false}};}
class HttpError extends Error{constructor(public status:number,public code:string){super(code);}}
export function createLectureHandler(env:LectureEnvironment,fetcher:typeof fetch=fetch){
 async function request(url:string,init:RequestInit){let response:Response;try{response=await fetcher(url,{...init,signal:AbortSignal.timeout(8000)});}catch{throw new HttpError(503,'upstream_unavailable');}if(!response.ok)throw new HttpError(response.status===401?401:response.status===403?403:503,'request_denied_or_unavailable');return response.json();}
 async function rpc(name:string,args:Record<string,unknown>,bearer:string,service=false){return request(env.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service?env.serviceKey:env.anonKey,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(args)});}
 async function provider(method:string,args:Record<string,unknown>,grant:Record<string,unknown>){
  const token=await signToken(env.apiKey,env.apiSecret,{video:grant});
  const url=new URL(env.livekitUrl);url.protocol='https:';url.pathname='/twirp/livekit.RoomService/'+method;url.search='';url.hash='';
  return request(url.href,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});
 }
 async function reconcile(){
  if(!env.serviceKey)throw new HttpError(503,'reconciler_unconfigured');
  const listed=await provider('ListRooms',{}, {roomList:true});
  listed.rooms??=[];if(!Array.isArray(listed.rooms))throw new HttpError(503,'provider_contract');
  let removed=0,failed=0;
  for(const room of listed.rooms){
   if(typeof room.name!=='string'||!room.name.startsWith('yhub-lecture-')||!uuid.test(room.name.slice(13)))continue;
   try{const response=await provider('ListParticipants',{room:room.name},{roomAdmin:true,room:room.name});
    response.participants??=[];if(!Array.isArray(response.participants))throw new Error('provider contract');
    for(const p of response.participants){if(typeof p.identity!=='string')continue;
     try{const allowed=uuid.test(p.identity)&&await rpc('lecture_participant_allowed',{p_lecture:room.name.slice(13),p_user:p.identity},env.serviceKey,true);
      if(allowed!==true){await provider('RemoveParticipant',{room:room.name,identity:p.identity},{roomAdmin:true,room:room.name});removed++;}
     }catch{failed++;}
    }
   }catch{failed++;}
  }
  return {removed,failed};
 }
 return async(req:Request):Promise<Response>=>{
  const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&env.origins.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  try{
   if(origin&&!env.origins.includes(origin))throw new HttpError(403,'origin_denied');
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(req.method!=='POST')throw new HttpError(405,'method_not_allowed');
   if(!env.supabaseUrl.startsWith('https://')||!env.anonKey||!env.livekitUrl.startsWith('wss://')||!env.apiKey||env.apiSecret.length<32||env.reconcileSecret.length<32||!env.serviceKey)throw new HttpError(503,'provider_unconfigured');
   const raw=await req.text();if(raw.length>4096)throw new HttpError(413,'request_too_large');let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{throw new HttpError(400,'invalid_request');}
   if(!body||Array.isArray(body)||typeof body!=='object')throw new HttpError(400,'invalid_request');
   if(body.action==='reconcile'){
    const supplied=req.headers.get('x-reconcile-secret')??'';
    // Hash comparison avoids secret-length timing and never exposes the scheduler credential.
    const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(s)));
    const [a,b]=await Promise.all([digest(supplied),digest(env.reconcileSecret)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
    if(env.reconcileSecret.length<32||mismatch!==0)throw new HttpError(403,'scheduler_denied');
    const result=await reconcile();return reply(result.failed?503:200,result);
   }
   const bearer=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];if(!bearer)throw new HttpError(401,'authentication_required');
   const user=await request(env.supabaseUrl+'/auth/v1/user',{headers:{apikey:env.anonKey,Authorization:'Bearer '+bearer}});
   if(typeof user.id!=='string'||!uuid.test(user.id))throw new HttpError(401,'invalid_identity');
   if(typeof body.lectureId!=='string'||!uuid.test(body.lectureId))throw new HttpError(400,'invalid_lecture');
   const lectureId=body.lectureId.toLowerCase();
   if(body.action==='join'){
    const gate=await rpc('lecture_join_permission',{p_lecture:lectureId},bearer) as Gate;
    if(gate.identity!==user.id||gate.room!=='yhub-lecture-'+lectureId||typeof gate.moderator!=='boolean'||typeof gate.name!=='string')throw new HttpError(503,'invalid_permission_receipt');
    return reply(200,{url:env.livekitUrl,token:await signToken(env.apiKey,env.apiSecret,joinClaims(gate)),moderator:gate.moderator});
   }
   if(body.action==='remove'){
    if(typeof body.studentId!=='string'||!uuid.test(body.studentId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500)throw new HttpError(400,'invalid_removal');
    const studentId=body.studentId.toLowerCase();
    const id=await rpc('block_lecture_participant',{p_lecture:lectureId,p_student:studentId,p_reason:body.reason},bearer);
    if(typeof id!=='string'||!uuid.test(id))throw new HttpError(503,'unconfirmed_block');
    try{await provider('RemoveParticipant',{room:'yhub-lecture-'+lectureId,identity:studentId},{roomAdmin:true,room:'yhub-lecture-'+lectureId});}catch{return reply(503,{error:'disconnect_pending',blocked:true});}
    return reply(200,{blocked:true});
   }
   throw new HttpError(400,'unknown_action');
  }catch(error){return reply(error instanceof HttpError?error.status:503,{error:error instanceof HttpError?error.code:'service_unavailable'});}
 };
}
