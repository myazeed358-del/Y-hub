import { useEffect,useRef,useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { completionRepository,CompletionError,type LessonProgress,type CompletionTopic } from '../services/completionRepository';
import { completionCopy } from '../domain/completionCopy';

export function LessonProgressPanel({courseId}:{courseId:string}){
 const {user,role}=useAuth();if(!user||!role)return null;
 return <Progress key={`${user.id}:${role}:${courseId}`} courseId={courseId}/>;
}
function Progress({courseId}:{courseId:string}){
 const {language}=useLanguage(),t=completionCopy[language];
 const [data,setData]=useState<LessonProgress|null>(null),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),pending=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setData(null);setError('');
  completionRepository.read(courseId,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(()=>{if(!controller.signal.aborted)setError(t.error);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[courseId,revision,t.error]);
 const mutate=async(action:()=>Promise<number>)=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await action();if(mounted.current)setRevision(value=>value+1);}
  catch(e){if(mounted.current)setError(e instanceof CompletionError&&e.kind==='conflict'?t.conflict:t.error);}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const button='rounded border px-2 py-1 text-sm disabled:opacity-50';
 return <section aria-label={t.title} className="space-y-3 rounded-xl border p-4" dir={language==='ar'?'rtl':'ltr'}>
  <h3 className="font-bold">{t.title}</h3><p className="text-sm text-muted-foreground">{t.note}</p>
  {loading&&<p role="status">{t.loading}</p>}{error&&<p role="alert">{error}</p>}
  <button className={button} disabled={loading||busy} onClick={()=>setRevision(value=>value+1)}>{t.reload}</button>
  {data&&<>
   {data.student&&<p role="status">{t.done}: <bdi dir="ltr">{data.topics.filter(x=>x.completed).length} / {data.topics.length}</bdi></p>}
   {!data.topics.length&&<p>{t.empty}</p>}
   {data.examChoicesLimited&&data.canManage&&<p>{t.limited}</p>}
   {data.topics.map(topic=><div key={topic.id} className="space-y-2 rounded border p-3">
    <h4 className="font-semibold">{topic.title}</h4>
    {data.student&&<>
     <p>{topic.completed?t.done:t.notDone} · {t.verified}: <bdi dir="ltr">{topic.fulfilled}/{topic.examIds.length}</bdi></p>
     <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy||loading} onClick={()=>void mutate(()=>completionRepository.mark(topic,topic.completed?'incomplete':'completed'))}>{topic.completed?t.undo:t.mark}</button>
      <button className={button} disabled={busy||loading||topic.manual===null} onClick={()=>void mutate(()=>completionRepository.mark(topic,'automatic'))}>{t.automatic}</button>
     </div>
    </>}
    {data.canManage&&<RuleEditor key={`${topic.id}:${topic.ruleRevision}`} topic={topic} exams={data.exams} busy={busy||loading} save={(mode,ids)=>mutate(()=>completionRepository.rule(topic,mode,ids))}/>}
   </div>)}
  </>}
 </section>;
}
function RuleEditor({topic,exams,busy,save}:{topic:CompletionTopic;exams:LessonProgress['exams'];busy:boolean;save:(mode:CompletionTopic['mode'],ids:string[])=>Promise<void>}){
 const {language}=useLanguage(),t=completionCopy[language];
 const [mode,setMode]=useState(topic.mode),[ids,setIds]=useState(topic.examIds);
 return <fieldset disabled={busy} className="space-y-2"><legend>{t.rules}</legend>
  <select aria-label={`${t.rules}: ${topic.title}`} className="w-full rounded border bg-background p-2" value={mode} onChange={e=>setMode(e.target.value as CompletionTopic['mode'])}>
   <option value="manual">{t.manual}</option><option value="all">{t.all}</option><option value="any">{t.any}</option>
  </select>
  {mode!=='manual'&&<div className="max-h-56 overflow-auto space-y-2"><p>{t.exams}</p>{!exams.length&&<p>{t.noExams}</p>}
   {exams.map(exam=><label key={exam.id} className="flex gap-2"><input type="checkbox" checked={ids.includes(exam.id)} onChange={e=>setIds(old=>e.target.checked?[...old,exam.id]:old.filter(id=>id!==exam.id))}/><span>{exam.title}</span></label>)}
   {ids.filter(id=>!exams.some(exam=>exam.id===id)).map(id=><label key={id} className="flex gap-2"><input type="checkbox" checked onChange={()=>setIds(old=>old.filter(value=>value!==id))}/><span>{t.unavailableActivity}</span></label>)}
  </div>}
  <button className="rounded border px-2 py-1 text-sm disabled:opacity-50" disabled={busy||(mode!=='manual'&&(!ids.length||ids.length>20))} onClick={()=>void save(mode,ids)}>{t.save}</button>
 </fieldset>;
}
