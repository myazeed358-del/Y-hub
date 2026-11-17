import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { sharingRepository as repo, type InheritedShare } from './repository';
/** Informational only: inherited grants can only be changed at their source folder. */
export function InheritedShares({ actor, id }: { actor: string; id: string }) {
  const { language } = useLanguage(), ar = language === 'ar';
  const [rows, setRows] = useState<InheritedShare[]>([]);
  const [more, setMore] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  async function load(append = false) {
    const current = ++sequence.current;
    setBusy(true); setFailed(false);
    if (!append) setRows([]);
    try {
      const result = await repo.inherited(actor, id, append ? rows.length : 0);
      if (current === sequence.current) {
        setRows(old => append ? [...old, ...result.slice(0, 50)] : result.slice(0, 50));
        setMore(result.length > 50);
      }
    } catch {
      if (current === sequence.current) { setRows([]); setMore(false); setFailed(true); }
    } finally { if (current === sequence.current) setBusy(false); }
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    return () => { sequence.current++; window.removeEventListener('focus', refresh); };
  }, [actor, id]);
  return <section aria-label={ar ? 'الوصول الموروث' : 'Inherited access'}>
    <h4>{ar ? 'الوصول الموروث من المجلدات' : 'Access inherited from folders'}</h4>
    <p>{ar ? 'عدّل المنحة من المجلد المصدر. قد يستمر الوصول عبر منحة أخرى.' : 'Change a grant at its source folder. Another grant may still provide access.'}</p>
    {failed && <p role="alert">{ar ? 'تعذر تحديث الوصول الموروث.' : 'Unable to refresh inherited access.'}</p>}
    {!busy && !failed && rows.length === 0 && <p>{ar ? 'لا توجد منح موروثة.' : 'No inherited grants.'}</p>}
    <ul>{rows.map(row => <li key={`${row.id}:${row.folderId}`}><bdi>{row.name}</bdi> · <bdi>{row.number}</bdi> · <bdi>{row.folderName}</bdi> · {row.permission === 'edit' ? (ar ? 'تحرير' : 'Edit') : (ar ? 'مشاهدة' : 'View')}</li>)}</ul>
    <button disabled={busy} onClick={() => void load()}>{ar ? 'تحديث الوصول الموروث' : 'Refresh inherited access'}</button>
    {more && <button disabled={busy} onClick={() => void load(true)}>{ar ? 'المزيد من المنح الموروثة' : 'More inherited grants'}</button>}
  </section>;
}
