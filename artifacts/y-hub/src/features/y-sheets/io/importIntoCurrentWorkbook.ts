import { validateWorkbook } from './workbookValidation';
import type { WorkbookData } from '../types/workbook';

export function replaceWorkbookContents(
  current: WorkbookData,
  imported: WorkbookData,
): WorkbookData {
  if (
    !Array.isArray(imported.sheets) ||
    imported.sheets.length === 0 ||
    !imported.sheets.some(sheet => sheet.id === imported.activeSheetId)
  ) {
    throw new Error('Imported workbook has invalid sheets.');
  }

  return validateWorkbook({
    ...imported,
    id: current.id,
    name: current.name,
    version: current.version + 1,
  });
}
