import { WorksheetData } from './sheet';

export interface WorkbookData {
  id: string;
  name: string;
  sheets: WorksheetData[];
  activeSheetId: string;
  version: number;
}
