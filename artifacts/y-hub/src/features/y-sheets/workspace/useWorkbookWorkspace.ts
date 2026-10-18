import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseWorkbookStorage } from '../integration/supabaseWorkbookStorage';
import { WorkbookSession } from '../integration/workbookSession';
import type { SaveStatus } from '../integration/saveCoordinator';
import { RecoveryJournal, type RecoveryEntry, type PendingCellEdit } from '../io/recoveryJournal';
import type { WorkbookData } from '../types/workbook';

// Delay access: unavailable localStorage must produce an actionable error, not a render crash.
const browserStorage: Storage = {
  get length() { return window.localStorage.length; },
  key: i => window.localStorage.key(i), getItem: k => window.localStorage.getItem(k),
  setItem: (k,v) => window.localStorage.setItem(k,v), removeItem: k => window.localStorage.removeItem(k),
  clear: () => { throw Error('Recovery storage cannot be cleared wholesale.'); },
};
export function useWorkbookWorkspace(ownerId: string) {
  const journal = useMemo(() => new RecoveryJournal(ownerId,browserStorage),[ownerId]);
  const storage = useMemo(() => createSupabaseWorkbookStorage(ownerId,(id,cp) => journal.checkpoint(id,cp)),[ownerId,journal]);
  const [files,setFiles] = useState<Array<{id:string;name:string;updatedAt:string;revision?:number}>>([]);
  const [recoveries,setRecoveries] = useState<RecoveryEntry[]>([]);
  const [corrupt,setCorrupt] = useState(0);
  const [active,setActive] = useState<WorkbookData | null>(null);
  const [status,setStatus] = useState<SaveStatus>('saved');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const session = useRef<WorkbookSession | null>(null);
  const alive = useRef(true);
  const operation = useRef(false);
  const report = useCallback((err: unknown) => { if (alive.current) setError(err instanceof Error ? err.message : String(err)); },[]);
  const refreshLocal = useCallback(() => {
    const result = journal.list(); setRecoveries(result.entries); setCorrupt(result.corruptKeys.length);
  },[journal]);
  const refresh = useCallback(async () => {
    refreshLocal();
    const result = await storage.listWorkbooks!();
    if (alive.current) setFiles(result);
  },[refreshLocal,storage]);
  useEffect(() => {
    alive.current = true;
    void refresh().catch(report);
    const unload = (event: BeforeUnloadEvent) => {
      if (session.current?.dirty) { event.preventDefault(); event.returnValue=''; }
    };
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]') || !session.current?.dirty) return;
      try { session.current.keepRecovery(); } catch (e) { event.preventDefault(); event.stopPropagation(); report(e); }
    };
    document.addEventListener('click',navigate,true);
    const changed = () => { try { refreshLocal(); } catch (e) { report(e); } };
    window.addEventListener('beforeunload',unload);
    window.addEventListener('storage',changed);
    return () => {
      document.removeEventListener('click',navigate,true);
      alive.current = false; session.current?.dispose();
      window.removeEventListener('beforeunload',unload); window.removeEventListener('storage',changed);
    };
  },[refresh,refreshLocal,report]);
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { report(e); }
    finally {
      operation.current = false;
      if (alive.current) { setBusy(false); try { refreshLocal(); } catch (e) { report(e); } }
    }
  };
  const activate = (wb: WorkbookData, recovery?: RecoveryEntry) => {
    if (!alive.current) return;
    session.current?.dispose();
    const next = new WorkbookSession(wb,storage,journal,setStatus,recovery);
    session.current = next; setActive(wb); setStatus(recovery ? 'unsaved' : 'saved');
    if (recovery) next.change(wb);
  };
  const leave = async () => { if (session.current?.dirty) await session.current.flush(); };
  const open = (id: string) => run(async () => {
    await leave();
    const wb = await storage.loadWorkbook(id);
    activate(wb); // Never substitute a default workbook after a failed load.
  });
  const restore = (entry: RecoveryEntry) => run(async () => {
    await leave();
    const {workbook,checkpoint,draft} = entry.record;
    storage.restoreCheckpoint!(workbook.id,checkpoint);
    const wb = structuredClone(workbook);
    if (draft) {
      const sheet = wb.sheets.find(s => s.id === draft.sheetId)!;
      const key = `${draft.row},${draft.col}`;
      sheet.cells[key] = {...sheet.cells[key],raw:draft.raw,computed:null};
    }
    activate(wb,entry);
  });
  const myFiles = () => run(async () => {
    await leave(); session.current?.dispose(); session.current=null; setActive(null); await refresh();
  });
  const keepAndLeave = () => run(async () => {
    session.current?.keepRecovery(); session.current?.dispose(); session.current=null; setActive(null); await refresh();
  });
  const change = useCallback(async (wb: WorkbookData) => {
    try { session.current?.change(wb); } catch (e) { setStatus('error'); report(e); }
  },[report]);
  const draft = useCallback((edit: PendingCellEdit | null) => {
    try { session.current?.editDraft(edit); } catch (e) { setStatus('error'); report(e); }
  },[report]);
  return {storage,journal,files,recoveries,corrupt,active,status,error,busy,session,run,activate,leave,refresh,
    open,restore,myFiles,keepAndLeave,change,draft,report, retry: () => run(async () => { await session.current?.flush(); })};
}
