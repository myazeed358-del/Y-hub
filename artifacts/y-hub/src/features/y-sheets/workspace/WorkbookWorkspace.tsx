import { useLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Plus } from "lucide-react";
import { YSheetsBrandMark } from "../components/YSheetsBrandMark";
import { useLanguage } from "@/i18n/LanguageContext";
import "./workspace.css";
import { recoveryWorkbook } from "../io/recoveryJournal";
import { useTheme } from "next-themes";
import { YSheetsHostAdapter } from "../integration/YSheetsHostAdapter";
import type { HostUser } from "../integration/hostContract";
import { downloadWorkbookJSON } from "../io/localPersistence";
import { SharedFiles } from "../sharing/SharedFiles";
import { SharedWorkbookView } from "../sharing/SharedWorkbookView";
import { useRef, useState } from "react";
import { initialDirectory } from "./directoryRepository";
import { WorkbookDirectory } from "./WorkbookDirectory";
import { useWorkbookWorkspace } from "./useWorkbookWorkspace";

export function WorkbookWorkspace({ user }: { user: HostUser }) {
  const w = useWorkbookWorkspace(user.id);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const directoryLocation = useRef(initialDirectory);
  const directoryOwner = useRef(user.id);
  if (directoryOwner.current !== user.id) {
    directoryOwner.current = user.id;
    directoryLocation.current = initialDirectory;
  }
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const download = () => {
    const wb = w.session.current?.recoveryCopy();
    if (wb) downloadWorkbookJSON(wb);
  };
  const create = (copy = false) =>
    w.run(async () => {
      if (!copy) await w.leave();
      const name = window.prompt(
        "Workbook name:",
        copy
          ? `${w.session.current?.workbook.name} (recovery)`
          : "Untitled Workbook",
      );
      if (name === null) return;
      const original = copy ? w.session.current?.recoveryCopy() : undefined;
      const id = crypto.randomUUID(),
        sheetId = crypto.randomUUID();
      const initial = original
        ? { ...original, id, name }
        : {
            id,
            name,
            version: 1,
            activeSheetId: sheetId,
            sheets: [
              {
                id: sheetId,
                name: "Sheet 1",
                rowCount: 100,
                colCount: 26,
                cells: {},
                columnWidths: {},
                rowHeights: {},
                mergedCells: [],
                conditionalFormats: [],
                validations: {},
              },
            ],
          };
      const wb = await w.storage.createWorkbook!(name, initial);
      w.journal.acknowledge(wb);
      directoryLocation.current = initialDirectory;
      w.activate(wb);
      await w.refresh();
    });
  const goBackToHub = () => void w.run(async () => {
    // Never leave with an unpersisted edit unless recovery is explicitly requested.
    await w.leave();
    navigate("/dashboard");
  });
  const showMyFiles = () => {
    void w.myFiles();
  };
  const formatModified = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  };
  if (sharedId) return <div className="y-sheets-workspace"><SharedWorkbookView key={`${user.id}:${sharedId}`} actor={user.id} id={sharedId} onClose={() => setSharedId(null)}/></div>;
  return (
    <div className="y-sheets-workspace" data-testid="y-sheets-workspace">
      {!w.active && (
        <header className="y-sheets-workspace-header" dir="ltr">
          <button type="button" className="ys-header-button" disabled={w.busy}
            onClick={showMyFiles}>My Files</button>
          <div className="ys-header-title" aria-label="Y-Sheets">
            <YSheetsBrandMark size={24}/> <strong>Y-Sheets</strong>
          </div>
          <div className="ys-header-actions">
            <button type="button" className="ys-header-button ys-header-return" disabled={w.busy}
              onClick={goBackToHub}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{language === "ar" ? "العودة إلى Y-Hub" : "Back to Y-Hub"}</span>
            </button>
          </div>
        </header>
      )}

      {w.error && <div role="alert" className="y-sheets-workspace-error">{w.error}</div>}
      {w.busy && <div role="status" className="ys-busy-status">Loading…</div>}

      {w.active ? (
        <div className="y-sheets-workspace-editor" dir="ltr">
          <YSheetsHostAdapter
            key={w.active.id}
            user={user}
            initialWorkbook={w.active}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            onSave={w.change}
            onDraftChange={w.draft}
            onError={w.report}
            onRequestNewWorkbook={() => void create()}
            chrome={{
              status: w.status,
              busy: w.busy,
              onMyFiles: showMyFiles,
              onReturnToHub: goBackToHub,
              onRetry: () => void w.retry(),
              onDownloadRecovery: download,
              onSaveAsCopy: () => void create(true),
              onKeepRecovery: () => void w.keepAndLeave(),
            }}
            permissions={{
              canEdit: true,
              canExport: true,
              canCreateSheet: true,
              canDeleteSheet: true,
              canFormat: true,
            }}
          />
        </div>
      ) : (
        <section className="y-sheets-workspace-files" dir={language === "ar" ? "rtl" : "ltr"}>
          <div className="ys-files-inner">
            <div className="ys-files-hero">
              <div>
                <p className="ys-eyebrow">Y-SHEETS WORKSPACE</p>
                <h1>{language === "ar" ? "مساحة ملفاتك" : "Your workspace"}</h1>
                <p className="ys-files-subtitle">
                  {language === "ar"
                    ? "أنشئ جداولك، وافتح أعمالك الأخيرة، وأدر ملفاتك من مكان واحد."
                    : "Create, find, and organize your spreadsheets in one place."}
                </p>
              </div>
              <button type="button" className="ys-primary-button" disabled={w.busy}
                onClick={() => void create()}>
                <Plus size={18} /> New Workbook
              </button>
            </div>

            {w.corrupt > 0 && (
              <div className="ys-recovery-warning" role="alert">
                {w.corrupt} unreadable recovery record(s) retained. Do not clear browser storage.
                Export browser records for manual recovery.
              </div>
            )}

            {w.recoveries.length > 0 && (
              <section className="ys-recovery-panel" aria-label="Local recovery">
                <h2>Recover unsaved work</h2>
                <p>Stored in this browser for this account. Recovery never overwrites a newer cloud revision.</p>
                <p>{language === "ar"
                  ? "دمج مع أحدث نسخة يتحقق من الوصول ثم يحفظ تعديلات الخلايا غير المتعارضة. عند التعارض أو تغيير بنية الورقة تبقى نسختك المحلية دون دمج."
                  : "Merge with latest checks access, then saves non-overlapping cell edits. Overlapping edits or sheet structure changes keep your local copy without merging."}</p>
                {w.recoveries.map(entry => (
                  <div key={entry.key} className="ys-recovery-entry">
                    <span className="ys-recovery-label" dir="auto">
                      {entry.record.workbook.name} · {formatModified(entry.record.updatedAt)}
                    </span>
                    <button type="button" disabled={w.busy} onClick={() => void w.restore(entry)}>Recover</button>
                    {entry.record.base && <button type="button" disabled={w.busy}
                      onClick={() => void w.mergeLatest(entry)}>
                      {language === "ar" ? "دمج مع أحدث نسخة" : "Merge with latest"}
                    </button>}
                    <button type="button" onClick={() => downloadWorkbookJSON(
                      recoveryWorkbook(entry.record.workbook, entry.record.draft),
                    )}>Download</button>
                    <button type="button" disabled={w.busy}
                      onClick={() => void w.discardRecovery(entry)}>Discard Local Copy</button>
                  </div>
                ))}
              </section>
            )}

            {(
              <section className="ys-start-section" aria-label="Start creating">
                <div className="ys-section-heading">
                  <h2>{language === "ar" ? "ابدأ ملفًا جديدًا" : "Start creating"}</h2>
                </div>
                <div className="ys-start-tiles">
                  <button type="button" className="ys-blank-tile" disabled={w.busy}
                    onClick={() => void create()}>
                    <span className="ys-blank-icon"><Plus size={26} /></span>
                    <strong>{language === "ar" ? "جدول فارغ" : "Blank workbook"}</strong>
                    <span>{language === "ar" ? "ابدأ من صفحة جديدة" : "Start with a clean sheet"}</span>
                  </button>
                  <div className="ys-start-info">
                    <FileSpreadsheet size={26} />
                    <strong>{language === "ar" ? "جداولك في حسابك" : "Your spreadsheet library"}</strong>
                    <span>{language === "ar"
                      ? "يمكنك فتح الملفات وتعديل أسمائها أو تنزيل نسخة احتياطية."
                      : "Open your workbooks, rename them, or download recovery copies."}</span>
                  </div>
                </div>
              </section>
            )}

            <SharedFiles key={`shared:${user.id}`} actor={user.id} onOpen={setSharedId}/>
            <WorkbookDirectory key={user.id} owner={user.id} busy={w.busy} location={directoryLocation}
              open={w.open} rename={w.rename} remove={w.remove} />
          </div>
        </section>
      )}
    </div>
  );
}
