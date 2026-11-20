import { isConflict, WorkbookStorageError } from './storageErrors';
import type { WorkbookData } from '../types/workbook';

export type SaveStatus =
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'error'
  | 'conflict';

export class WorkbookSaveCoordinator {
  private pending: WorkbookData | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private blocked = false;
  private disposed = false;
  private networkFailure = false;
  private currentStatus: SaveStatus = 'saved';

  constructor(
    private readonly save: (workbook: WorkbookData) => Promise<void>,
    private readonly onStatus: (status: SaveStatus) => void,
    private readonly debounceMs = 700,
    private readonly onSaved: (workbook: WorkbookData) => void = () => {},
  ) {}

  get status(): SaveStatus {
    return this.currentStatus;
  }

  get canRetryAfterReconnect(): boolean {
    return !this.disposed && !this.blocked && !this.running && this.pending !== null &&
      this.currentStatus === 'error' && this.networkFailure;
  }

  get hasUnsavedChanges(): boolean {
    return this.pending !== null ||
      this.running !== null ||
      this.currentStatus !== 'saved';
  }

  private setStatus(status: SaveStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      if (!this.disposed) this.onStatus(status);
    }
  }

  enqueue(workbook: WorkbookData): void {
    if (this.disposed) throw new Error('Save coordinator disposed.');
    this.pending = structuredClone(workbook);

    if (this.blocked) return;

    this.setStatus('unsaved');
    this.clearTimer();

    this.timer = setTimeout(() => {
      void this.flush().catch(() => {
        // Failure is represented by status and retained pending data.
      });
    }, this.debounceMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async persist(workbook: WorkbookData): Promise<void> {
    // Retry temporary network issues, but leave conflicts for the user.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.save(workbook);
        return;
      } catch (error) {
        const conflict = isConflict(error);

        if (this.disposed || conflict || (error instanceof WorkbookStorageError && error.kind !== 'network') || attempt === 2) {
          throw error;
        }

        await new Promise<void>(resolve => {
          setTimeout(resolve, 500 * 2 ** attempt);
        });
      }
    }
  }

  private async drain(): Promise<void> {
    while (this.pending !== null && !this.disposed) {
      const snapshot = this.pending;
      this.pending = null;
      this.networkFailure = false;
      this.setStatus('saving');

      try {
        await this.persist(snapshot);
        this.onSaved(snapshot);
      } catch (error) {
        // Preserve newer edits rather than replacing them.
        if (!this.disposed) this.pending ??= snapshot;

        const conflict = isConflict(error);
        this.networkFailure = error instanceof WorkbookStorageError && error.kind === 'network';

        if (conflict) this.blocked = true;

        this.setStatus(conflict ? 'conflict' : 'error');
        throw error;
      }
    }

    this.setStatus('saved');
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    this.clearTimer();
  }

  flush(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Save coordinator disposed.'));
    this.clearTimer();

    if (this.blocked) {
      return Promise.reject(
        new Error('Workbook conflict requires reconciliation.')
      );
    }

    // Reuse the active save instead of starting another one.
    if (this.running) return this.running;
    if (!this.pending) return Promise.resolve();

    const operation = this.drain();
    this.running = operation;

    void operation.then(
      () => { this.running = null; },
      () => { this.running = null; },
    );

    return operation;
  }
}
