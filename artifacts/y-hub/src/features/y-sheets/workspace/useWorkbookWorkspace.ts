import { useNavigationGuard } from "@/shared/navigation/guardedLocation";
import { useLanguage } from "@/i18n/LanguageContext";
import { workbookReducer } from "../state/workbookReducer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseWorkbookStorage } from "../integration/supabaseWorkbookStorage";
import { WorkbookSession } from "../integration/workbookSession";
import type { SaveStatus } from "../integration/saveCoordinator";
import {
  RecoveryJournal,
  recoveryWorkbook,
  type RecoveryEntry,
  type PendingCellEdit,
} from "../io/recoveryJournal";
import type { WorkbookData } from "../types/workbook";

// Delay access: unavailable localStorage must produce an actionable error, not a render crash.
const browserStorage: Storage = {
  get length() {
    return window.localStorage.length;
  },
  key: (i) => window.localStorage.key(i),
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
  removeItem: (k) => window.localStorage.removeItem(k),
  clear: () => {
    throw Error("Recovery storage cannot be cleared wholesale.");
  },
};
export function useWorkbookWorkspace(ownerId: string) {
  const { language } = useLanguage();
  const journal = useMemo(
    () => new RecoveryJournal(ownerId, browserStorage),
    [ownerId],
  );
  const storage = useMemo(
    () =>
      createSupabaseWorkbookStorage(ownerId, (id, cp) =>
        journal.checkpoint(id, cp),
      ),
    [ownerId, journal],
  );
  const [files, setFiles] = useState<
    Array<{ id: string; name: string; updatedAt: string; revision?: number }>
  >([]);
  const [recoveries, setRecoveries] = useState<RecoveryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const search = useRef("");
  const directoryRequest = useRef(0);
  const [corrupt, setCorrupt] = useState(0);
  const [active, setActive] = useState<WorkbookData | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useRef<WorkbookSession | null>(null);
  const alive = useRef(true);
  const operation = useRef(false);
  const report = useCallback((err: unknown) => {
    if (alive.current)
      setError(err instanceof Error ? err.message : String(err));
  }, []);
  const refreshLocal = useCallback(() => {
    const result = journal.list();
    setRecoveries(result.entries);
    setCorrupt(result.corruptKeys.length);
  }, [journal]);
  const refresh = useCallback(async () => {
    refreshLocal();
    const request = ++directoryRequest.current;
    try {
      const result = await storage.listWorkbooks!({ search: search.current });
      if (alive.current && request === directoryRequest.current) {
        setFiles(result);
        setHasMore(result.length === 50);
      }
    } catch (error) {
      if (alive.current && request === directoryRequest.current) throw error;
    }
  }, [refreshLocal, storage]);
  useEffect(() => {
    alive.current = true;
    void refresh().catch(report);
    const unload = (event: BeforeUnloadEvent) => {
      if (session.current?.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const changed = () => {
      try {
        refreshLocal();
      } catch (e) {
        report(e);
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("storage", changed);
    return () => {
      alive.current = false;
      directoryRequest.current++;
      session.current?.dispose();
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("storage", changed);
    };
  }, [refresh, refreshLocal, report]);
  useNavigationGuard(() => {
    const current = session.current;
    if (!current?.dirty) return true;
    if (!window.confirm(language === 'ar'
      ? 'توجد تعديلات غير مؤكدة الحفظ أو حفظ جارٍ. هل تريد الاحتفاظ بنسخة استعادة على هذا المتصفح ومغادرة التطبيق؟ يمكنك استعادتها من ملفاتي.'
      : 'Changes are unsaved or saving. Keep a recovery copy on this browser and leave? Restore it from My Files.')) return false;
    try { current.keepRecovery(); return true; }
    catch (e) { report(e); return false; }
  });
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      report(e);
    } finally {
      operation.current = false;
      if (alive.current) {
        setBusy(false);
        try {
          refreshLocal();
        } catch (e) {
          report(e);
        }
      }
    }
  };
  const activate = (wb: WorkbookData, recovery?: RecoveryEntry) => {
    if (!alive.current) return;
    session.current?.dispose();
    const next = new WorkbookSession(
      wb,
      storage,
      journal,
      (nextStatus) => {
        setStatus(
          nextStatus === "saved" && session.current?.draft
            ? "unsaved"
            : nextStatus,
        );
      },
      recovery,
    );
    session.current = next;
    setActive(wb);
    setStatus(recovery ? "unsaved" : "saved");
    if (recovery) next.change(wb);
  };
  const leave = async () => {
    if (session.current?.dirty) await session.current.flush();
  };
  const open = (id: string) =>
    run(async () => {
      await leave();
      if (journal.list().entries.some((e) => e.record.workbook.id === id))
        throw new Error(
          "Recover or discard the local copy before opening this cloud workbook.",
        );
      const wb = await storage.loadWorkbook(id);
      activate(wb); // Never substitute a default workbook after a failed load.
    });
  const restore = (entry: RecoveryEntry) =>
    run(async () => {
      await leave();
      const { workbook, checkpoint, draft } = entry.record;
      journal.archiveCurrent(workbook.id, entry);
      storage.restoreCheckpoint!(workbook.id, checkpoint);
      const wb = workbookReducer(workbook, {
        type: "SET_WORKBOOK",
        payload: recoveryWorkbook(workbook, draft),
      });
      activate(wb, entry);
    });
  const myFiles = () =>
    run(async () => {
      await leave();
      session.current?.dispose();
      session.current = null;
      setActive(null);
      await refresh();
    });
  const keepAndLeave = () =>
    run(async () => {
      session.current?.keepRecovery();
      session.current?.dispose();
      session.current = null;
      setActive(null);
      await refresh();
    });
  const searchFiles = (value: string) =>
    run(async () => {
      search.current = value;
      await refresh();
    });
  const more = () =>
    run(async () => {
      const next = await storage.listWorkbooks!({
        search: search.current,
        offset: files.length,
      });
      if (alive.current) {
        setFiles([
          ...files,
          ...next.filter((f) => !files.some((old) => old.id === f.id)),
        ]);
        setHasMore(next.length === 50);
      }
    });
  const rename = (id: string) =>
    run(async () => {
      if (journal.list().entries.some((e) => e.record.workbook.id === id))
        throw new Error(
          "Recover pending local edits before renaming this file.",
        );
      const wb = await storage.loadWorkbook(id);
      const name = window.prompt("New workbook name:", wb.name);
      if (name === null || name.trim() === wb.name) return;
      if (!name.trim() || name.trim().length > 200)
        throw new Error("Workbook name must contain 1 to 200 characters.");
      const renamed = { ...wb, name: name.trim() };
      await storage.saveWorkbook(renamed);
      journal.acknowledge(renamed);
      await refresh();
    });
  const remove = (file: { id: string; name: string; revision?: number }) =>
    run(async () => {
      if (journal.list().entries.some((e) => e.record.workbook.id === file.id))
        throw new Error(
          "Recover or explicitly discard local edits before deleting this file.",
        );
      if (
        !window.confirm(
          `Delete "${file.name}" permanently? This cannot be undone.`,
        )
      )
        return;
      if (file.revision === undefined)
        throw new Error("Refresh files before deleting.");
      await storage.deleteWorkbook!(file.id, file.revision);
      await refresh();
    });
  const discardRecovery = (entry: RecoveryEntry) =>
    run(async () => {
      if (
        !window.confirm(
          `Discard this local recovery of "${entry.record.workbook.name}"? Download it first if needed. The cloud file will not be changed.`,
        )
      )
        return;
      journal.removeUnchanged(entry);
      refreshLocal();
    });
  const change = useCallback(
    async (wb: WorkbookData) => {
      try {
        session.current?.change(wb);
      } catch (e) {
        setStatus("error");
        report(e);
      }
    },
    [report],
  );
  const draft = useCallback(
    (edit: PendingCellEdit | null) => {
      try {
        session.current?.editDraft(edit);
        setStatus(
          edit ? "unsaved" : (session.current?.coordinator.status ?? "saved"),
        );
      } catch (e) {
        setStatus("error");
        report(e);
      }
    },
    [report],
  );
  return {
    storage,
    journal,
    files,
    hasMore,
    searchFiles,
    more,
    rename,
    remove,
    discardRecovery,
    recoveries,
    corrupt,
    active,
    status,
    error,
    busy,
    session,
    run,
    activate,
    leave,
    refresh,
    open,
    restore,
    myFiles,
    keepAndLeave,
    change,
    draft,
    report,
    retry: () =>
      run(async () => {
        await session.current?.flush();
      }),
  };
}
