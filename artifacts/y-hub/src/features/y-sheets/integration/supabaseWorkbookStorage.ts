import { supabase } from '@/utils/supabaseClient';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import type { WorkbookData } from '../types/workbook';
import type { HostStorageAdapter, SaveCheckpoint } from './hostContract';
import { WorkbookStorageError } from './storageErrors';

export function createSupabaseWorkbookStorage(ownerId: string,
  onCheckpoint: (id: string, checkpoint: SaveCheckpoint) => void = () => {},
): HostStorageAdapter {
  const checkpoints = new Map<string, SaveCheckpoint>();
  const pending = new Map<string, Promise<void>>();
  const setCheckpoint = (id: string, checkpoint: SaveCheckpoint) => {
    // Journal before sending, and after acknowledgment. Failure must not silently lose intent.
    onCheckpoint(id, checkpoint);
    checkpoints.set(id, structuredClone(checkpoint));
  };
  const requireSession = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== ownerId) throw new WorkbookStorageError('session', 'Y-Sheets session is no longer authorized.');
  };
  const loadWorkbook = async (id: string): Promise<WorkbookData> => {
    await requireSession();
    const { data, error } = await supabase.from('y_sheets_workbooks')
      .select('id, name, content, revision').eq('owner_id', ownerId).eq('id', id).single();
    if (error || !data) throw new Error('Workbook not found or access denied.');
    // Loading must never acknowledge or replace an outstanding save intent.
    if (checkpoints.get(id)?.intent) throw new WorkbookStorageError('conflict', 'Workbook has an unresolved save.');
    setCheckpoint(id, { revision: data.revision });
    return { ...data.content, id: data.id, name: data.name } as WorkbookData;
  };
  const send = async (id: string, checkpoint: SaveCheckpoint) => {
    await requireSession();
    const intent = checkpoint.intent!;
    const { data, error } = await supabase.rpc('save_y_sheets_workbook', {
      p_id: id, p_request_id: intent.requestId, p_expected_revision: checkpoint.revision, p_content: intent.workbook,
    });
    if (error) {
      const kind = error.code === '40001' || error.code === 'P0002' ? 'conflict'
        : error.code === '42501' ? 'session' : error.code === '22023' ? 'invalid' : 'network';
      throw new WorkbookStorageError(kind, kind === 'conflict' ? 'Workbook conflict: preserve your copy before reconciliation.' : 'Unable to save workbook. Your edits are retained.');
    }
    if (!Number.isSafeInteger(data) || data <= 0) throw new Error('Invalid save acknowledgment.');
    setCheckpoint(id, { revision: data });
  };
  const saveWorkbook = async (workbook: WorkbookData) => {
    const snapshot = structuredClone(workbook);
    const previous = pending.get(snapshot.id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      let checkpoint = checkpoints.get(snapshot.id);
      if (!checkpoint) throw new Error('Load or create the workbook before saving.');
      if (checkpoint.intent) {
        const prior = checkpoint.intent.workbook;
        await send(snapshot.id, checkpoint);
        if (JSON.stringify(prior) === JSON.stringify(snapshot)) return;
        checkpoint = checkpoints.get(snapshot.id)!;
      }
      const intent = { requestId: crypto.randomUUID(), workbook: snapshot };
      setCheckpoint(snapshot.id, { revision: checkpoint.revision, intent });
      await send(snapshot.id, checkpoints.get(snapshot.id)!);
    });
    pending.set(snapshot.id, operation);
    try { await operation; }
    finally { if (pending.get(snapshot.id) === operation) pending.delete(snapshot.id); }
  };
  return {
    loadWorkbook, saveWorkbook,
    checkpoint: id => { const cp = checkpoints.get(id); return cp && structuredClone(cp); },
    restoreCheckpoint: (id, cp) => {
      if (pending.has(id)) throw new Error('Save is in progress.');
      setCheckpoint(id, cp);
    },
    createWorkbook: async (name, initial) => {
      const cleaned = name.trim();
      if (!cleaned || cleaned.length > 200) throw new Error('Workbook name must contain 1 to 200 characters.');
      const workbook = { ...(initial ?? createDefaultWorkbook()), id: initial?.id ?? crypto.randomUUID(), name: cleaned };
      if (!checkpoints.has(workbook.id)) setCheckpoint(workbook.id, { revision: 0 });
      await saveWorkbook(workbook);
      return workbook;
    },
    listWorkbooks: async () => {
      await requireSession();
      const { data, error } = await supabase.from('y_sheets_workbooks').select('id, name, updated_at, revision')
        .eq('owner_id', ownerId).order('updated_at', { ascending: false });
      if (error) throw new Error('Unable to load workbooks.');
      return (data ?? []).map(row => ({ id: row.id, name: row.name, updatedAt: row.updated_at, revision: row.revision }));
    },
    deleteWorkbook: async (id, revision) => {
      await requireSession();
      if (pending.has(id) || checkpoints.get(id)?.intent) throw new Error('Resolve pending edits before deleting.');
      const { data, error } = await supabase.rpc('delete_y_sheets_workbook', { p_id: id, p_expected_revision: revision });
      if (error || data !== id) throw new WorkbookStorageError('conflict', 'Delete was not confirmed. Refresh the file list.');
      checkpoints.delete(id);
    },
  };
}
