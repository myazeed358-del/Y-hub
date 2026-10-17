import { WorkbookData } from '../types/workbook';

const STORAGE_KEY_PREFIX = 'y_sheets_workbook_';
const METADATA_KEY = 'y_sheets_workbooks_metadata';

export interface WorkbookMetadata {
  id: string;
  name: string;
  updatedAt: string;
}

/**
 * Saves workbook to localStorage
 */
export function saveWorkbookLocally(workbook: WorkbookData): void {
  try {
    const serialized = JSON.stringify(workbook);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${workbook.id}`, serialized);

    // Update metadata list
    const metadataList = listSavedWorkbooks();
    const existingIndex = metadataList.findIndex((m) => m.id === workbook.id);
    const entry: WorkbookMetadata = {
      id: workbook.id,
      name: workbook.name,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      metadataList[existingIndex] = entry;
    } else {
      metadataList.unshift(entry);
    }

    localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
  } catch (err) {
    console.warn('LocalStorage save failed (storage full or unavailable):', err);
  }
}

/**
 * Loads a workbook by id from localStorage, or the most recent workbook
 */
export function loadWorkbookLocally(id?: string): WorkbookData | null {
  try {
    let targetId = id;
    if (!targetId) {
      const list = listSavedWorkbooks();
      if (list.length === 0) return null;
      targetId = list[0]?.id;
    }

    if (!targetId) return null;

    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${targetId}`);
    if (!data) return null;

    return JSON.parse(data) as WorkbookData;
  } catch (err) {
    console.error('Failed to load workbook from localStorage:', err);
    return null;
  }
}

/**
 * Lists all saved workbooks in localStorage
 */
export function listSavedWorkbooks(): WorkbookMetadata[] {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkbookMetadata[];
  } catch {
    return [];
  }
}

/**
 * Exports workbook as a downloaded JSON file
 */
export function downloadWorkbookJSON(workbook: WorkbookData): void {
  const jsonStr = JSON.stringify(workbook, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${workbook.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.ysheet.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports a workbook from a JSON string
 */
export function parseWorkbookJSON(jsonText: string): WorkbookData {
  const parsed = JSON.parse(jsonText);
  if (!parsed.sheets || !Array.isArray(parsed.sheets) || !parsed.activeSheetId) {
    throw new Error('Invalid Y-Sheets workbook JSON file format.');
  }
  return parsed as WorkbookData;
}
