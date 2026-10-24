import React, { useState, useId, useRef, type ReactNode } from 'react';
import {
  Undo2, Redo2, Scissors, Copy, ClipboardPaste, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, DollarSign, Percent, Hash,
  Combine, ArrowDownAZ, ArrowUpZA, Filter, Search, Palette, CheckCircle,
  FolderOpen, Save, PlusCircle, Sun, Moon, Table2, FunctionSquare, Cloud, CloudAlert, Files, Download, ArrowLeft,
} from 'lucide-react';
import { useWorkbook } from '../../state/workbookContext';
import { createDefaultWorkbook } from '../../state/defaultWorkbook';
import { cellCoordToKey } from '../../types/sheet';
import { FindReplaceDialog } from '../Dialogs/FindReplaceDialog';
import { ConditionalFormatDialog } from '../Dialogs/ConditionalFormatDialog';
import { DataValidationDialog } from '../Dialogs/DataValidationDialog';
import { ImportExportDialog } from '../Dialogs/ImportExportDialog';
import { YSheetsBrandMark } from '../YSheetsBrandMark';
import type { WorkspaceChromeControls } from '../../integration/hostContract';

type RibbonTab = 'file' | 'home' | 'insert' | 'formulas' | 'data' | 'view';
const tabs: { id: RibbonTab; title: string }[] = [
  { id: 'file', title: 'File' },
  { id: 'home', title: 'Home' },
  { id: 'insert', title: 'Insert' },
  { id: 'formulas', title: 'Formulas' },
  { id: 'data', title: 'Data' },
  { id: 'view', title: 'View' },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ys-ribbon-group">
      <div className="ys-ribbon-actions">{children}</div>
      <span className="ys-ribbon-group-label">{label}</span>
    </div>
  );
}

function Action({ icon, label, onClick, selected = false, disabled = false }: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={selected ? 'ys-ribbon-action is-selected' : 'ys-ribbon-action'}
      title={label} aria-label={label} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {icon}
    </button>
  );
}

/** File operations remain delegated to the workspace and its guarded storage adapter. */
export const Toolbar: React.FC<{ onNewWorkbook?: () => void; chrome?: WorkspaceChromeControls }> = ({ onNewWorkbook, chrome }) => {
  const {
    workbook, activeSheet, activeCell, selection, canEdit, canUndo, canRedo, theme,
    undo, redo, cutSelection, copySelection, pasteSelection,
    toggleBold, toggleItalic, toggleUnderline, setFontSize, setTextColor,
    setBackgroundColor, setHorizontalAlign, setNumberFormat, applyBorders,
    toggleMergeSelection, setTheme, dispatch,
  } = useWorkbook();
  const [tab, setTab] = useState<RibbonTab>('home');
  const tabId = useId();
  const tabButtons = useRef<Partial<Record<RibbonTab, HTMLButtonElement | null>>>({});
  const ribbonRoot = useRef<HTMLDivElement>(null);
  const [findDialogOpen, setFindDialogOpen] = useState(false);
  const [condDialogOpen, setCondDialogOpen] = useState(false);
  const [valDialogOpen, setValDialogOpen] = useState(false);
  const [ioDialogOpen, setIoDialogOpen] = useState(false);
  const [ioDefaultTab, setIoDefaultTab] = useState<'export' | 'import'>('export');

  const key = cellCoordToKey(activeCell.row, activeCell.col);
  const style = activeSheet.cells[key]?.style || {};
  const handleNew = () => {
    if (onNewWorkbook) return onNewWorkbook();
    if (window.confirm('Create a new workbook? Unsaved changes will be replaced.')) {
      dispatch({ type: 'SET_WORKBOOK', payload: createDefaultWorkbook() });
    }
  };
  const importExport = (target: 'import' | 'export') => {
    setIoDefaultTab(target);
    setIoDialogOpen(true);
  };
  const sort = (direction: 'asc' | 'desc') => {
    dispatch({ type: 'SORT_RANGE', payload: {
      sheetId: activeSheet.id, range: selection, col: activeCell.col, direction, hasHeader: false,
    } });
  };
  const toggleFilter = () => {
    if (activeSheet.filter) {
      dispatch({ type: 'SET_FILTER', payload: { sheetId: activeSheet.id, filter: undefined } });
    } else {
      dispatch({ type: 'SET_FILTER', payload: {
        sheetId: activeSheet.id, filter: { range: selection, columns: {} },
      } });
    }
  };
  const fontSizes = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

  return (
    <div className="ys-ribbon" dir="ltr" ref={ribbonRoot}>
      <div className="ys-ribbon-titlebar">
        <YSheetsBrandMark size={38} className="ys-document-mark" />
        <div className="ys-document-identity">
          <span className="ys-document-product">Y-Sheets <span className="ys-document-by">by Y-Hub</span></span>
          <input type="text" aria-label="Workbook name" value={workbook.name} maxLength={200}
            readOnly={!canEdit}
            onChange={e => dispatch({ type: 'SET_WORKBOOK_NAME', payload: e.target.value })}
            className="ys-document-name" />
        </div>
        {chrome && (
          <div className="ys-ribbon-host-actions" role="group" aria-label="Workbook controls">
            <button type="button" className="ys-host-action" onClick={chrome.onMyFiles} disabled={chrome.busy}
              title="My Files" aria-label="My Files"><Files size={16}/><span>My Files</span></button>
            <span className="ys-save-chip" role="status" aria-live="polite" data-save-status={chrome.status}>
              {chrome.status === 'saved' ? <Cloud size={16}/> : <CloudAlert size={16}/>}
              <span>{chrome.status === 'saved' ? 'Saved' :
                chrome.status === 'saving' ? 'Saving…' :
                chrome.status === 'conflict' ? 'Save conflict' :
                chrome.status === 'error' ? 'Save failed' : 'Unsaved changes'}</span>
            </span>
            <button type="button" className="ys-host-action" disabled={chrome.busy}
              onClick={chrome.onRetry} title="Save or retry" aria-label="Save or retry"><Save size={16}/><span>Save</span></button>
            <button type="button" className="ys-host-action" onClick={chrome.onDownloadRecovery}
              title="Download Recovery Copy" aria-label="Download Recovery Copy"><Download size={16}/><span>Recovery</span></button>
            {(chrome.status === 'error' || chrome.status === 'conflict') && (
              <>
                <button type="button" className="ys-host-action" disabled={chrome.busy}
                  onClick={chrome.onSaveAsCopy} title="Save as new copy">Save as copy</button>
                <button type="button" className="ys-host-action" disabled={chrome.busy}
                  onClick={chrome.onKeepRecovery} title="Keep local recovery and return">Keep recovery</button>
              </>
            )}
            <button type="button" className="ys-host-action" disabled={chrome.busy}
              onClick={chrome.onReturnToHub} title="Back to Y-Hub" aria-label="Back to Y-Hub">
              <ArrowLeft size={16}/><span>Y-Hub</span>
            </button>
          </div>
        )}
        <button type="button" className="ys-theme-switch" title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          aria-label="Switch editor theme"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
      <div className="ys-ribbon-tabs" role="tablist" aria-label="Spreadsheet tools">
        {tabs.map(item => (
          <button key={item.id} role="tab" type="button"
            id={`${tabId}-${item.id}`} aria-controls={`${tabId}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            ref={node => { tabButtons.current[item.id] = node; }}
            onKeyDown={event => {
              const index = tabs.findIndex(t => t.id === item.id);
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              const id = tabs[next]!.id;
              setTab(id); tabButtons.current[id]?.focus();
            }}
            aria-selected={tab === item.id}
            className={tab === item.id ? 'ys-ribbon-tab is-active' : 'ys-ribbon-tab'}
            onClick={() => setTab(item.id)}>
            {item.title}
          </button>
        ))}
      </div>
      <div className="ys-ribbon-panel" role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`}>
        {tab === 'file' && (
          <>
            <Group label="Workbooks">
              <Action icon={<PlusCircle />} label="New workbook" onClick={handleNew} />
              <Action icon={<FolderOpen />} label="Import Excel or CSV" onClick={() => importExport('import')} />
              <Action icon={<Save />} label="Export workbook" onClick={() => importExport('export')} />
            </Group>
            <p className="ys-ribbon-hint">Cloud saving is managed by Y-Hub. Export a separate copy when needed.</p>
          </>
        )}
        {tab === 'home' && (
          <>
            <Group label="History">
              <Action icon={<Undo2 />} label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
              <Action icon={<Redo2 />} label="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} />
            </Group>
            <Group label="Clipboard">
              <Action icon={<Scissors />} label="Cut (Ctrl+X)" onClick={cutSelection} disabled={!canEdit} />
              <Action icon={<Copy />} label="Copy (Ctrl+C)" onClick={copySelection} />
              <Action icon={<ClipboardPaste />} label="Paste (Ctrl+V)" onClick={pasteSelection} disabled={!canEdit} />
            </Group>
            <Group label="Font">
              <select aria-label="Font size" value={style.fontSize || 11} disabled={!canEdit}
                onChange={e => setFontSize(parseInt(e.target.value, 10))} className="ys-ribbon-select">
                {fontSizes.map(size => <option key={size} value={size}>{size} pt</option>)}
              </select>
              <Action icon={<Bold />} label="Bold (Ctrl+B)" onClick={toggleBold} selected={!!style.bold} disabled={!canEdit} />
              <Action icon={<Italic />} label="Italic (Ctrl+I)" onClick={toggleItalic} selected={!!style.italic} disabled={!canEdit} />
              <Action icon={<Underline />} label="Underline (Ctrl+U)" onClick={toggleUnderline} selected={!!style.underline} disabled={!canEdit} />
              <label className="ys-ribbon-color" title="Text color">
                <span className="ys-ribbon-color-letter">A</span>
                <input type="color" aria-label="Text color" disabled={!canEdit} value={style.textColor || '#000000'}
                  onChange={e => setTextColor(e.target.value)} />
              </label>
              <label className="ys-ribbon-color" title="Fill color">
                <Palette size={17} />
                <input type="color" aria-label="Fill color" disabled={!canEdit} value={style.backgroundColor || '#ffffff'}
                  onChange={e => setBackgroundColor(e.target.value)} />
              </label>
            </Group>
            <Group label="Alignment">
              <Action icon={<AlignLeft />} label="Align left" onClick={() => setHorizontalAlign('left')}
                selected={!style.horizontalAlign || style.horizontalAlign === 'left'} disabled={!canEdit} />
              <Action icon={<AlignCenter />} label="Align center" onClick={() => setHorizontalAlign('center')}
                selected={style.horizontalAlign === 'center'} disabled={!canEdit} />
              <Action icon={<AlignRight />} label="Align right" onClick={() => setHorizontalAlign('right')}
                selected={style.horizontalAlign === 'right'} disabled={!canEdit} />
            </Group>
            <Group label="Number">
              <Action icon={<DollarSign />} label="Currency" onClick={() => setNumberFormat('currency')} disabled={!canEdit} />
              <Action icon={<Percent />} label="Percentage" onClick={() => setNumberFormat('percentage')} disabled={!canEdit} />
              <Action icon={<Hash />} label="Number" onClick={() => setNumberFormat('number')} disabled={!canEdit} />
            </Group>
            <Group label="Cells">
              <select aria-label="Cell borders" className="ys-ribbon-select" value=""
                disabled={!canEdit}
                onChange={e => {
                  const border = e.target.value;
                  if (border === 'all' || border === 'top' || border === 'bottom' || border === 'none') {
                    applyBorders(border);
                  }
                }}>
                <option value="" disabled>Borders</option>
                <option value="all">All borders</option>
                <option value="top">Top border</option>
                <option value="bottom">Bottom border</option>
                <option value="none">No borders</option>
              </select>
              <Action icon={<Combine />} label="Merge or unmerge cells" onClick={toggleMergeSelection} disabled={!canEdit} />
            </Group>
          </>
        )}
        {tab === 'insert' && (
          <>
            <Group label="Worksheets">
              <Action icon={<Table2 />} label="Add worksheet" disabled={!canEdit}
                onClick={() => dispatch({ type: 'ADD_SHEET' })} />
              <Action icon={<Combine />} label="Merge selected cells" disabled={!canEdit} onClick={toggleMergeSelection} />
            </Group>
            <p className="ys-ribbon-hint">Other insertion tools will be added in a later release.</p>
          </>
        )}
        {tab === 'formulas' && (
          <>
            <Group label="Formula helpers">
              <Action icon={<FunctionSquare />} label="Open formula entry" onClick={() => {
                const input = ribbonRoot.current?.closest('.y-sheets-root')?.querySelector<HTMLInputElement>('input[placeholder^="Enter a value"]');
                input?.focus();
              }} />
              <Action icon={<Search />} label="Find and replace" onClick={() => setFindDialogOpen(true)} />
            </Group>
            <p className="ys-ribbon-hint">Enter calculations in the formula bar below.</p>
          </>
        )}
        {tab === 'data' && (
          <>
            <Group label="Sort and filter">
              <Action icon={<ArrowDownAZ />} label="Sort ascending" onClick={() => sort('asc')} disabled={!canEdit} />
              <Action icon={<ArrowUpZA />} label="Sort descending" onClick={() => sort('desc')} disabled={!canEdit} />
              <Action icon={<Filter />} label="Toggle filter" onClick={toggleFilter}
                selected={!!activeSheet.filter} disabled={!canEdit} />
            </Group>
            <Group label="Data tools">
              <Action icon={<Search />} label="Find and replace" onClick={() => setFindDialogOpen(true)} />
              <Action icon={<Palette />} label="Conditional formatting" onClick={() => setCondDialogOpen(true)} disabled={!canEdit} />
              <Action icon={<CheckCircle />} label="Data validation" onClick={() => setValDialogOpen(true)} disabled={!canEdit} />
            </Group>
          </>
        )}
        {tab === 'view' && (
          <>
            <Group label="Appearance">
              <Action icon={theme === 'light' ? <Moon /> : <Sun />} label="Toggle light or dark editor"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
            </Group>
            <Group label="Navigation">
              <Action icon={<Search />} label="Find in workbook" onClick={() => setFindDialogOpen(true)} />
            </Group>
          </>
        )}
      </div>
      <FindReplaceDialog isOpen={findDialogOpen} onClose={() => setFindDialogOpen(false)} />
      <ConditionalFormatDialog isOpen={condDialogOpen} onClose={() => setCondDialogOpen(false)} />
      <DataValidationDialog isOpen={valDialogOpen} onClose={() => setValDialogOpen(false)} />
      <ImportExportDialog isOpen={ioDialogOpen} onClose={() => setIoDialogOpen(false)} defaultTab={ioDefaultTab} />
    </div>
  );
};
