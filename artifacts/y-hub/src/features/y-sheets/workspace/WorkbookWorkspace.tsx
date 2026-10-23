import { useLocation } from "wouter";
import { ArrowLeft, FileSpreadsheet, Plus, Search, MoreHorizontal, LayoutGrid, List, RefreshCw, Clock3 } from "lucide-react";
import { YSheetsBrandMark } from "../components/YSheetsBrandMark";
import { useLanguage } from "@/i18n/LanguageContext";
import "./workspace.css";
import { recoveryWorkbook } from "../io/recoveryJournal";
import { useState } from "react";
import { useTheme } from "next-themes";
import { YSheetsHostAdapter } from "../integration/YSheetsHostAdapter";
import type { HostUser } from "../integration/hostContract";
import { downloadWorkbookJSON } from "../io/localPersistence";
import { useWorkbookWorkspace } from "./useWorkbookWorkspace";

export function WorkbookWorkspace({ user }: { user: HostUser }) {
  const w = useWorkbookWorkspace(user.id);
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [menuFileId, setMenuFileId] = useState<string | null>(null);
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
      w.activate(wb);
      await w.refresh();
    });
  const goBackToHub = () => void w.run(async () => {
    // Never leave with an unpersisted edit unless recovery is explicitly requested.
    await w.leave();
    navigate("/dashboard");
  });
  const showMyFiles = () => {
    setShowAllFiles(false);
    setMenuFileId(null);
    void w.myFiles();
  };
  const statusText = w.status === "saved" ? "Saved" :
    w.status === "conflict" ? "Save conflict — recovery retained" :
    w.status === "error" ? "Save failed — recovery retained" :
    w.status === "saving" ? "Saving…" : "Unsaved changes";
  const formatModified = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  };
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
                {w.recoveries.map(entry => (
                  <div key={entry.key} className="ys-recovery-entry">
                    <span className="ys-recovery-label" dir="auto">
                      {entry.record.workbook.name} · {formatModified(entry.record.updatedAt)}
                    </span>
                    <button type="button" disabled={w.busy} onClick={() => void w.restore(entry)}>Recover</button>
                    <button type="button" onClick={() => downloadWorkbookJSON(
                      recoveryWorkbook(entry.record.workbook, entry.record.draft),
                    )}>Download</button>
                    <button type="button" disabled={w.busy}
                      onClick={() => void w.discardRecovery(entry)}>Discard Local Copy</button>
                  </div>
                ))}
              </section>
            )}

            {!showAllFiles && (
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

            <section className="ys-browser" aria-label="Workbook files">
              <div className="ys-section-heading">
                <div>
                  <h2>{showAllFiles ? (language === "ar" ? "كل الملفات" : "All files") :
                    (language === "ar" ? "الملفات الأخيرة" : "Recent files")}</h2>
                  <p>{w.files.length} {language === "ar" ? "ملف محمّل" : "loaded workbooks"}</p>
                </div>
                <div className="ys-file-view-controls">
                  <button type="button" className="ys-view-toggle" title="Card view"
                    aria-label="Card view" aria-pressed={!showAllFiles}
                    onClick={() => { setShowAllFiles(false); setMenuFileId(null); }}>
                    <LayoutGrid size={17}/>
                  </button>
                  <button type="button" className="ys-view-toggle" title="All files list"
                    aria-label="All files list" aria-pressed={showAllFiles}
                    onClick={() => { setShowAllFiles(true); setMenuFileId(null); }}>
                    <List size={17}/>
                  </button>
                  {!showAllFiles && (
                    <button className="ys-view-all" type="button"
                      onClick={() => setShowAllFiles(true)}>
                      {language === "ar" ? "عرض الكل" : "View all"} →
                    </button>
                  )}
                </div>
              </div>

              <form className="ys-search-row" onSubmit={event => {
                event.preventDefault();
                setShowAllFiles(true);
                void w.searchFiles(search);
              }}>
                <div className="ys-search-field">
                  <Search size={17}/>
                  <input type="search" aria-label="Search workbooks" value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={language === "ar" ? "ابحث عن ملف..." : "Search workbooks..."} />
                </div>
                <button type="submit" disabled={w.busy} className="ys-secondary-button">Search</button>
                <button type="button" disabled={w.busy} className="ys-icon-button"
                  onClick={() => void w.run(w.refresh)} title="Refresh files" aria-label="Refresh files">
                  <RefreshCw size={17}/>
                </button>
              </form>

              {w.files.length > 0 ? (
                <div className={showAllFiles ? "ys-file-list" : "ys-file-cards"}>
                  {(showAllFiles ? w.files : w.files.slice(0, 6)).map(file => (
                    <article className="ys-file-card" key={file.id}>
                      <button type="button" className="ys-file-open" disabled={w.busy}
                        onClick={() => void w.open(file.id)}>
                        <span className="ys-file-preview" aria-hidden="true">
                          <FileSpreadsheet size={26}/>
                          <span className="ys-preview-lines"><i/><i/><i/></span>
                        </span>
                        <span className="ys-file-details">
                          <strong dir="auto">{file.name}</strong>
                          <small><Clock3 size={12}/> <time dateTime={file.updatedAt}>
                            {formatModified(file.updatedAt)}
                          </time></small>
                        </span>
                      </button>
                      <div className="ys-file-actions">
                        <button type="button" className="ys-icon-button" disabled={w.busy}
                          aria-label={"More options for " + file.name} title="File options"
                          aria-expanded={menuFileId === file.id}
                          onClick={() => setMenuFileId(menuFileId === file.id ? null : file.id)}>
                          <MoreHorizontal size={20}/>
                        </button>
                        {menuFileId === file.id && (
                          <div className="ys-file-menu">
                            <button type="button" disabled={w.busy}
                              onClick={() => { setMenuFileId(null); void w.rename(file.id); }}>Rename</button>
                            <button type="button" disabled={w.busy} className="ys-delete-action"
                              onClick={() => { setMenuFileId(null); void w.remove(file); }}>Delete</button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ys-files-empty">
                  <FileSpreadsheet size={30}/>
                  <strong>{language === "ar" ? "ما في ملفات لعرضها" : "No workbooks found"}</strong>
                  <p>Create a workbook, recover a local copy, or refresh your files.</p>
                </div>
              )}
              {w.hasMore && showAllFiles && (
                <button className="ys-secondary-button ys-load-more" type="button" disabled={w.busy}
                  onClick={() => void w.more()}>Load more files</button>
              )}
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
