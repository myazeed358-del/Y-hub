import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { listLearningSections, type LearningRole, type LearningSection } from '../services/learningPathRepository';
import { learningPathCopy } from '../domain/learningPathCopy';
import { SyllabusPanel } from './SyllabusPanel';

export function LearningPathPanel() {
  const { user, role } = useAuth();
  if (!user || !role) return null;
  return <LearningPath key={`${user.id}:${role}`} actorId={user.id} role={role} />;
}

function LearningPath({ actorId, role }: { actorId: string; role: LearningRole }) {
  const { language } = useLanguage();
  const t = learningPathCopy[language];
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ sections: LearningSection[]; hasNext: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState('');
  const refresh = () => { setData(null); setError(false); setRevision(value => value + 1); };
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    listLearningSections(actorId, role, page, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setData(result);
        setSelected(id => result.sections.some(section => section.id === id) ? id : '');
      }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [actorId, role, page, revision]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const section = data?.sections.find(item => item.id === selected);
  const button = 'rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
  return <section id="learning-path" aria-label={t.title} dir={language === 'ar' ? 'rtl' : 'ltr'} className="rounded-3xl border bg-card p-6 space-y-4 scroll-mt-24">
    <h2 className="text-2xl font-bold">{t.title}</h2><p className="text-muted-foreground">{t.description}</p>
    <button className={button} onClick={refresh}>{t.reload}</button>
    {error ? <p role="alert">{t.error}</p> : !data ? <p role="status">{t.loading}</p> : <>
      {!data.sections.length ? <p>{t.empty}</p> : <div className="space-y-2"><label htmlFor="learning-section" className="block">{t.choose}</label>
        <select id="learning-section" className="w-full min-w-0 rounded-xl border bg-background p-3" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">{t.placeholder}</option>
          {data.sections.map(item => <option key={item.id} value={item.id}>{[item.title, item.section_label, item.academic_term].filter(Boolean).join(' · ')}</option>)}
        </select>
      </div>}
      <div className="flex flex-wrap justify-between gap-2">
        <button className={button} disabled={page === 0} onClick={() => { setData(null); setSelected(''); setPage(value => value - 1); }}>{t.previous}</button>
        <button className={button} disabled={!data.hasNext} onClick={() => { setData(null); setSelected(''); setPage(value => value + 1); }}>{t.next}</button>
      </div>
      {section && <div key={`${section.id}:${revision}`}>
        <h3 className="font-semibold break-words">{[section.title, section.section_label, section.academic_term].filter(Boolean).join(' · ')}</h3>
        <SyllabusPanel courseId={section.id} />
        <Link className="text-primary underline" href={role === 'student' ? `/course/${section.id}/view` : `/course/${section.id}`}>{t.course}</Link>
      </div>}
    </>}
    <p className="text-sm text-muted-foreground">{t.separation}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border p-4"><h3 className="font-semibold">{t.completion}</h3><p className="text-sm text-muted-foreground">{t.completionNote}</p></div>
      <div className="rounded-xl border p-4"><h3 className="font-semibold">{t.performance}</h3><p className="text-sm text-muted-foreground">{t.performanceNote}</p></div>
    </div>
  </section>;
}
