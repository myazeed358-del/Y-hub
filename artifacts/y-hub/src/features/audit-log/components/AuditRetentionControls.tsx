import { useEffect, useRef, useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { useLanguage } from '@/i18n/LanguageContext';
import { getRetentionPolicy, saveRetentionPolicy, getInvestigationHold, saveInvestigationHold, type RetentionPolicy, type InvestigationHold } from '../services/auditRetentionRepository';

// The page/dialog keys remount these controls on identity/event changes. Abort on
// unmount prevents a late response from populating another owner's/event's view.
export function AuditRetentionControls({ eventId }: { eventId?: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [hold, setHold] = useState<InvestigationHold | null>(null);
  const [months, setMonths] = useState('24');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(false); setSaved(false); setPolicy(null); setHold(null); setConfirmed(false);
    const read = async () => {
      try {
        if (eventId) { const result = await getInvestigationHold(eventId, abort.signal); if (!abort.signal.aborted) setHold(result); }
        else { const result = await getRetentionPolicy(abort.signal); if (!abort.signal.aborted) { setPolicy(result); setMonths(String(result.months)); } }
      } catch { if (!abort.signal.aborted) setError(true); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    };
    void read();
    return () => abort.abort();
  }, [eventId, reload]);
  const reducing = policy !== null && Number(months) < policy.months;
  const valid = /^\d+$/.test(months) && Number(months) >= 12 && Number(months) <= 60;
  const change = async () => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || locked.current || busy || error) return;
    locked.current = true; setBusy(true); setSaved(false);
    try {
      if (eventId && hold) {
        const result = await saveInvestigationHold(eventId, !hold.active, hold.revision, signal);
        if (!signal.aborted) setHold(result);
      } else if (policy && valid && (!reducing || confirmed)) {
        const result = await saveRetentionPolicy(Number(months), policy.revision, signal);
        if (!signal.aborted) { setPolicy(result); setConfirmed(false); }
      } else return;
      if (!signal.aborted) setSaved(true);
    } catch { if (!signal.aborted) setError(true); }
    finally { locked.current = false; if (!signal.aborted) setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border p-4" aria-busy={busy}>
    <h2 className="font-semibold">{eventId ? (ar ? 'حماية التحقيق' : 'Investigation hold') : (ar ? 'مدة الاحتفاظ بسجل التدقيق' : 'Audit retention period')}</h2>
    {!eventId && <p className="text-sm text-muted-foreground">{ar ? 'الافتراضي 24 شهرًا، والنطاق 12–60 شهرًا وفق الالتزامات القانونية. الحذف الدوري لم يُفعّل بعد.' : 'Default: 24 months; range: 12–60 months, subject to legal obligations. Scheduled deletion is not enabled yet.'}</p>}
    {error ? <div role="alert"><p>{ar ? 'تعذر الحفظ أو القراءة. أعد التحميل للتحقق من الحالة الحالية.' : 'Unable to save or read. Reload to verify the current state.'}</p><Button variant="outline" onClick={() => setReload(n => n + 1)}>{ar ? 'إعادة التحميل' : 'Reload'}</Button></div>
      : busy ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : null}
    {policy && !error && <label className="block text-sm">{ar ? 'المدة بالأشهر' : 'Period in months'}<Input type="number" min={12} max={60} step={1} value={months} disabled={busy} onChange={e => { setMonths(e.target.value); setConfirmed(false); setSaved(false); }} /></label>}
    {reducing && !error && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{ar ? 'راجعت الالتزامات القانونية وأوافق على تقصير مدة الاحتفاظ.' : 'I reviewed legal obligations and confirm the shorter retention period.'}</label>}
    {hold && !error && <p>{hold.active ? (ar ? 'السجل محمي لتحقيق جارٍ.' : 'This event is held for an ongoing investigation.') : (ar ? 'لا توجد حماية تحقيق نشطة لهذا السجل.' : 'This event has no active investigation hold.')}</p>}
    {(policy || hold) && !error && <Button type="button" disabled={busy || (policy !== null && (!valid || Number(months) === policy.months || (reducing && !confirmed)))} onClick={() => void change()}>{eventId ? (hold?.active ? (ar ? 'إنهاء حماية التحقيق' : 'Release investigation hold') : (ar ? 'حماية للتحقيق' : 'Hold for investigation')) : (ar ? 'حفظ المدة' : 'Save period')}</Button>}
    {saved && !error && <p role="status">{ar ? 'تم الحفظ وتسجيل التغيير في سجل التدقيق.' : 'Saved and recorded in the audit log.'}</p>}
  </section>;
}
