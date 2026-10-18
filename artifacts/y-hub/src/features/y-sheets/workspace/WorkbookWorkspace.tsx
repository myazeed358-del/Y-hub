import { recoveryWorkbook } from "../io/recoveryJournal";
import { useState } from "react";
import { useTheme } from "next-themes";
import { YSheetsHostAdapter } from "../integration/YSheetsHostAdapter";
import type { HostUser } from "../integration/hostContract";
import { downloadWorkbookJSON } from "../io/localPersistence";
import { useWorkbookWorkspace } from "./useWorkbookWorkspace";

export function WorkbookWorkspace({ user }: { user: HostUser }) {
  const w = useWorkbookWorkspace(user.id);
  const { resolvedTheme } = useTheme();
  const [search, setSearch] = useState("");
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
  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Y-Sheets</h1>
          <p className="text-sm text-muted-foreground">
            Private spreadsheets in your Y-Hub account.
          </p>
        </div>
        <button
          disabled={w.busy}
          onClick={() => void w.myFiles()}
          className="border rounded px-3 py-2"
        >
          My Files
        </button>
      </header>
      {w.error && (
        <div role="alert" className="text-red-600">
          {w.error}
        </div>
      )}
      {w.busy && <div role="status">Loading…</div>}
      {w.active ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span role="status" aria-live="polite">
              {w.status === "saved"
                ? "Saved"
                : w.status === "conflict"
                  ? "Save conflict — your copy is retained"
                  : w.status === "error"
                    ? "Save failed — retain or download your copy"
                    : w.status === "saving"
                      ? "Saving…"
                      : "Unsaved changes"}
            </span>
            <button
              disabled={w.busy}
              onClick={() => void w.retry()}
              className="border rounded px-2 py-1"
            >
              Save / Retry
            </button>
            <button onClick={download} className="border rounded px-2 py-1">
              Download Recovery Copy
            </button>
            {(w.status === "conflict" || w.status === "error") && (
              <>
                <button
                  disabled={w.busy}
                  onClick={() => void create(true)}
                  className="border rounded px-2 py-1"
                >
                  Save as New Copy
                </button>
                <button
                  disabled={w.busy}
                  onClick={() => void w.keepAndLeave()}
                  className="border rounded px-2 py-1"
                >
                  Keep Local Recovery and Return
                </button>
              </>
            )}
          </div>
          <div style={{ height: "calc(100vh - 220px)", minHeight: 500 }}>
            <YSheetsHostAdapter
              key={w.active.id}
              user={user}
              initialWorkbook={w.active}
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              onSave={w.change}
              onDraftChange={w.draft}
              onError={w.report}
              onRequestNewWorkbook={() => void create()}
              permissions={{
                canEdit: true,
                canExport: true,
                canCreateSheet: true,
                canDeleteSheet: true,
                canFormat: true,
              }}
            />
          </div>
        </>
      ) : (
        <section className="space-y-3">
          <button
            disabled={w.busy}
            onClick={() => void create()}
            className="bg-emerald-700 text-white rounded px-4 py-2"
          >
            + New Workbook
          </button>
          {w.corrupt > 0 && (
            <p role="alert">
              {w.corrupt} unreadable local recovery record(s) retained. Do not
              clear browser storage; export the browser records for manual
              recovery.
            </p>
          )}
          {w.recoveries.length > 0 && (
            <section
              aria-label="Local recovery"
              className="border rounded p-3 space-y-2"
            >
              <h2 className="font-semibold">Recover unsaved work</h2>
              <p className="text-sm">
                Stored on this browser for this account. Other devices cannot
                access these copies. Recovery never overwrites a newer cloud
                revision.
              </p>
              {w.recoveries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex flex-wrap gap-2 items-center"
                >
                  <span>
                    {entry.record.workbook.name} —{" "}
                    {new Date(entry.record.updatedAt).toLocaleString()}
                  </span>
                  <button
                    disabled={w.busy}
                    onClick={() => void w.restore(entry)}
                    className="border rounded px-2 py-1"
                  >
                    Recover
                  </button>
                  <button
                    onClick={() =>
                      downloadWorkbookJSON(
                        recoveryWorkbook(
                          entry.record.workbook,
                          entry.record.draft,
                        ),
                      )
                    }
                    className="border rounded px-2 py-1"
                  >
                    Download
                  </button>
                  <button
                    disabled={w.busy}
                    onClick={() => void w.discardRecovery(entry)}
                    className="border rounded px-2 py-1"
                  >
                    Discard Local Copy
                  </button>
                </div>
              ))}
            </section>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void w.searchFiles(search);
            }}
            className="flex gap-2"
          >
            <input
              aria-label="Search workbooks"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workbooks"
              className="border rounded px-3 py-2 bg-background"
            />
            <button disabled={w.busy} className="border rounded px-3">
              Search
            </button>
          </form>
          <div className="grid gap-2">
            {w.files.map((file) => (
              <div key={file.id} className="border rounded-lg p-3">
                <button
                  disabled={w.busy}
                  onClick={() => void w.open(file.id)}
                  className="text-left w-full"
                >
                  <span className="block font-medium">{file.name}</span>
                  <span className="text-xs opacity-60">
                    Updated: {new Date(file.updatedAt).toLocaleString()}
                  </span>
                </button>
                <div className="flex gap-3 mt-2">
                  <button
                    disabled={w.busy}
                    onClick={() => void w.rename(file.id)}
                    className="border rounded px-2 py-1"
                  >
                    Rename
                  </button>
                  <button
                    disabled={w.busy}
                    onClick={() => void w.remove(file)}
                    className="border rounded px-2 py-1 text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {w.hasMore && (
            <button
              disabled={w.busy}
              onClick={() => void w.more()}
              className="border rounded px-3 py-2"
            >
              Load more files
            </button>
          )}
          {!w.busy && w.files.length === 0 && (
            <p className="text-sm">
              No cloud workbooks loaded. Create a file, recover local work, or
              retry the connection.
            </p>
          )}
          <button
            disabled={w.busy}
            onClick={() => void w.run(w.refresh)}
            className="border rounded px-3 py-2"
          >
            Refresh files
          </button>
        </section>
      )}
    </div>
  );
}
