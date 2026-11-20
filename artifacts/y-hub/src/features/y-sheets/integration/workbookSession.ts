import type { WorkbookData } from "../types/workbook";
import type { HostStorageAdapter } from "./hostContract";
import {
  RecoveryJournal,
  recoveryWorkbook,
  type PendingCellEdit,
  type RecoveryEntry,
} from "../io/recoveryJournal";
import { validateWorkbook } from "../io/workbookValidation";
import { WorkbookSaveCoordinator, type SaveStatus } from "./saveCoordinator";

/** One editor, one file. Its journal survives disposal, failed saves and account changes. */
export class WorkbookSession {
  workbook: WorkbookData;
  draft?: PendingCellEdit;
  private localDirty = false;
  private disposed = false;
  private base?: WorkbookData;
  readonly coordinator: WorkbookSaveCoordinator;
  constructor(
    workbook: WorkbookData,
    private storage: HostStorageAdapter,
    private journal: RecoveryJournal,
    onStatus: (status: SaveStatus) => void,
    private recovered?: RecoveryEntry,
  ) {
    this.workbook = validateWorkbook(workbook);
    this.base = recovered ? recovered.record.base : validateWorkbook(workbook);
    this.coordinator = new WorkbookSaveCoordinator(
      (wb) => storage.saveWorkbook(wb),
      onStatus,
      700,
      (wb) => {
        if (this.disposed) return;
        // Clear matching recovery data only after a successful save.
        journal.acknowledge(wb);
        if (
          JSON.stringify(validateWorkbook(this.workbook)) === JSON.stringify(wb)
        )
          this.localDirty = false;
        // Only an acknowledged server save can advance the merge base.
        this.base = validateWorkbook(wb);
        if (this.localDirty || this.draft) this.persistLocal();
        if (this.recovered) {
          journal.removeUnchanged(this.recovered);
          this.recovered = undefined;
        }
      },
    );
  }
  get dirty() {
    return (
      this.localDirty || !!this.draft || this.coordinator.hasUnsavedChanges
    );
  }
  private persistLocal() {
    const checkpoint = this.storage.checkpoint?.(this.workbook.id);
    if (!checkpoint)
      throw new Error("Missing save revision. Download a recovery copy.");
    this.journal.write(this.workbook, checkpoint, this.draft, this.base);
  }
  change(workbook: WorkbookData) {
    // Keep the in-memory edit even if validation or browser storage fails.
    this.workbook = workbook;
    this.localDirty = true;
    if (this.draft) {
      const { sheetId, row, col, raw } = this.draft;
      if (
        workbook.sheets.find((s) => s.id === sheetId)?.cells[`${row},${col}`]
          ?.raw === raw
      )
        this.draft = undefined;
    }
    this.persistLocal();
    const validated = validateWorkbook(workbook);
    this.coordinator.enqueue(validated);
  }
  editDraft(draft: PendingCellEdit | null) {
    this.draft = draft ?? undefined;
    this.persistLocal();
    if (!this.dirty) this.journal.acknowledge(this.workbook);
  }
  recoveryCopy(): WorkbookData {
    return recoveryWorkbook(this.workbook, this.draft);
  }

  get canResumeAfterReconnect() {
    return !this.draft && this.coordinator.canRetryAfterReconnect;
  }
  async resumeAfterReconnect() {
    if (this.canResumeAfterReconnect) await this.flush();
  }

  async flush() {
    if (this.draft)
      throw new Error(
        "Finish or cancel the current cell edit before switching files.",
      );
    if (!this.dirty) return;
    // Also recovers edits whose earlier local write failed (quota/private browsing).
    this.persistLocal();
    this.coordinator.enqueue(validateWorkbook(this.workbook));
    await this.coordinator.flush();
  }
  keepRecovery() {
    this.persistLocal();
  }
  dispose() {
    this.disposed = true;
    this.coordinator.dispose();
  }
}
