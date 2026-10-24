import '../App.css';
import React, { useState, useEffect, useCallback } from 'react';
import { YSheetsIntegrationProps } from './hostContract';
import { WorkbookData } from '../types/workbook';
import { WorkbookProvider, useWorkbook } from '../state/workbookContext';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { FormulaBar } from '../components/FormulaBar/FormulaBar';
import { Grid } from '../components/Grid/Grid';
import { SheetTabs } from '../components/SheetTabs/SheetTabs';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { Loader2 } from 'lucide-react';

function WorkbookSurface({children,className,style}: {children:React.ReactNode;className:string;style?:React.CSSProperties}) {
  const {theme}=useWorkbook();
  return <div className={`y-sheets-root flex flex-col min-h-0 min-w-0 h-full w-full overflow-hidden bg-white dark:bg-zinc-950 font-sans ${theme==='dark' ? 'dark' : ''} ${className}`} style={style}>{children}</div>;
}

export const YSheetsHostAdapter: React.FC<YSheetsIntegrationProps> = ({
  user,
  chrome,
  permissions = { canEdit: false, canExport: false, canCreateSheet: false, canDeleteSheet: false, canFormat: false },
  theme = 'light',
  workbookId,
  initialWorkbook,
  storageAdapter,
  onSave,
  onRequestNewWorkbook,
  onChange,
  onDraftChange,
  onError,
  onTelemetry,
  className = '',
  style,
}) => {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(initialWorkbook || null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load workbook from host storage if workbookId & storageAdapter provided
  useEffect(() => {
    let isCancelled = false;

    const loadData = async (): Promise<void> => {
      if (storageAdapter && workbookId) {
        setLoading(true);
        setLoadError(null);
        try {
          const loaded = await storageAdapter.loadWorkbook(workbookId);
          if (!isCancelled) {
            setWorkbook(loaded);
            if (onTelemetry) {
              onTelemetry({
                eventName: 'workbook_loaded',
                payload: { id: loaded.id, sheetCount: loaded.sheets.length },
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (err: unknown) {
          if (!isCancelled) {
            const msg = err instanceof Error ? err.message : 'Failed to load workbook from host storage';
            setLoadError(msg);
            if (onError && err instanceof Error) onError(err);
          }
        } finally {
          if (!isCancelled) setLoading(false);
        }
      } else if (!workbook) {
        setWorkbook(initialWorkbook || createDefaultWorkbook());
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [workbookId, storageAdapter]);

  const handleWorkbookChange = useCallback((wb: WorkbookData): void => {
    if (onChange) {
      onChange(wb);
    }
    // The host save callback overrides direct storage persistence.
    // Never write the same change through both paths.
    const persist = onSave ??
      (storageAdapter
        ? (next: WorkbookData) => storageAdapter.saveWorkbook(next)
        : undefined);

    if (persist) {
      void persist(wb).catch((err: unknown) => {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });
    }
  }, [onChange, storageAdapter, onSave, onError]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system'
      ? window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <p className="text-sm font-medium">Loading Y-Sheets Workbook from Y-Hub...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-6 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-lg m-4">
        <p className="text-sm font-bold mb-2">Error loading workbook from host</p>
        <p className="text-xs mb-4">{loadError}</p>
        <p className="text-sm">
          The cloud workbook was not loaded. Return to My Files
          and retry. Your saved workbook has not been replaced.
        </p>
      </div>
    );
  }

  if (!workbook) return null;

  return (
    <ErrorBoundary onError={onError}>
        <WorkbookProvider
          key={workbook.id}
          initialWorkbook={workbook}
          canEdit={permissions.canEdit === true}
          permissions={permissions}
          theme={resolvedTheme}
          onWorkbookChange={handleWorkbookChange}
          onDraftChange={onDraftChange}
        >
          <WorkbookSurface className={className} style={style}>
          {/* The authenticated user is already represented by Y-Hub.
              Only show a restriction notice when editing is actually denied. */}
          {user && !permissions.canEdit && (
            <div className="ys-readonly-banner" role="status">
              Read-only workbook access
            </div>
          )}

          <Toolbar onNewWorkbook={onRequestNewWorkbook} chrome={chrome} />
          <FormulaBar />
          <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden flex flex-col">
            <Grid />
          </div>
          <SheetTabs />
          <StatusBar />
          </WorkbookSurface>
        </WorkbookProvider>
    </ErrorBoundary>
  );
};
