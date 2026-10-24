import {useEffect,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useLanguage} from '@/i18n/LanguageContext';
import {Button} from '@workspace/y-hub-ds/components/ui/button';
import {academicLectures as repo,type AcademicLecture} from '@/shared/academic/lectures';
import {LectureRoom} from './LectureRoom';
export default function OnlineLecturesPage(){
 const {user,role}=useAuth();const {language}=useLanguage();const ar=language==='ar',manager=role==='instructor'||role==='admin'||role==='super_admin';
 const [sections,setSections]=useState<Awaited<ReturnType<typeof repo.sections>>>([]),[course,setCourse]=useState(''),[items,setItems]=useState<AcademicLecture[]>([]),[joined,setJoined]=useState('');
 const [title,setTitle]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[offset,setOffset]=useState(0),[version,setVersion]=useState(0),[error,setError]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{setJoined('');setCourse('');setSections([]);},[user?.id]);
 useEffect(()=>{let active=true;repo.sections().then(s=>{if(active)setSections(s);},()=>{if(active)setError(true);});return()=>{active=false;};},[user?.id,version]);
 useEffect(()=>{let active=true;setItems([]);if(!course)return;setLoading(true);repo.upcoming(course,offset).then(l=>{if(active){setItems(l);setLoading(false);}},()=>{if(active){setError(true);setLoading(false);}});return()=>{active=false;};},[course,offset,version,user?.id]);
 async function mutate(fn:()=>Promise<unknown>){if(busy)return;setBusy(true);setError(false);try{await fn();setVersion(v=>v+1);}catch{setError(true);}finally{setBusy(false);}}
 const field='w-full rounded-md border border-border bg-background p-2';
 return <section className="max-w-6xl mx-auto space-y-5" dir={ar?'rtl':'ltr'}><h1 className="text-2xl font-bold">{ar?'المحاضرات المباشرة':'Online lectures'}</h1>
 {error&&<p role="alert">{ar?'الطلب غير مؤكد. حدّث قبل تكرار التعديل.':'Request not confirmed. Refresh before repeating a change.'}</p>}
 {joined?<LectureRoom key={joined+user?.id} lecture={joined} ar={ar} onLeave={()=>setJoined('')}/>:<>
 <label>{ar?'الشعبة':'Section'}<select className={field} value={course} onChange={e=>{setCourse(e.target.value);setOffset(0);}}><option value="">—</option>{sections.map(s=><option key={s.id} value={s.id}>{s.title} {s.section_label}</option>)}</select></label>
 {manager&&course&&<form className="space-y-3 border border-border rounded-xl p-4" onSubmit={e=>{e.preventDefault();void mutate(()=>repo.scheduleOnline(course,title,new Date(start).toISOString(),new Date(end).toISOString()));}}><h2>{ar?'جدولة محاضرة':'Schedule lecture'}</h2><input aria-label={ar?'العنوان':'Title'} placeholder={ar?'عنوان المحاضرة':'Lecture title'} required maxLength={200} className={field} value={title} onChange={e=>setTitle(e.target.value)}/><label>{ar?'البداية':'Start'}<input type="datetime-local" required className={field} value={start} onChange={e=>setStart(e.target.value)}/></label><label>{ar?'النهاية':'End'}<input type="datetime-local" required className={field} value={end} onChange={e=>setEnd(e.target.value)}/></label><Button disabled={busy}>{ar?'جدولة':'Schedule'}</Button></form>}
 {loading&&<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>}
 {course&&!loading&&items.length===0&&<p>{ar?'لا توجد محاضرات قادمة متاحة.':'No accessible upcoming lectures.'}</p>}
 {items.map(l=><article key={l.id} className="rounded-xl bg-card border border-border p-4 flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{l.title}</h2><time dateTime={l.starts_at}>{new Date(l.starts_at).toLocaleString(language)}</time></div><div className="flex gap-2"><Button onClick={()=>setJoined(l.id)}>{ar?'انضمام':'Join'}</Button>{manager&&<Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(ar?'إلغاء المحاضرة؟':'Cancel lecture?'))void mutate(()=>repo.cancel(l.id));}}>{ar?'إلغاء المحاضرة':'Cancel lecture'}</Button>}</div></article>)}
 <p className="text-sm text-muted-foreground">{ar?'يُسمح بالانضمام قبل البداية بـ15 دقيقة وحتى نهاية المحاضرة. يتطلب الصوت والفيديو إعداد مزود الخدمة.':'Joining opens 15 minutes before the scheduled start and ends at lecture end. Audio/video requires a configured media provider.'}</p>
 <div className="flex gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(x=>Math.max(0,x-50))}>{ar?'السابق':'Previous'}</Button><Button variant="outline" disabled={items.length<50} onClick={()=>setOffset(x=>x+50)}>{ar?'التالي':'Next'}</Button><Button variant="outline" onClick={()=>{setError(false);setVersion(v=>v+1);}}>{ar?'تحديث':'Refresh'}</Button></div>
 </>}
 </section>;
}
