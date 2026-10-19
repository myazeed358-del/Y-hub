import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSyllabus } from '../hooks/useSyllabus';
import { moveItem } from '../domain/syllabus';
import { syllabusCopy } from '../domain/copy';

/** One section ID, never a title/code. Shared by manager and enrolled student views. */
export function SyllabusPanel({ courseId, editable = false }: { courseId: string; editable?: boolean }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = syllabusCopy[language];
  const w = useSyllabus(courseId, user?.id);
  const units = w.snapshot?.units ?? [];
  const button = 'rounded border px-2 py-1 text-sm disabled:opacity-50';
  const changeUnit = (index: number, title: string) => w.update(units.map((u,i) => i === index ? { ...u, title } : u));
  const reorder = (index: number, delta: number) => w.update(moveItem(units,index,delta));
  return <section aria-label={t.title} dir={language === 'ar' ? 'rtl' : 'ltr'} className="my-6 rounded-xl border p-4 space-y-3">
    <h2 className="text-xl font-bold">{t.title}</h2>
    {w.error && <p role="alert">{t[w.error as 'conflict' | 'denied' | 'unavailable' | 'invalid']}</p>}
    {w.busy && <p role="status">{t.loading}</p>}
    {w.snapshot && <>
      {!units.length && <p>{t.empty}</p>}
      {units.map((u,i) => <div key={u.id} className="rounded border p-3 space-y-2">
        {editable ? <>
          <input aria-label={`${t.unit} ${i+1}`} className="w-full rounded border p-2 bg-background" maxLength={200} disabled={w.busy} value={u.title} onChange={e => changeUnit(i,e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={w.busy || i===0} onClick={() => reorder(i,-1)}>{t.up}</button>
            <button className={button} disabled={w.busy || i===units.length-1} onClick={() => reorder(i,1)}>{t.down}</button>
            <button className={button} disabled={w.busy} onClick={() => { if(window.confirm(t.confirmDelete)) w.update(units.filter(x=>x.id!==u.id)); }}>{t.remove}</button>
          </div>
        </> : <h3 className="font-semibold">{u.title}</h3>}
        <ol className="space-y-2 list-decimal ps-5">
          {u.sections.map((s,j) => <li key={s.id}>
            {editable ? <div className="flex flex-wrap gap-2">
              <input aria-label={`${t.unit} ${i+1} ${t.topic} ${j+1}`} className="min-w-0 flex-1 rounded border p-2 bg-background" disabled={w.busy} maxLength={200} value={s.title} onChange={e => w.update(units.map(x=>x.id===u.id ? {...x,sections:x.sections.map(y=>y.id===s.id?{...y,title:e.target.value}:y)}:x))} />
              <button className={button} disabled={w.busy || j===0} onClick={() => w.update(units.map(x=>x.id===u.id?{...x,sections:moveItem(x.sections,j,-1)}:x))}>{t.up}</button>
              <button className={button} disabled={w.busy || j===u.sections.length-1} onClick={() => w.update(units.map(x=>x.id===u.id?{...x,sections:moveItem(x.sections,j,1)}:x))}>{t.down}</button>
              <button className={button} disabled={w.busy} onClick={() => {if(window.confirm(t.confirmDelete)) w.update(units.map(x=>x.id===u.id?{...x,sections:x.sections.filter(y=>y.id!==s.id)}:x));}}>{t.remove}</button>
            </div> : s.title}
          </li>)}
        </ol>
        {editable && <button className={button} disabled={w.busy} onClick={() => w.update(units.map(x=>x.id===u.id?{...x,sections:[...x.sections,{id:crypto.randomUUID(),title:''}]}:x))}>{t.addTopic}</button>}
      </div>)}
      {editable && <div className="flex flex-wrap gap-2 items-center">
        <button className={button} disabled={w.busy || units.length>=100} onClick={() => w.update([...units,{id:crypto.randomUUID(),title:'',sections:[]}])}>{t.addUnit}</button>
        <button className={button} disabled={w.busy || !w.dirty} onClick={() => void w.save()}>{t.save}</button>
        <span role="status">{w.dirty?t.unsaved:t.saved}</span>
      </div>}
    </>}
    <button className={button} disabled={w.busy} onClick={() => {if(!w.dirty || window.confirm(t.confirmReload)) void w.reload();}}>{t.reload}</button>
  </section>;
}
