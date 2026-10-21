import { useCallback, useEffect, useRef, useState } from 'react';
import { syllabusRepository, SyllabusError } from '../services/syllabusRepository';
import type { SyllabusSnapshot, SyllabusUnit } from '../domain/syllabus';
export function useSyllabus(courseId: string, actorId: string | undefined) {
  const [snapshot, setSnapshot] = useState<SyllabusSnapshot | null>(null);
  const [loadedFor, setLoadedFor] = useState('');
  const scope = `${actorId ?? ''}:${courseId}`;
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(false);
  const report = (e: unknown) => e instanceof SyllabusError ? e.kind : 'unavailable';
  const reload = useCallback(async () => {
    const current = ++generation.current;
    pending.current = true; setBusy(true); setError('');
    try {
      const value = await syllabusRepository.read(courseId);
      if (current === generation.current) { setSnapshot(value); setLoadedFor(scope); setDirty(false); }
    } catch (e) { if (current === generation.current) setError(report(e)); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  }, [courseId, actorId, scope]);
  useEffect(() => {
    setSnapshot(null); setDirty(false);
    void reload();
    return () => { generation.current++; };
  }, [reload]);
  const update = (units: SyllabusUnit[]) => {
    if (!snapshot || pending.current) return;
    setSnapshot({ ...snapshot, units }); setDirty(true);
  };
  const save = async () => {
    if (!snapshot || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const current = generation.current;
    try {
      const value = await syllabusRepository.save(snapshot);
      if (current === generation.current) { setSnapshot(value); setLoadedFor(scope); setDirty(false); }
    } catch (e) { if (current === generation.current) setError(report(e)); }
    finally { if (current === generation.current) { pending.current = false; setBusy(false); } }
  };
  return { snapshot: snapshot?.courseId === courseId && loadedFor === scope ? snapshot : null, dirty, busy, error, update, reload, save };
}
