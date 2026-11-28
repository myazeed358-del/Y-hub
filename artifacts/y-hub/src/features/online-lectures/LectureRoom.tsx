import {useEffect,useRef,useState} from 'react';
import {Button} from '@workspace/y-hub-ds/components/ui/button';
import {livekitProvider,type LectureConnection,type LectureParticipant,type LectureChat} from './provider';
import {lectureAccess} from './repository';
import {startLectureConnection,type ConnectionStatus} from './connectionLifecycle';
function Media({track,local}:{track:LectureParticipant['tracks'][number];local:boolean}){
 const ref=useRef<HTMLVideoElement&HTMLAudioElement>(null);
 useEffect(()=>{const element=ref.current;if(!element)return;element.srcObject=new MediaStream([track.track]);void element.play().catch(()=>{});return()=>{element.srcObject=null;};},[track.track]);
 return track.kind==='video'?<video ref={ref} autoPlay playsInline muted={local} className="w-full rounded-lg bg-black aspect-video object-contain"/>:local?null:<audio ref={ref} autoPlay/>;
}
export function LectureRoom({lecture,ar,onLeave}:{lecture:string;ar:boolean;onLeave:()=>void}){
 const connection=useRef<LectureConnection|null>(null);const [participants,setParticipants]=useState<LectureParticipant[]>([]),[chat,setChat]=useState<LectureChat[]>([]),[message,setMessage]=useState('');
 const [ready,setReady]=useState(false),[moderator,setModerator]=useState(false),[error,setError]=useState(false),[busy,setBusy]=useState(false),[mic,setMic]=useState(false),[camera,setCamera]=useState(false),[sharing,setSharing]=useState(false);
 const [connectionStatus,setConnectionStatus]=useState<ConnectionStatus>('connecting');
 const retry=useRef<()=>void>(()=>{});
 const actionEpoch=useRef(0),working=useRef(false),messageRevision=useRef(0);
 useEffect(()=>{let active=true;setReady(false);setError(false);setParticipants([]);setChat([]);
  const update=()=>{if(active&&connection.current)setParticipants(connection.current.participants());};
  const lifecycle=startLectureConnection({join:()=>lectureAccess.join(lecture),connect:livekitProvider.connect,
   status:(status,connected,isModerator)=>{if(!active)return;actionEpoch.current++;working.current=false;setBusy(false);connection.current=connected;setConnectionStatus(status);setReady(status==='ready');setError(status==='failed');setModerator(isModerator);setMic(false);setCamera(false);setSharing(false);if(status!=='ready')setParticipants([]);},
   update,chat:c=>{if(active)setChat(messages=>[...messages,c].slice(-100));}});
  retry.current=lifecycle.retry;
  return()=>{active=false;actionEpoch.current++;working.current=false;connection.current=null;retry.current=()=>{};lifecycle.stop();};
 },[lecture]);
 async function action(fn:(target:LectureConnection,isCurrent:()=>boolean)=>Promise<unknown>){
  const target=connection.current;if(working.current||!target)return;
  const epoch=actionEpoch.current,isCurrent=()=>actionEpoch.current===epoch&&connection.current===target;
  working.current=true;setBusy(true);setError(false);
  try{await fn(target,isCurrent);}catch{if(isCurrent())setError(true);}finally{if(isCurrent()){working.current=false;setBusy(false);}}
 }
 async function device(target:LectureConnection,isCurrent:()=>boolean,kind:'microphone'|'camera'|'screen',enabled:boolean,setEnabled:(enabled:boolean)=>void){await target[kind](enabled);if(isCurrent())setEnabled(enabled);}
 return <section className="space-y-4" aria-label={ar?'المحاضرة المباشرة':'Live lecture'}>
 {error&&<p role="alert">{ar?'تعذر إتمام الطلب. تحقق من الاتصال والتسجيل وإعداد المزود. قد يتأخر فصل المشارك المحظور حتى إعادة المحاولة الخادمية.':'Request failed. Check connectivity, enrollment and provider setup. A blocked participant may await server disconnection retry.'}</p>}
 {!ready&&!error&&<p role="status">{connectionStatus==='reconnecting'?(ar?'جارٍ إعادة الاتصال والتحقق من صلاحية الدخول…':'Reconnecting and checking access…'):(ar?'جارٍ الاتصال…':'Connecting…')}</p>}
 {connectionStatus==='failed'&&<Button variant="outline" onClick={()=>retry.current()}>{ar?'إعادة الاتصال':'Retry connection'}</Button>}
 <div className="flex flex-wrap gap-2">
 <Button disabled={!ready||busy} onClick={()=>void action((target,isCurrent)=>device(target,isCurrent,'microphone',!mic,setMic))}>{mic?(ar?'كتم الميكروفون':'Mute microphone'):(ar?'تشغيل الميكروفون':'Enable microphone')}</Button>
 <Button disabled={!ready||busy} onClick={()=>void action((target,isCurrent)=>device(target,isCurrent,'camera',!camera,setCamera))}>{camera?(ar?'إيقاف الكاميرا':'Stop camera'):(ar?'تشغيل الكاميرا':'Enable camera')}</Button>
 <Button disabled={!ready||busy} onClick={()=>void action((target,isCurrent)=>device(target,isCurrent,'screen',!sharing,setSharing))}>{sharing?(ar?'إيقاف المشاركة':'Stop sharing'):(ar?'مشاركة الشاشة':'Share screen')}</Button>
 <Button variant="outline" disabled={!ready} onClick={()=>void action(target=>target.audio())}>{ar?'تفعيل صوت المحاضرة':'Enable lecture audio'}</Button>
 <Button variant="outline" onClick={onLeave}>{ar?'مغادرة':'Leave'}</Button></div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{participants.map(p=><article key={p.id} className="rounded-xl border border-border bg-card p-3 space-y-2"><h3>{p.name}{p.local&&(ar?' (أنت)':' (You)')}</h3>{p.tracks.map(t=><Media key={t.id} track={t} local={p.local}/>)}
 {moderator&&!p.local&&!p.moderator&&<Button variant="outline" disabled={busy} onClick={()=>{const reason=window.prompt(ar?'سبب إزالة المشارك ومنعه من العودة إلى هذه المحاضرة:':'Reason to remove and block this participant from this lecture:');if(reason)void action(()=>lectureAccess.remove(lecture,p.id,reason));}}>{ar?'إزالة المشارك':'Remove participant'}</Button>}</article>)}</div>
 <div className="border border-border rounded-xl p-4 space-y-2"><h2>{ar?'دردشة المحاضرة':'Lecture chat'}</h2><div role="log" aria-live="polite" className="max-h-64 overflow-y-auto space-y-2">{chat.map(c=><p key={c.id} className="break-words"><strong>{c.sender}: </strong>{c.message}</p>)}</div><form className="flex gap-2" onSubmit={e=>{e.preventDefault();const revision=messageRevision.current;void action(async(target,isCurrent)=>{await target.send(message);if(isCurrent()&&messageRevision.current===revision)setMessage('');});}}><input aria-label={ar?'الرسالة':'Message'} maxLength={1000} className="min-w-0 flex-1 border border-border rounded-md bg-background p-2" value={message} onChange={e=>{messageRevision.current++;setMessage(e.target.value);}}/><Button disabled={!ready||busy||!message.trim()}>{ar?'إرسال':'Send'}</Button></form><p className="text-xs text-muted-foreground">{ar?'الدردشة مؤقتة وغير مؤرشفة. مشاركة الشاشة تعتمد على دعم المتصفح.':'Chat is transient and not archived. Screen sharing depends on browser support.'}</p></div>
 </section>;
}
