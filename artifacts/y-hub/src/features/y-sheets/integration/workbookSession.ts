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
  readonly coordinator: WorkbookSaveCoordinator;
  constructor(
    workbook: WorkbookData,
    private storage: HostStorageAdapter,
    private journal: RecoveryJournal,
    onStatus: (status: SaveStatus) => void,
    private recovered?: RecoveryEntry,
  ) {
    this.workbook = validateWorkbook(workbook);
    this.coordinator = new WorkbookSaveCoordinator(
      (wb) => storage.saveWorkbook(wb),
      onStatus,
      700,
      (wb) => {
        // Clear matching recovery data only after a successful save.
        journal.acknowledge(wb);
        if (
          JSON.stringify(validateWorkbook(this.workbook)) === JSON.stringify(wb)
        )
          this.localDirty = false;
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
    this.journal.write(this.workbook, checkpoint, this.draft);
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
    this.coordinator.dispose();
  }
}
