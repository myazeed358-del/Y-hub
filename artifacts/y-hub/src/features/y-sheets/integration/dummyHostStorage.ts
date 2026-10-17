import { HostStorageAdapter } from './hostContract';
import { WorkbookData } from '../types/workbook';
import { createDefaultWorkbook } from '../state/defaultWorkbook';

/**
 * In-memory Mock Host Storage Adapter simulating Y-Hub cloud storage
 */
export class InMemoryHostStorageAdapter implements HostStorageAdapter {
  private store = new Map<string, WorkbookData>();

  constructor(seedWorkbook?: WorkbookData) {
    const wb = seedWorkbook || createDefaultWorkbook();
    this.store.set(wb.id, wb);
  }

  public async loadWorkbook(id: string): Promise<WorkbookData> {
    // Simulate network delay
    await new Promise((res) => setTimeout(res, 80));
    const wb = this.store.get(id);
    if (!wb) {
      throw new Error(`Workbook with id "${id}" not found on host platform.`);
    }
    return JSON.parse(JSON.stringify(wb));
  }

  public async saveWorkbook(workbook: WorkbookData): Promise<void> {
    await new Promise((res) => setTimeout(res, 100));
    this.store.set(workbook.id, JSON.parse(JSON.stringify(workbook)));
  }

  public async listWorkbooks(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
    return Array.from(this.store.values()).map((wb) => ({
      id: wb.id,
      name: wb.name,
      updatedAt: new Date().toISOString(),
    }));
  }

  public async createWorkbook(name: string): Promise<WorkbookData> {
    const base = createDefaultWorkbook();
    const newWb: WorkbookData = {
      ...base,
      id: `yhub-wb-${Date.now()}`,
      name,
    };
    this.store.set(newWb.id, newWb);
    return newWb;
  }
}
