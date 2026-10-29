import { useEffect,useRef,useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChatMessageContent } from '../ai-chat/ChatMessageContent';
import { SourceEvidence } from '../knowledge/SourceEvidence';
import { parsePages,PracticeSourceError,sourcesRepository,type SourceCatalog,type SourcePreview,type PracticeSource } from './sourcesRepository';
import { sourcesCopy } from './sourcesCopy';

export function PracticeSourcesPanel({courseId}:{courseId:string}){
 const {user,role}=useAuth();const {language}=useLanguage();const [open,setOpen]=useState(false);
 if(!user||!role)return null;
 return <details className="mb-3 min-h-0 shrink-0 rounded-lg border p-3" onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary className="cursor-pointer font-semibold">{sourcesCopy[language].title}</summary>
  {open&&<SourceWorkspace key={`${user.id}:${role}:${courseId}`} courseId={courseId}/>}
 </details>;
}
function SourceWorkspace({courseId}:{courseId:string}){
 const {language}=useLanguage(),t=sourcesCopy[language];
 const [catalog,setCatalog]=useState<SourceCatalog|null>(null),[load,setLoad]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[pages,setPages]=useState<Record<string,string>>({}),[units,setUnits]=useState<string[]>([]),[query,setQuery]=useState(''),[preview,setPreview]=useState<SourcePreview|null>(null);
 const request=useRef<AbortController|null>(null),alive=useRef(true),pending=useRef(false);
 const invalidate=()=>{request.current?.abort();setPreview(null);setError('');};
 const report=(e:unknown)=>{
  const kind=e instanceof PracticeSourceError?e.kind:'unavailable';setError(kind==='conflict'?t.conflict:kind==='denied'?t.denied:t.error);
  if(kind==='denied'){setCatalog(null);setPreview(null);setSelected([]);}
 };
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setCatalog(null);setPreview(null);setError('');setSelected([]);setPages({});setUnits([]);
  sourcesRepository.read(courseId,controller.signal).then(data=>{if(!controller.signal.aborted)setCatalog(data);}).catch(e=>{if(!controller.signal.aborted)report(e);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 // Language changes do not discard source choices; messages update on the next operation.
 },[courseId,load]);
 const reload=()=>{invalidate();setLoad(n=>n+1);};
 async function showPreview(){
  if(!catalog||pending.current)return;
  invalidate();let picks;
  try{picks=selected.map(id=>{const s=catalog.sources.find(s=>s.id===id)!;return {sourceId:s.id,revision:s.revision,pages:parsePages(pages[id]??'',s.pages)};});}
  catch{setError(t.invalidPages);return;}
  const controller=new AbortController();request.current=controller;pending.current=true;setBusy(true);
  try{const result=await sourcesRepository.preview(courseId,picks,units,query,controller.signal);if(!controller.signal.aborted)setPreview(result);}
  catch(e){if(!controller.signal.aborted)report(e);}
  finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 async function classify(source:PracticeSource,role:'primary'|'reference'|'lecture'){
  if(!catalog||pending.current)return;invalidate();pending.current=true;setBusy(true);
  try{await sourcesRepository.classify(source,role,catalog.primaryId);if(alive.current)reload();}
  catch(e){if(alive.current)report(e);}
  finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 const button='rounded border px-3 py-2 text-sm disabled:opacity-50';
 return <section aria-label={t.title} dir={language==='ar'?'rtl':'ltr'} className="mt-3 max-h-[60dvh] overflow-auto space-y-3 min-w-0">
  <p className="text-sm text-muted-foreground">{t.note}</p>
  <button className={button} disabled={busy||loading} onClick={reload}>{t.reload}</button>
  {loading&&<p role="status">{t.loading}</p>}{error&&<p role="alert">{error}</p>}
  {catalog&&<>
   {!catalog.sources.length&&<p>{t.empty}</p>}{catalog.limited&&<p>{t.limited}</p>}
   <p>{t.selectionLimit}</p>
   <button className={button} disabled={busy||!catalog.sources.some(s=>s.id===catalog.primaryId&&s.status==='ready')} onClick={()=>{invalidate();setSelected([catalog.primaryId!]);setPages({});setUnits([]);}}>{t.choosePrimary}</button>
   {catalog.sources.map(s=><div key={s.id} className="rounded border p-3 space-y-2 break-words">
    <label className="flex gap-2"><input type="checkbox" disabled={busy||s.status!=='ready'||(!selected.includes(s.id)&&selected.length>=10)} checked={selected.includes(s.id)} onChange={e=>{invalidate();setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id));}}/><span>{s.title} — {t[s.role]} · {t[s.status]}</span></label>
    {selected.includes(s.id)&&s.kind==='pdf'&&<>
     <label className="block">{t.pages}: {s.title}<input aria-label={`${t.pages}: ${s.title}`} dir="ltr" maxLength={1500} className="mt-1 w-full rounded border bg-background p-2" disabled={busy} value={pages[s.id]??''} onChange={e=>{invalidate();setPages(old=>({...old,[s.id]:e.target.value}));}}/></label>
     <p className="text-xs text-muted-foreground">{t.pageHelp}</p><p className="text-xs">{t.available}: <bdi dir="ltr">{s.pages.join(', ')||'—'}</bdi></p>
    </>}
    {catalog.canManage&&s.kind==='pdf'&&<ReferenceEditor key={`${s.id}:${s.policyRevision}`} source={s} busy={busy} save={role=>classify(s,role)}/>}
   </div>)}
   {catalog.units.length>0&&<fieldset disabled={busy} className="space-y-2"><legend>{t.units}</legend><p className="text-xs">{t.unitHelp}</p>
    <label className="flex gap-2"><input type="checkbox" checked={!units.length} onChange={()=>{invalidate();setUnits([]);}}/>{t.allScope}</label>
    {catalog.units.map(u=><label key={u.id} className="flex gap-2"><input type="checkbox" checked={units.includes(u.id)} onChange={e=>{invalidate();setUnits(old=>e.target.checked?[...old,u.id]:old.filter(id=>id!==u.id));}}/>{u.title}</label>)}
   </fieldset>}
   <label className="block">{t.query}<input dir="auto" maxLength={1500} disabled={busy} className="mt-1 w-full rounded border bg-background p-2" value={query} onChange={e=>{invalidate();setQuery(e.target.value);}}/></label>
   <button className={button} disabled={busy||!selected.length} onClick={()=>void showPreview()}>{busy?t.loading:t.preview}</button>
  </>}
  {preview&&<section aria-label={t.previewTitle} className="space-y-3">
   {!preview.evidence.length&&<p>{t.noMatches}</p>}{preview.hasMore&&<p>{t.more}</p>}
   {preview.evidence.map(e=><article key={e.id} className="min-w-0 rounded border p-3"><h4 className="font-semibold">{e.title}{e.page!==null&&<> — {t.page} <bdi dir="ltr">{e.page}</bdi></>}</h4><ChatMessageContent content={e.text}/></article>)}
   <SourceEvidence sources={preview.evidence}/>
  </section>}
 </section>;
}
function ReferenceEditor({source,busy,save}:{source:PracticeSource;busy:boolean;save:(role:'primary'|'reference'|'lecture')=>Promise<void>}){
 const {language}=useLanguage(),t=sourcesCopy[language];const [role,setRole]=useState(source.role as 'primary'|'reference'|'lecture');
 return <div className="flex flex-wrap gap-2"><select aria-label={`${t.classify}: ${source.title}`} disabled={busy} value={role} className="max-w-full rounded border bg-background p-2" onChange={e=>setRole(e.target.value as typeof role)}><option value="primary">{t.primary}</option><option value="reference">{t.reference}</option><option value="lecture">{t.lecture}</option></select><button className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void save(role)}>{t.save}</button></div>;
}
