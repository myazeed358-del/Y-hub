import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { YSheetsHostAdapter } from '@/features/y-sheets/integration/YSheetsHostAdapter';
import { createSupabaseWorkbookStorage } from '@/features/y-sheets/integration/supabaseWorkbookStorage';
import {
  WorkbookSaveCoordinator,
  type SaveStatus,
} from '@/features/y-sheets/integration/saveCoordinator';
import { downloadWorkbookJSON } from '@/features/y-sheets/io/localPersistence';
import type { WorkbookData } from '@/features/y-sheets/types/workbook';

type FileItem = {
  id: string;
  name: string;
  updatedAt: string;
};

export default function YSheetsPage() {
  const { user, role, profile, status } = useAuth();
  const userId = status === 'authenticated' ? user?.id : undefined;

  const storage = useMemo(
    () => userId ? createSupabaseWorkbookStorage(userId) : null,
    [userId],
  );

  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const latestWorkbook = useRef<WorkbookData | null>(null);

  const coordinator = useMemo(
    () => storage
      ? new WorkbookSaveCoordinator(
          workbook => storage.saveWorkbook(workbook),
          setSaveStatus,
        )
      : null,
    [storage],
  );

  const enqueueSave = useCallback(async (workbook: WorkbookData) => {
    if (!coordinator) throw new Error('Storage unavailable');
    latestWorkbook.current = workbook;
    coordinator.enqueue(workbook);
  }, [coordinator]);

  // Warn on refresh, tab close or browser navigation while changes remain.
  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!coordinator?.hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [coordinator]);

  const openMyFiles = async () => {
    setError(null);

    if (coordinator?.hasUnsavedChanges) {
      setBusy(true);

      try {
        await coordinator.flush();

        if (coordinator.hasUnsavedChanges) {
          setError('Changes are still pending. Please save before leaving.');
          return;
        }
      } catch (err) {
        setError(
          'Unable to save. Your changes remain in this session. ' +
          (err instanceof Error ? err.message : String(err))
        );
        return;
      } finally {
        setBusy(false);
      }
    }

    setActiveId(null);
    latestWorkbook.current = null;
    setSaveStatus('saved');

    try {
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const retrySave = async () => {
    if (!coordinator) return;
    setError(null);

    try {
      await coordinator.flush();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const downloadRecovery = () => {
    if (!latestWorkbook.current) return;
    downloadWorkbookJSON(latestWorkbook.current);
  };


  const refresh = useCallback(async () => {
    if (!storage?.listWorkbooks) return;

    const result = await storage.listWorkbooks();
    setFiles(result);
  }, [storage]);

  useEffect(() => {
    let cancelled = false;

    setActiveId(null);
    setFiles([]);
    setError(null);

    if (!storage) return;

    setBusy(true);

    storage.listWorkbooks?.()
      .then(items => {
        if (!cancelled) setFiles(items);
      })
      .catch(err => {
        if (!cancelled) setError(
          err instanceof Error ? err.message : String(err)
        );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storage]);

  const createFile = async () => {
    if (!storage?.createWorkbook || busy) return;

    const name = window.prompt('Workbook name:', 'Untitled Workbook');
    if (name === null) return;

    if (!name.trim() || name.trim().length > 200) {
      setError('Workbook name must contain 1 to 200 characters.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await storage.createWorkbook(name.trim());
      await refresh();
      latestWorkbook.current = null;
      setSaveStatus('saved');
      setActiveId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const requestNewFile = async () => {
    if (busy) return;

    if (coordinator?.hasUnsavedChanges) {
      try {
        await coordinator.flush();

        if (coordinator.hasUnsavedChanges) {
          setError('Please finish saving before creating another file.');
          return;
        }
      } catch (err) {
        setError(
          'Cannot create another file until changes are saved. ' +
          (err instanceof Error ? err.message : String(err))
        );
        return;
      }
    }

    await createFile();
  };

  if (status !== 'authenticated' || !user || !role || !storage) {
    return (
      <div role="status" className="p-6">
        Y-Sheets requires an authenticated Y-Hub account.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Y-Sheets</h1>
          <p className="text-sm text-muted-foreground">
            Your spreadsheets are stored in your Y-Hub account.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void openMyFiles()}
          className="border rounded px-3 py-2 text-sm"
        >
          My Files
        </button>
      </div>

      {error && (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {busy && <div role="status">Loading...</div>}

      {activeId && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span role="status" aria-live="polite">
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Save failed'}
            {saveStatus === 'conflict' && 'Save conflict'}
          </span>

          {(saveStatus === 'error' || saveStatus === 'conflict') && (
            <>
              {saveStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => void retrySave()}
                  className="rounded border px-3 py-1"
                >
                  Retry Save
                </button>
              )}
              <button
                type="button"
                onClick={downloadRecovery}
                className="rounded border px-3 py-1"
              >
                Download Recovery Copy
              </button>
            </>
          )}
        </div>
      )}



      {!activeId && (
        <section className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createFile()}
            className="bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            + New Workbook
          </button>

          <div className="grid gap-2">
            {files.map(file => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveId(file.id)}
                className="text-left border rounded-lg p-3 hover:bg-muted"
              >
                <span className="block font-medium">{file.name}</span>
                <span className="block text-xs opacity-60">
                  Updated: {new Date(file.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}

            {!busy && files.length === 0 && (
              <p className="text-sm opacity-70">
                No workbooks yet. Create your first spreadsheet.
              </p>
            )}
          </div>
        </section>
      )}

      {activeId && (
        <div style={{ height: 'calc(100vh - 180px)', minHeight: 500 }}>
          <YSheetsHostAdapter
            key={`${user.id}:${activeId}`}
            user={{
              id: user.id,
              name: profile?.full_name || user.email || 'Y-Hub User',
              email: user.email,
              role,
            }}
            workbookId={activeId}
            storageAdapter={storage}
            onSave={enqueueSave}
            onRequestNewWorkbook={() => void requestNewFile()}
            permissions={{
              canEdit: true,
              canExport: true,
              canCreateSheet: true,
              canDeleteSheet: true,
              canFormat: true,
            }}
            onError={err => setError(err.message)}
          />
        </div>
      )}
    </div>
  );
}
