// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
import {createLectureHandler,signToken,type LectureEnvironment} from './handler';
const student='00000000-0000-0000-0000-000000000001',lecture='00000000-0000-0000-0000-000000000002';
const env:LectureEnvironment={supabaseUrl:'https://isolated.test',anonKey:'public-test-key',serviceKey:'private-service-test-key',livekitUrl:'wss://media.test',apiKey:'test-api',apiSecret:'test-only-secret-at-least-32-characters',reconcileSecret:'test-scheduler-secret-at-least-32-characters',origins:['https://app.test']};
const fetcher=vi.fn<typeof fetch>();
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const call=(body:unknown,headers:Record<string,string>={Authorization:'Bearer real-session',Origin:'https://app.test'})=>createLectureHandler(env,fetcher)(new Request('https://edge.test',{method:'POST',headers,body:JSON.stringify(body)}));
beforeEach(()=>{fetcher.mockReset();fetcher.mockImplementation(async input=>String(input).endsWith('/auth/v1/user')?json({id:student}):json({identity:student,name:'Student',room:'yhub-lecture-'+lecture,moderator:false}));});
it('signs short-lived scoped tokens and ignores forged identity, room and role fields',async()=>{
 const r=await call({action:'join',lectureId:lecture,identity:'forged',room:'foreign',moderator:true});expect(r.status).toBe(200);const data=await r.json();
 const [header,payload,signature]=data.token.split('.');const claims=JSON.parse(Buffer.from(payload,'base64url').toString());
 expect(claims.sub).toBe(student);expect(claims.video.room).toBe('yhub-lecture-'+lecture);expect(claims.video.roomAdmin).toBeUndefined();expect(JSON.parse(claims.metadata).moderator).toBe(false);expect(claims.exp-claims.nbf).toBe(35);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.apiSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 expect(await crypto.subtle.verify('HMAC',key,Buffer.from(signature,'base64url'),new TextEncoder().encode(header+'.'+payload))).toBe(true);
 expect(JSON.stringify(data)).not.toContain(env.apiSecret);expect(r.headers.get('Cache-Control')).toBe('no-store');
});
it('fails closed on missing, expired or forged Auth sessions',async()=>{
 expect((await call({action:'join',lectureId:lecture},{})).status).toBe(401);
 fetcher.mockResolvedValue(json({error:'expired'},401));expect((await call({action:'join',lectureId:lecture})).status).toBe(401);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('requires the database gate even after successful native Auth verification',async()=>{
 fetcher.mockResolvedValueOnce(json({id:student})).mockResolvedValueOnce(json({message:'denied'},403));expect((await call({action:'join',lectureId:lecture})).status).toBe(403);
});
it('rejects inconsistent permission receipts instead of minting a token',async()=>{
 fetcher.mockResolvedValueOnce(json({id:student})).mockResolvedValueOnce(json({identity:'other',room:'foreign',name:'x',moderator:true}));expect((await call({action:'join',lectureId:lecture})).status).toBe(503);
});
it('denies foreign origins and unconfigured providers',async()=>{
 expect((await call({action:'join',lectureId:lecture},{Origin:'https://foreign.test'})).status).toBe(403);
 const handler=createLectureHandler({...env,apiSecret:''},fetcher);expect((await handler(new Request('https://edge.test',{method:'POST'}))).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
});
it('records a durable block before provider removal and reports disconnection pending',async()=>{
 fetcher.mockResolvedValueOnce(json({id:student})).mockResolvedValueOnce(json(lecture)).mockRejectedValueOnce(new Error('provider offline'));
 const r=await call({action:'remove',lectureId:lecture,studentId:student,reason:'conduct issue'});expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'disconnect_pending',blocked:true});
 expect(String(fetcher.mock.calls[1][0])).toContain('block_lecture_participant');expect(String(fetcher.mock.calls[2][0])).toContain('RemoveParticipant');
});
it('does not contact the provider when a removal lacks database authorization',async()=>{
 fetcher.mockResolvedValueOnce(json({id:student})).mockResolvedValueOnce(json({error:'denied'},403));expect((await call({action:'remove',lectureId:lecture,studentId:student,reason:'unauthorized'})).status).toBe(403);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('restricts reconciliation to scheduler credentials',async()=>{
 expect((await call({action:'reconcile'})).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
});
it('reconciles current database membership and retries failed disconnects on the next run',async()=>{
 let failing=true;
 fetcher.mockImplementation(async input=>{
  const url=String(input);if(url.endsWith('ListRooms'))return json({rooms:[{name:'yhub-lecture-'+lecture},{name:'other-app'}]});
  if(url.endsWith('ListParticipants'))return json({participants:[{identity:student}]});
  if(url.includes('lecture_participant_allowed'))return json(false);
  if(url.endsWith('RemoveParticipant')){if(failing)throw new Error('offline');return json({});}throw new Error('unexpected');
 });
 const headers={'x-reconcile-secret':env.reconcileSecret};let r=await call({action:'reconcile'},headers);expect(r.status).toBe(503);expect(await r.json()).toEqual({removed:0,failed:1});
 failing=false;r=await call({action:'reconcile'},headers);expect(r.status).toBe(200);expect(await r.json()).toEqual({removed:1,failed:0});
});
it('does not disconnect an authorized current participant',async()=>{
 fetcher.mockResolvedValueOnce(json({rooms:[{name:'yhub-lecture-'+lecture}]})).mockResolvedValueOnce(json({participants:[{identity:student}]})).mockResolvedValueOnce(json(true));
 const r=await call({action:'reconcile'},{'x-reconcile-secret':env.reconcileSecret});expect(await r.json()).toEqual({removed:0,failed:0});expect(fetcher).toHaveBeenCalledTimes(3);
});
it('pins token algorithm and never accepts caller-supplied expiry or issuer',async()=>{
 const token=await signToken('trusted','test-secret',{iss:'forged',exp:999999999999},0);const data=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());expect(data.iss).toBe('trusted');expect(data.exp).toBe(30);
});
