import { WorkbookData } from './workbook';

export interface HostUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  permissions?: string[]; // e.g. ['sheets:edit', 'sheets:export', 'sheets:delete']
}

export interface HostStorageAdapter {
  loadWorkbook(id: string): Promise<WorkbookData>;
  saveWorkbook(workbook: WorkbookData): Promise<void>;
  listWorkbooks?(): Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  createWorkbook?(name: string): Promise<WorkbookData>;
}

export type HostTheme = 'light' | 'dark' | 'system';

export interface HostPermissions {
  canEdit?: boolean;
  canExport?: boolean;
  canCreateSheet?: boolean;
  canDeleteSheet?: boolean;
  canFormat?: boolean;
}

export interface HostIntegrationProps {
  user?: HostUser;
  permissions?: HostPermissions;
  theme?: HostTheme;
  locale?: string;
  initialWorkbook?: WorkbookData;
  storageAdapter?: HostStorageAdapter;
  onSave?: (workbook: WorkbookData) => Promise<void>;
  onChange?: (workbook: WorkbookData) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}
