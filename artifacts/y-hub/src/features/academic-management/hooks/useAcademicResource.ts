import { useEffect, useRef, useState } from 'react';
export function useAcademicResource<T>(key: string, load: () => Promise<T>) {
  const loader = useRef(load); loader.current = load;
  const [state, setState] = useState<{ key: string; data?: T; error?: boolean }>({ key: '' });
  useEffect(() => {
    let active = true;
    setState({ key });
    loader.current().then(data => { if (active) setState({ key, data }); }, () => { if (active) setState({ key, error: true }); });
    return () => { active = false; };
  }, [key]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key && state.error,
    loading: state.key !== key || (state.data === undefined && !state.error) };
}
export function useAcademicMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run(operation: () => Promise<void>) {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(false);
    try { await operation(); return alive.current; }
    catch { if (alive.current) setError(true); return false; }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return { busy, error, run };
}
