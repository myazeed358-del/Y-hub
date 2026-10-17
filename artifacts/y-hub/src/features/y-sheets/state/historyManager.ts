import { WorkbookData } from '../types/workbook';

export class HistoryManager {
  private past: WorkbookData[] = [];
  private present: WorkbookData;
  private future: WorkbookData[] = [];
  private maxDepth: number;

  constructor(initial: WorkbookData, maxDepth = 50) {
    this.present = initial;
    this.maxDepth = maxDepth;
  }

  public getPresent(): WorkbookData {
    return this.present;
  }

  public pushState(newState: WorkbookData): void {
    // Only push if different version or content
    this.past.push(this.present);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.present = {
      ...newState,
      version: this.present.version + 1,
    };
    this.future = [];
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(): WorkbookData | null {
    if (!this.canUndo()) return null;
    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  public redo(): WorkbookData | null {
    if (!this.canRedo()) return null;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  public reset(state: WorkbookData): void {
    this.past = [];
    this.present = state;
    this.future = [];
  }
}
