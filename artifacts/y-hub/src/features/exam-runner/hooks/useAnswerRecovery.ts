import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { useNavigationGuard } from '@/shared/navigation/guardedLocation';
import { readAnswerDrafts, saveAnswerDraft, clearAnswerDrafts, type AnswerDraft, type DraftScope } from '../storage/answerRecovery';
import type { ExamAnswers } from '../types';

export function useAnswerRecovery(owner: string | undefined, exam: string) {
  const [answers, setState] = useState<ExamAnswers>({});
  const [recoveryMessage, setMessage] = useState<string | null>(null);
  const [recoveryChoices, setChoices] = useState<AnswerDraft[]>([]);
  const current = useRef<ExamAnswers>({});
  const scope = useRef<DraftScope | null>(null);
  const writer = useRef('');
  const failed = useRef(false);
  const identity = useRef({ owner, exam });
  identity.current = { owner, exam };
  const resetRecovery = useCallback(() => {
    current.current = {}; scope.current = null; writer.current = crypto.randomUUID(); failed.current = false;
    setState({}); setChoices([]); setMessage(null);
  }, []);
  const recover = useCallback((attempt: string) => {
    if (!identity.current.owner) return;
    scope.current = { owner: identity.current.owner, exam: identity.current.exam, attempt };
    try {
      const drafts = readAnswerDrafts(localStorage, scope.current);
      setChoices(drafts);
      if (drafts.length) {
        current.current = drafts[0].answers; setState(drafts[0].answers);
        setMessage(drafts.length > 1
          ? 'توجد نسخ محلية متعددة؛ راجع النسخة المستعادة قبل التسليم. Multiple local drafts: review before submitting.'
          : 'استُعيدت إجاباتك المحلية؛ موعد الخادم لم يتغير. Local answers restored; server deadline unchanged.');
      }
    } catch {
      failed.current = true;
      setMessage('تعذرت قراءة الاستعادة؛ لم نحذف النسخ المخزنة. Recovery could not be read; stored copies were preserved.');
    }
  }, []);
  const setAnswers = useCallback((update: SetStateAction<ExamAnswers>) => {
    const target = scope.current;
    if (!target || target.owner !== identity.current.owner || target.exam !== identity.current.exam) return;
    const next = typeof update === 'function' ? update(current.current) : update;
    // Synchronous persistence before React rendering, including an immediate refresh.
    current.current = next; setState(next);
    try {
      saveAnswerDraft(localStorage, target, writer.current, next);
      failed.current = false;
    } catch {
      failed.current = true;
      setMessage('تعذر حفظ الاستعادة على هذا الجهاز. أبقِ الصفحة مفتوحة وانسخ إجاباتك. Local recovery failed; keep this page open and copy your answers.');
    }
  }, []);
  const confirmed = useCallback((attempt: string | null) => {
    if (attempt && identity.current.owner) {
      try { clearAnswerDrafts(localStorage, { owner: identity.current.owner, exam: identity.current.exam, attempt }); }
      catch { setMessage('تعذر تنظيف النسخة المحلية بعد التسليم. Local cleanup failed after confirmed submission.'); }
    }
    failed.current = false; scope.current = null; setChoices([]);
  }, []);
  useNavigationGuard(() => !failed.current || window.confirm('قد تفقد إجابات لم تُحفظ محليًا. مغادرة؟ Unsaved answers may be lost. Leave?'));
  return { answers, setAnswers, recoveryMessage, recoveryChoices, resetRecovery, recover, confirmed,
    recoveryFailed: () => failed.current };
}
