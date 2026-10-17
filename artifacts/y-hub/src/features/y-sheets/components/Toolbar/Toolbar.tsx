import React, { useState } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { createDefaultWorkbook } from '../../state/defaultWorkbook';
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  Hash,
  Grid,
  Combine,
  ArrowDownAZ,
  ArrowUpZA,
  Filter,
  Search,
  Palette,
  CheckCircle,
  FolderOpen,
  Save,
  PlusCircle,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { FindReplaceDialog } from '../Dialogs/FindReplaceDialog';
import { ConditionalFormatDialog } from '../Dialogs/ConditionalFormatDialog';
import { DataValidationDialog } from '../Dialogs/DataValidationDialog';
import { ImportExportDialog } from '../Dialogs/ImportExportDialog';
import { cellCoordToKey } from '../../types/sheet';

export const Toolbar: React.FC = () => {
  const {
    workbook,
    activeSheet,
    activeCell,
    selection,
    canUndo,
    canRedo,
    theme,
    undo,
    redo,
    cutSelection,
    copySelection,
    pasteSelection,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    setFontSize,
    setTextColor,
    setBackgroundColor,
    setHorizontalAlign,
    setNumberFormat,
    applyBorders,
    toggleMergeSelection,
    setTheme,
    dispatch,
  } = useWorkbook();

  const [findDialogOpen, setFindDialogOpen] = useState(false);
  const [condDialogOpen, setCondDialogOpen] = useState(false);
  const [valDialogOpen, setValDialogOpen] = useState(false);
  const [ioDialogOpen, setIoDialogOpen] = useState(false);
  const [ioDefaultTab, setIoDefaultTab] = useState<'export' | 'import'>('export');
  const [showBorderMenu, setShowBorderMenu] = useState(false);

  const activeKey = cellCoordToKey(activeCell.row, activeCell.col);
  const activeStyle = activeSheet.cells[activeKey]?.style || {};

  const handleSort = (direction: 'asc' | 'desc'): void => {
    dispatch({
      type: 'SORT_RANGE',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        col: activeCell.col,
        direction,
        hasHeader: false,
      },
    });
  };

  const handleToggleFilter = (): void => {
    if (activeSheet.filter) {
      dispatch({ type: 'SET_FILTER', payload: { sheetId: activeSheet.id, filter: undefined } });
    } else {
      dispatch({
        type: 'SET_FILTER',
        payload: {
          sheetId: activeSheet.id,
          filter: {
            range: selection,
            columns: {},
          },
        },
      });
    }
  };

  const handleNewWorkbook = (): void => {
    if (confirm('Create a new workbook? Unsaved changes will be replaced.')) {
      dispatch({ type: 'SET_WORKBOOK', payload: createDefaultWorkbook() });
    }
  };

  const fontSizes = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 select-none">
      {/* Top Bar: Title & Primary Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              Y
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">Y-Sheets</span>
                <input
                  type="text"
                  value={workbook.name}
                  onChange={(e) => dispatch({ type: 'SET_WORKBOOK_NAME', payload: e.target.value })}
                  className="text-sm font-bold bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-emerald-500 rounded px-1 outline-none text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <span className="text-[10px] text-zinc-400 block px-1 -mt-0.5">
                Independent Spreadsheet Engine
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

          {/* File Operations */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewWorkbook}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
              title="New Workbook"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={() => { setIoDefaultTab('import'); setIoDialogOpen(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
              title="Import File"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Open</span>
            </button>

            <button
              type="button"
              onClick={() => { setIoDefaultTab('export'); setIoDialogOpen(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
              title="Save & Export"
            >
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Right side: Theme toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Main Ribbon Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto">
        {/* Undo / Redo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Clipboard */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={cutSelection}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Cut (Ctrl+X)"
          >
            <Scissors className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={copySelection}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={pasteSelection}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Font size */}
        <select
          value={activeStyle.fontSize || 11}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs outline-none cursor-pointer"
        >
          {fontSizes.map((sz) => (
            <option key={sz} value={sz}>{sz} pt</option>
          ))}
        </select>

        {/* Text styling */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleBold}
            className={`p-1.5 rounded transition ${
              activeStyle.bold
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleItalic}
            className={`p-1.5 rounded transition ${
              activeStyle.italic
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleUnderline}
            className={`p-1.5 rounded transition ${
              activeStyle.underline
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Color pickers */}
        <div className="flex items-center gap-1">
          <label className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center" title="Text Color">
            <span className="font-bold border-b-2 border-emerald-600 px-0.5 text-xs">A</span>
            <input
              type="color"
              value={activeStyle.textColor || '#000000'}
              onChange={(e) => setTextColor(e.target.value)}
              className="opacity-0 w-0 h-0 pointer-events-none"
            />
          </label>

          <label className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center" title="Fill Color">
            <Palette className="w-4 h-4 text-amber-500" />
            <input
              type="color"
              value={activeStyle.backgroundColor || '#ffffff'}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="opacity-0 w-0 h-0 pointer-events-none"
            />
          </label>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Alignment */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setHorizontalAlign('left')}
            className={`p-1.5 rounded ${
              activeStyle.horizontalAlign === 'left' || !activeStyle.horizontalAlign
                ? 'bg-zinc-100 dark:bg-zinc-800'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setHorizontalAlign('center')}
            className={`p-1.5 rounded ${
              activeStyle.horizontalAlign === 'center'
                ? 'bg-zinc-100 dark:bg-zinc-800'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setHorizontalAlign('right')}
            className={`p-1.5 rounded ${
              activeStyle.horizontalAlign === 'right'
                ? 'bg-zinc-100 dark:bg-zinc-800'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Number formatting */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setNumberFormat('currency')}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Format as Currency ($)"
          >
            <DollarSign className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setNumberFormat('percentage')}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Format as Percentage (%)"
          >
            <Percent className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setNumberFormat('number')}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Format as Number"
          >
            <Hash className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Borders Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBorderMenu(!showBorderMenu)}
            className="flex items-center gap-0.5 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Borders"
          >
            <Grid className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {showBorderMenu && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-50 py-1 text-xs">
              <button
                type="button"
                onClick={() => { applyBorders('all'); setShowBorderMenu(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                All Borders
              </button>
              <button
                type="button"
                onClick={() => { applyBorders('top'); setShowBorderMenu(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Top Border
              </button>
              <button
                type="button"
                onClick={() => { applyBorders('bottom'); setShowBorderMenu(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Bottom Border
              </button>
              <button
                type="button"
                onClick={() => { applyBorders('none'); setShowBorderMenu(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-red-600"
              >
                No Borders
              </button>
            </div>
          )}
        </div>

        {/* Merge Cells */}
        <button
          type="button"
          onClick={toggleMergeSelection}
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Merge / Unmerge Selected Cells"
        >
          <Combine className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Data Tools */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleSort('asc')}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Sort Range Ascending (A-Z)"
          >
            <ArrowDownAZ className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSort('desc')}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Sort Range Descending (Z-A)"
          >
            <ArrowUpZA className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleFilter}
            className={`p-1.5 rounded ${
              activeSheet.filter
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle Filter on Range"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setFindDialogOpen(true)}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Find and Replace (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCondDialogOpen(true)}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Conditional Formatting Rules"
          >
            <Palette className="w-4 h-4 text-purple-600" />
          </button>
          <button
            type="button"
            onClick={() => setValDialogOpen(true)}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Data Validation"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <FindReplaceDialog isOpen={findDialogOpen} onClose={() => setFindDialogOpen(false)} />
      <ConditionalFormatDialog isOpen={condDialogOpen} onClose={() => setCondDialogOpen(false)} />
      <DataValidationDialog isOpen={valDialogOpen} onClose={() => setValDialogOpen(false)} />
      <ImportExportDialog isOpen={ioDialogOpen} onClose={() => setIoDialogOpen(false)} defaultTab={ioDefaultTab} />
    </div>
  );
};
