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
  private currentStatus: SaveStatus = 'saved';

  constructor(
    private readonly save: (workbook: WorkbookData) => Promise<void>,
    private readonly onStatus: (status: SaveStatus) => void,
    private readonly debounceMs = 700,
  ) {}

  get status(): SaveStatus {
    return this.currentStatus;
  }

  get hasUnsavedChanges(): boolean {
    return this.pending !== null ||
      this.running !== null ||
      this.currentStatus !== 'saved';
  }

  private setStatus(status: SaveStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.onStatus(status);
    }
  }

  enqueue(workbook: WorkbookData): void {
    this.pending = workbook;

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
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.save(workbook);
        return;
      } catch (error) {
        const conflict = String(error)
          .toLowerCase()
          .includes('conflict');

        if (conflict || attempt === 2) {
          throw error;
        }

        await new Promise<void>(resolve => {
          setTimeout(resolve, 500 * 2 ** attempt);
        });
      }
    }
  }

  private async drain(): Promise<void> {
    while (this.pending !== null) {
      const snapshot = this.pending;
      this.pending = null;
      this.setStatus('saving');

      try {
        await this.persist(snapshot);
      } catch (error) {
        // Preserve newer edits rather than replacing them.
        this.pending ??= snapshot;

        const conflict = String(error)
          .toLowerCase()
          .includes('conflict');

        if (conflict) this.blocked = true;

        this.setStatus(conflict ? 'conflict' : 'error');
        throw error;
      }
    }

    this.setStatus('saved');
  }

  flush(): Promise<void> {
    this.clearTimer();

    if (this.blocked) {
      return Promise.reject(
        new Error('Workbook conflict requires reconciliation.')
      );
    }

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
