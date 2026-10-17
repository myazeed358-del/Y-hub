import { WorkbookData } from '../types/workbook';

export interface HostUser {
  id: string;
  name: string;
  email?: string;
  role?: 'student' | 'instructor' | 'admin' | string;
  avatarUrl?: string;
}

export interface HostPermissions {
  canEdit?: boolean;
  canExport?: boolean;
  canCreateSheet?: boolean;
  canDeleteSheet?: boolean;
  canFormat?: boolean;
}

export interface HostStorageAdapter {
  loadWorkbook(id: string): Promise<WorkbookData>;
  saveWorkbook(workbook: WorkbookData): Promise<void>;
  listWorkbooks?(): Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  createWorkbook?(name: string): Promise<WorkbookData>;
}

export type HostTheme = 'light' | 'dark' | 'system';

export interface HostTelemetryEvent {
  eventName: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface YSheetsIntegrationProps {
  user?: HostUser;
  permissions?: HostPermissions;
  theme?: HostTheme;
  locale?: string;
  workbookId?: string;
  initialWorkbook?: WorkbookData;
  storageAdapter?: HostStorageAdapter;
  onSave?: (workbook: WorkbookData) => Promise<void>;
  onChange?: (workbook: WorkbookData) => void;
  onError?: (error: Error) => void;
  onTelemetry?: (event: HostTelemetryEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}
