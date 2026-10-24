import { WORKBOOK_LIMITS } from '../../io/workbookValidation';
import React, { useEffect, useRef, useState } from 'react';
import type { WorkbookData } from '../../types/workbook';
import { replaceWorkbookContents } from '../../io/importIntoCurrentWorkbook';
import { useWorkbook } from '../../state/workbookContext';
import { exportWorkbookToXLSX, importWorkbookFromXLSX } from '../../io/xlsxAdapter';
import { exportSheetToCSV, importCSVToSheet } from '../../io/csvAdapter';
import { downloadWorkbookJSON, parseWorkbookJSON } from '../../io/localPersistence';
import { X, FileSpreadsheet, FileText, Download, Upload, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'export' | 'import';
}

export const ImportExportDialog: React.FC<Props> = ({ isOpen, onClose, defaultTab = 'export' }) => {
  const { workbook, activeSheet, dispatch, canExport, canEdit } = useWorkbook();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(defaultTab);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isOpen) { setActiveTab(defaultTab); setErrorMsg(''); }
  }, [isOpen, defaultTab]);
  const generation=useRef(0);
  useEffect(() => { if(!isOpen) generation.current++; return () => {generation.current++;}; },[isOpen]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyImport = (imported: WorkbookData): void => {
    if (!window.confirm(
      'Replace the contents of this workbook with the imported file?'
    )) return;

    dispatch({
      type: 'SET_WORKBOOK',
      payload: replaceWorkbookContents(workbook, imported),
    });
    onClose();
  };

  if (!isOpen) return null;

  const handleExportXLSX = async (): Promise<void> => {
    if (!canExport) { setErrorMsg('Export not permitted.'); return; }
    try {
      setLoading(true);
      await exportWorkbookToXLSX(workbook, `${workbook.name}.xlsx`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Export to XLSX failed.');
    } finally { setLoading(false); }
  };

  const handleExportCSV = (): void => {
    if (!canExport) { setErrorMsg('Export not permitted.'); return; }
    try {
      const csv = exportSheetToCSV(activeSheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSheet.name}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Export to CSV failed.');
    }
  };

  const handleExportJSON = (): void => {
    if (!canExport) { setErrorMsg('Export not permitted.'); return; }
    try {
      downloadWorkbookJSON(workbook);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Export to JSON failed.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canEdit) { setErrorMsg('Import not permitted.'); return; }

    const operation=++generation.current;
    const accept=(wb:WorkbookData) => { if(operation===generation.current) applyImport(wb); };
    setLoading(true);
    setErrorMsg('');

    try {
      if(file.size>WORKBOOK_LIMITS.bytes) throw new Error('File exceeds the 5 MiB limit.');
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const importedWb = await importWorkbookFromXLSX(buffer);
        accept(importedWb);
      } else if (extension === 'csv') {
        const text = await file.text();
        const importedSheet = importCSVToSheet(text, file.name.replace(/\.[^/.]+$/, ''));
        const newWb = {
          id: `wb-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          sheets: [importedSheet],
          activeSheetId: importedSheet.id,
          version: 1,
        };
        accept(newWb);
      } else if (extension === 'json') {
        const text = await file.text();
        const importedWb = parseWorkbookJSON(text);
        accept(importedWb);
      } else {
        setErrorMsg('Unsupported file format. Please upload .xlsx, .csv, or .json.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to import spreadsheet file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-5 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 font-semibold text-base">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            File Operations (Import & Export)
          </div>
          <button disabled={loading} onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

<p className="text-xs mt-3">Excel: values, formulas, merges, dimensions and basic number formats. Fonts, colors, charts, macros, validation and conditional formats are not preserved in Excel files. Use JSON for full Y-Sheets formatting. Import only files you trust. Limits: 5 MiB, 32 sheets, 10,000 rows, 256 columns and 50,000 populated cells.</p>

        <a href={`${import.meta.env.BASE_URL}licenses/y-sheets-third-party.txt`} target="_blank" rel="noopener noreferrer" className="text-xs underline">Spreadsheet library licenses</a>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-700 mt-3">
          <button
            onClick={() => { setActiveTab('export'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Export Workbook
          </button>
          <button
            onClick={() => { setActiveTab('import'); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Import File
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 mt-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Export */}
        {activeTab === 'export' && !canExport ? (
          <p role="alert" className="p-4 text-sm">
            Export is not permitted for this session.
          </p>
        ) : activeTab === 'import' && !canEdit ? (
          <p role="alert" className="p-4 text-sm">
            Import is not permitted in read-only mode.
          </p>
        ) : activeTab === 'export' ? (
          <div className="py-4 space-y-3">
            <button type="button" disabled={loading} onClick={() => void handleExportXLSX()}
              className="flex w-full text-left items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                    Microsoft Excel (.xlsx)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Exports all sheets ({workbook.sheets.length}), values, and formulas
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600" />
            </button>

            <button type="button" disabled={loading}
              onClick={handleExportCSV}
              className="flex w-full text-left items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                    Comma Separated Values (.csv)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Exports active worksheet "{activeSheet.name}" in RFC 4180 format
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600" />
            </button>

            <button type="button" disabled={loading}
              onClick={handleExportJSON}
              className="flex w-full text-left items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                    Y-Sheets Backup (.ysheet.json)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Full lossless backup of styling, validations, and conditional rules
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600" />
            </button>
          </div>
        ) : (
          /* Tab 2: Import */
          <div className="py-4 space-y-4">
            <div role="button" tabIndex={loading ? -1 : 0} aria-label="Choose a spreadsheet file" aria-disabled={loading}
              onKeyDown={event => { if (!loading && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInputRef.current?.click(); } }}
              onClick={() => { if (!loading) fileInputRef.current?.click(); }}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition bg-zinc-50/50 dark:bg-zinc-900/50"
            >
              <Upload className="w-8 h-8 text-emerald-600" />
              <div className="text-center">
                <p className="text-sm font-semibold">Click to browse or drop file here</p>
                <p className="text-xs text-zinc-400 mt-1">Supports .xlsx, .xls, .csv, and .json</p>
              </div>
              <input
                disabled={loading} ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {loading && (
              <div className="text-center text-xs text-zinc-500 animate-pulse">
                Parsing spreadsheet file...
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            disabled={loading} onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
