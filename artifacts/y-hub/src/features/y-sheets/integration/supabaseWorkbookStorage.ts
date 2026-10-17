import { supabase } from '@/utils/supabaseClient';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import type { WorkbookData } from '../types/workbook';
import type { HostStorageAdapter } from './hostContract';

type WorkbookRow = {
  id: string;
  name: string;
  content: WorkbookData;
  revision: number;
  updated_at: string;
};

export function createSupabaseWorkbookStorage(
  ownerId: string,
): HostStorageAdapter {
  // Revisions are private to each adapter/session.
  const revisions = new Map<string, number>();
  const pending = new Map<string, Promise<void>>();

  const requireSession = async (): Promise<void> => {
    const { data, error } = await supabase.auth.getUser();

    if (error || data.user?.id !== ownerId) {
      throw new Error('Y-Sheets session is no longer authorized.');
    }
  };

  const loadWorkbook = async (id: string): Promise<WorkbookData> => {
    await requireSession();

    const { data, error } = await supabase
      .from('y_sheets_workbooks')
      .select('id, name, content, revision')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error('Workbook not found or access denied.');
    }

    const row = data as WorkbookRow;
    revisions.set(id, row.revision);

    return {
      ...row.content,
      id: row.id,
      name: row.name,
    };
  };

  const saveWorkbook = async (workbook: WorkbookData): Promise<void> => {
    const previous = pending.get(workbook.id) ?? Promise.resolve();

    const operation = previous.catch(() => {}).then(async () => {
      await requireSession();

      const revision = revisions.get(workbook.id);
      if (revision === undefined) {
        throw new Error('Load or create the workbook before saving.');
      }

      const { data, error } = await supabase
        .from('y_sheets_workbooks')
        .update({
          name: workbook.name,
          content: workbook,
          revision: revision + 1,
        })
        .eq('id', workbook.id)
        .eq('revision', revision)
        .select('revision')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Workbook conflict: another session changed this file. ' +
          'Reload and reconcile changes before saving.'
        );
      }

      revisions.set(workbook.id, data.revision);
    });

    pending.set(workbook.id, operation);

    try {
      await operation;
    } finally {
      if (pending.get(workbook.id) === operation) {
        pending.delete(workbook.id);
      }
    }
  };

  const createWorkbook = async (name: string): Promise<WorkbookData> => {
    await requireSession();

    const cleanedName = name.trim();
    if (!cleanedName || cleanedName.length > 200) {
      throw new Error('Workbook name must contain 1 to 200 characters.');
    }

    const workbook: WorkbookData = {
      ...createDefaultWorkbook(),
      id: crypto.randomUUID(),
      name: cleanedName,
    };

    const { data, error } = await supabase
      .from('y_sheets_workbooks')
      .insert({
        id: workbook.id,
        owner_id: ownerId,
        name: workbook.name,
        content: workbook,
      })
      .select('revision')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create workbook.');
    }

    revisions.set(workbook.id, data.revision);
    return workbook;
  };

  const listWorkbooks = async () => {
    await requireSession();

    const { data, error } = await supabase
      .from('y_sheets_workbooks')
      .select('id, name, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(row => ({
      id: row.id as string,
      name: row.name as string,
      updatedAt: row.updated_at as string,
    }));
  };

  return {
    loadWorkbook,
    saveWorkbook,
    createWorkbook,
    listWorkbooks,
  };
}
