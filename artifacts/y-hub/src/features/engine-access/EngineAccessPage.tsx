import { useEffect,useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ENGINE_CATALOG } from '@/config/majorEngineAccess';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { engineAccessRepository as repo,type Grant } from './repository';
export default function EngineAccessPage(){
 const {user,role}=useAuth();const {language}=useLanguage();const ar=language==='ar';
 const [sections,setSections]=useState<Awaited<ReturnType<typeof repo.sections>>>([]),[course,setCourse]=useState('');
 const [engines,setEngines]=useState<string[]>([]),[roster,setRoster]=useState<Awaited<ReturnType<typeof repo.roster>>>([]),[grants,setGrants]=useState<Grant[]>([]);
 const [student,setStudent]=useState(''),[engine,setEngine]=useState(''),[expires,setExpires]=useState('');
 const [directoryVersion,reloadDirectory]=useState(0),[directoryLoading,setDirectoryLoading]=useState(true),[directoryError,setDirectoryError]=useState(false),[offset,setOffset]=useState(0);
 const [version,refresh]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{setCourse('');setOffset(0);setSections([]);setEngines([]);setEngine('');setExpires('');},[user?.id]);
 useEffect(()=>{let active=true;setDirectoryError(false);setDirectoryLoading(true);
  Promise.all([repo.sections(),repo.engines()]).then(([s,e])=>{if(active){setSections(s);setEngines(e);setDirectoryLoading(false);}},()=>{if(active){setDirectoryError(true);setDirectoryLoading(false);}});return()=>{active=false;};
 },[user?.id,directoryVersion]);
 useEffect(()=>{let active=true;setStudent('');setRoster([]);setGrants([]);if(!course){setLoading(false);return;}setLoading(true);setError(false);
  Promise.all([repo.roster(course),repo.grants(course,offset)]).then(([r,g])=>{if(active){setRoster(r);setGrants(g);setLoading(false);}},()=>{if(active){setError(true);setLoading(false);}});return()=>{active=false;};
 },[course,user?.id,version,offset]);
 const title=(id:string)=>ENGINE_CATALOG.find(e=>e.id===id)?.title[language]??id;
 async function mutate(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError(false);try{await action();refresh(v=>v+1);}catch{setError(true);}finally{setBusy(false);}}
 const selectClass='rounded-lg border border-border bg-background p-2 w-full';
 return <section className="max-w-4xl mx-auto space-y-5" dir={ar?'rtl':'ltr'}>
  <h1 className="text-2xl font-bold">{ar?'صلاحيات المحركات الاستثنائية':'Exceptional engine permissions'}</h1>
  <p className="text-muted-foreground">{ar?'تنتهي المنحة بانتهاء مدتها أو التسجيل أو إسناد الشعبة. منح المحركات يقتصر على تخصص الدكتور.':'Grants end on expiry, withdrawal or section reassignment. Instructors delegate engines in their teaching major.'}</p>
  {(error||directoryError)&&<p role="alert">{ar?'تعذر إتمام الطلب. لم نفترض نجاح التعديل؛ أعد تحميل القائمة قبل المحاولة.':'Request failed. Changes are not assumed successful; reload before retrying.'}</p>}
  <label>{ar?'الشعبة':'Section'}<select aria-label="Section" className={selectClass} value={course} disabled={busy} onChange={e=>{setCourse(e.target.value);setOffset(0);}}><option value="">—</option>{sections.map(s=><option key={s.id} value={s.id}>{s.title} {s.section_label}</option>)}</select></label>
  {(loading||directoryLoading)&&<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>}
  {course&&role==='instructor'&&<form className="rounded-xl border border-border bg-card p-4 space-y-3" onSubmit={e=>{e.preventDefault();void mutate(()=>repo.grant(course,student,engine,new Date(expires).toISOString()));}}>
   <label>{ar?'الطالب':'Student'}<select aria-label="Student" required value={student} className={selectClass} onChange={e=>setStudent(e.target.value)}><option value="">—</option>{roster.map(r=><option key={r.student_id} value={r.student_id}>{r.full_name}</option>)}</select></label>
   <label>{ar?'المحرك':'Engine'}<select aria-label="Engine" required value={engine} className={selectClass} onChange={e=>setEngine(e.target.value)}><option value="">—</option>{engines.map(id=><option key={id} value={id}>{title(id)}</option>)}</select></label>
   <label>{ar?'انتهاء الصلاحية':'Expires'}<input aria-label="Expires" required type="datetime-local" value={expires} className={selectClass} onChange={e=>setExpires(e.target.value)}/></label>
   <Button disabled={busy||loading||directoryLoading||directoryError||!student||!engine||!expires}>{ar?'منح الصلاحية':'Grant access'}</Button>
  </form>}
  {course&&!loading&&<div className="space-y-3">{grants.length===0&&<p>{ar?'لا توجد منح لهذه الشعبة.':'No grants for this section.'}</p>}{grants.map(g=><article key={g.id} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4 rounded-xl">
   <div><strong>{roster.find(r=>r.student_id===g.student_id)?.full_name??g.student_id}</strong><p>{title(g.engine_id)}</p><time dateTime={g.expires_at}>{new Date(g.expires_at).toLocaleString(language)}</time><p>{g.revoked_at?(ar?'ملغاة':'Revoked'):Date.parse(g.expires_at)<=Date.now()?(ar?'منتهية':'Expired'):(ar?'فعالة بحسب علاقة الشعبة':'Subject to current section access')}</p></div>
   {!g.revoked_at&&<Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(ar?'إلغاء المنحة؟':'Revoke this grant?'))void mutate(()=>repo.revoke(g.id));}}>{ar?'إلغاء':'Revoke'}</Button>}
  </article>)}</div>}
  {course&&<nav aria-label={ar?'صفحات المنح':'Grant pages'} className="flex gap-2"><Button variant="outline" disabled={busy||loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-100))}>{ar?'المنح السابقة':'Previous grants'}</Button><Button variant="outline" disabled={busy||loading||grants.length<100} onClick={()=>setOffset(n=>n+100)}>{ar?'المنح التالية':'Next grants'}</Button></nav>}
  <Button variant="outline" disabled={busy||loading||directoryLoading} onClick={()=>{reloadDirectory(v=>v+1);refresh(v=>v+1);}}>{ar?'تحديث':'Refresh'}</Button>
 </section>;
}
