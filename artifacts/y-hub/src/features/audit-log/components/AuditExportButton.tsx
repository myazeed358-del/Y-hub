import { useEffect, useRef, useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { exportAuditPage, downloadAuditExport } from '../services/auditExportRepository';

export function AuditExportButton({ ids, disabled }: { ids: string[]; disabled: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [state, setState] = useState<'idle' | 'busy' | 'issued' | 'error'>('idle');
  const active = useRef<AbortController | null>(null);
  // Parent keys by identity and selected IDs; changing page/identity cancels late downloads.
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (disabled) { active.current?.abort(); active.current = null; setState('idle'); }
  }, [disabled]);
  const start = async () => {
    if (disabled || !ids.length || active.current) return;
    const controller = new AbortController(); active.current = controller; setState('busy');
    try {
      const data = await exportAuditPage(ids, controller.signal);
      if (controller.signal.aborted) return;
      downloadAuditExport(data); setState('issued');
    } catch { if (!controller.signal.aborted) setState('error'); }
    finally { if (active.current === controller) active.current = null; }
  };
  return <div className="space-y-2 text-sm">
    <Button variant="outline" disabled={disabled || !ids.length || state === 'busy'} onClick={() => void start()}>
      {ar ? 'تصدير الصفحة الحالية (JSON)' : 'Export current page (JSON)'}
    </Button>
    <p className="text-muted-foreground">{ar ? 'حتى 25 سجلًا. يُسجّل إصدار البيانات في سجل التدقيق.' : 'Up to 25 events. Data issuance is recorded in the audit log.'}</p>
    {state === 'busy' && <p role="status">{ar ? 'جارٍ إعداد التصدير…' : 'Preparing export…'}</p>}
    {state === 'issued' && <p role="status">{ar ? 'صدر التصدير وبدأ طلب التنزيل. تحقق من تنزيلات المتصفح.' : 'Export issued and download requested. Check your browser downloads.'}</p>}
    {state === 'error' && <p role="alert">{ar ? 'تعذر إكمال التصدير. ربما سُجل الإصدار؛ حدّث الصفحة وتحقق قبل المحاولة مجددًا.' : 'Export could not complete. Issuance may have been recorded; refresh and verify before retrying.'}</p>}
  </div>;
}
