import { canPerformWorkbookAction } from './workbookPermissions';
import type { HostPermissions } from '../integration/hostContract';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { WorkbookData } from '../types/workbook';
import { WorksheetData, cellCoordToKey, keyToCellCoord } from '../types/sheet';
import { CellPosition, CellRange, CellStyle, CellData, NumberFormatType } from '../types/cell';
import { WorkbookAction } from './workbookActions';
import { workbookReducer } from './workbookReducer';
import { HistoryManager } from './historyManager';
import { createDefaultWorkbook } from './defaultWorkbook';

export interface ClipboardData {
  range: CellRange;
  cells: Record<string, CellData>;
  isCut?: boolean;
  sheetId: string;
}

export interface WorkbookContextType {
  workbook: WorkbookData;
  activeSheet: WorksheetData;
  activeCell: CellPosition;
  selection: CellRange;
  editingCell: { position: CellPosition; initialValue: string } | null;
  clipboard: ClipboardData | null;
  theme: 'light' | 'dark';
  canExport: boolean;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Navigation and selection
  setActiveCell: (pos: CellPosition, extendSelection?: boolean) => void;
  setSelection: (range: CellRange) => void;
  startEditing: (pos?: CellPosition, initialValue?: string) => void;
  stopEditing: (saveValue?: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Actions
  dispatch: (action: WorkbookAction, pushHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  clearSelection: () => void;

  // Formatting shortcuts
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  setFontSize: (size: number) => void;
  setTextColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setHorizontalAlign: (align: 'left' | 'center' | 'right') => void;
  setNumberFormat: (format: NumberFormatType, decimals?: number) => void;
  applyBorders: (type: 'all' | 'outside' | 'top' | 'bottom' | 'left' | 'right' | 'none') => void;
  toggleMergeSelection: () => void;
}

const WorkbookContext = createContext<WorkbookContextType | null>(null);

export interface WorkbookProviderProps {
  children: React.ReactNode;
  initialWorkbook?: WorkbookData;
  theme?: 'light' | 'dark';
  onWorkbookChange?: (wb: WorkbookData) => void;
  canEdit?: boolean;
  permissions?: HostPermissions;
}

export const WorkbookProvider: React.FC<WorkbookProviderProps> = ({
  children,
  initialWorkbook,
  theme: initialTheme = 'light',
  onWorkbookChange,
  canEdit = true,
  permissions,
}) => {
  const initialData = initialWorkbook || createDefaultWorkbook();
  const historyRef = useRef<HistoryManager>(new HistoryManager(initialData));

  const [workbook, setWorkbook] = useState<WorkbookData>(initialData);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [activeCell, setActiveCellState] = useState<CellPosition>({ row: 0, col: 0 });
  const [selection, setSelection] = useState<CellRange>({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
  const [editingCell, setEditingCell] = useState<{ position: CellPosition; initialValue: string } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  // Active sheet lookup
  const activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0]!;

  // Notify the host only when workbook state actually changes.
  // Never persist on initial mount or on unrelated rerenders.
  const lastNotifiedWorkbookRef = useRef(workbook);
  const onWorkbookChangeRef = useRef(onWorkbookChange);
  const canEditRef = useRef(canEdit);

  onWorkbookChangeRef.current = onWorkbookChange;
  canEditRef.current = canEdit;

  useEffect(() => {
    if (lastNotifiedWorkbookRef.current === workbook) return;

    lastNotifiedWorkbookRef.current = workbook;

    if (canEditRef.current) {
      onWorkbookChangeRef.current?.(workbook);
    }
  }, [workbook]);

  const dispatch = useCallback((action: WorkbookAction, pushHistory = true) => {
    if (!canEdit || !canPerformWorkbookAction(action, permissions ?? {
      canEdit: true,
      canCreateSheet: true,
      canDeleteSheet: true,
      canFormat: true,
    })) return;
    setWorkbook((prevWb) => {
      const nextWb = workbookReducer(prevWb, action);
      if (pushHistory) {
        historyRef.current.pushState(nextWb);
      }
      return nextWb;
    });
  }, [canEdit, permissions]);

  const undo = useCallback(() => {
    if (!canEdit) return;
    const prev = historyRef.current.undo();
    if (prev) {
      setWorkbook(prev);
    }
  }, []);

  const redo = useCallback(() => {
    if (!canEdit) return;
    const next = historyRef.current.redo();
    if (next) {
      setWorkbook(next);
    }
  }, []);

  const setActiveCell = useCallback((pos: CellPosition, extendSelection = false) => {
    // Clamp to bounds
    const row = Math.max(0, Math.min(pos.row, activeSheet.rowCount - 1));
    const col = Math.max(0, Math.min(pos.col, activeSheet.colCount - 1));

    setActiveCellState({ row, col });

    if (extendSelection) {
      setSelection((prev) => ({
        ...prev,
        endRow: row,
        endCol: col,
      }));
    } else {
      setSelection({
        startRow: row,
        startCol: col,
        endRow: row,
        endCol: col,
      });
    }
  }, [activeSheet.rowCount, activeSheet.colCount]);

  const startEditing = useCallback((pos?: CellPosition, initialValue?: string) => {
    if (!canEdit) return;
    const targetPos = pos || activeCell;
    const key = cellCoordToKey(targetPos.row, targetPos.col);
    const cell = activeSheet.cells[key];
    const val = initialValue !== undefined ? initialValue : (cell?.raw ?? '');
    setEditingCell({ position: targetPos, initialValue: val });
  }, [activeCell, activeSheet.cells, canEdit]);

  const stopEditing = useCallback((saveValue?: string) => {
    if (editingCell && saveValue !== undefined) {
      dispatch({
        type: 'SET_CELL_RAW',
        payload: {
          sheetId: activeSheet.id,
          row: editingCell.position.row,
          col: editingCell.position.col,
          raw: saveValue,
        },
      });
    }
    setEditingCell(null);
  }, [editingCell, activeSheet.id, dispatch]);

  const copySelection = useCallback(() => {
    const cellsToCopy: Record<string, CellData> = {};
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    const tsvRows: string[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const rowValues: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const key = cellCoordToKey(r, c);
        const cell = activeSheet.cells[key];
        if (cell) {
          cellsToCopy[`${r - minRow},${c - minCol}`] = cell;
          rowValues.push(cell.raw);
        } else {
          rowValues.push('');
        }
      }
      tsvRows.push(rowValues.join('\t'));
    }

    setClipboard({
      range: selection,
      cells: cellsToCopy,
      sheetId: activeSheet.id,
      isCut: false,
    });

    // Write to system clipboard if permitted
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(tsvRows.join('\n')).catch(() => {});
      }
    } catch {
      // Ignore clipboard API security blocks
    }
  }, [selection, activeSheet]);

  const cutSelection = useCallback(() => {
    if (!canEdit) return;
    copySelection();
    setClipboard((prev) => (prev ? { ...prev, isCut: true } : null));
  }, [copySelection, canEdit]);

  const pasteSelection = useCallback(async () => {
    if (!canEdit) return;
    if (!clipboard) return;

    const minRow = Math.min(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);

    const updates: Array<{ row: number; col: number; raw: string }> = [];

    for (const [relKey, cellData] of Object.entries(clipboard.cells)) {
      const coord = keyToCellCoord(relKey);
      const targetRow = minRow + coord.row;
      const targetCol = minCol + coord.col;

      if (targetRow < activeSheet.rowCount && targetCol < activeSheet.colCount) {
        updates.push({
          row: targetRow,
          col: targetCol,
          raw: cellData.raw,
        });
      }
    }

    if (clipboard.isCut) {
      // Clear original cut cells
      const origMinR = Math.min(clipboard.range.startRow, clipboard.range.endRow);
      const origMaxR = Math.max(clipboard.range.startRow, clipboard.range.endRow);
      const origMinC = Math.min(clipboard.range.startCol, clipboard.range.endCol);
      const origMaxC = Math.max(clipboard.range.startCol, clipboard.range.endCol);

      for (let r = origMinR; r <= origMaxR; r++) {
        for (let c = origMinC; c <= origMaxC; c++) {
          updates.push({ row: r, col: c, raw: '' });
        }
      }
      setClipboard(null);
    }

    dispatch({
      type: 'SET_CELLS_BATCH',
      payload: {
        sheetId: activeSheet.id,
        updates,
      },
    });
  }, [clipboard, selection, activeSheet, dispatch, canEdit]);

  const clearSelection = useCallback(() => {
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    const updates: Array<{ row: number; col: number; raw: string }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        updates.push({ row: r, col: c, raw: '' });
      }
    }

    dispatch({
      type: 'SET_CELLS_BATCH',
      payload: {
        sheetId: activeSheet.id,
        updates,
      },
    });
  }, [selection, activeSheet.id, dispatch]);

  // Formatting helpers
  const activeCellKey = cellCoordToKey(activeCell.row, activeCell.col);
  const activeCellStyle = activeSheet.cells[activeCellKey]?.style || {};

  const toggleBold = useCallback(() => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { bold: !activeCellStyle.bold },
      },
    });
  }, [activeSheet.id, selection, activeCellStyle.bold, dispatch]);

  const toggleItalic = useCallback(() => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { italic: !activeCellStyle.italic },
      },
    });
  }, [activeSheet.id, selection, activeCellStyle.italic, dispatch]);

  const toggleUnderline = useCallback(() => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { underline: !activeCellStyle.underline },
      },
    });
  }, [activeSheet.id, selection, activeCellStyle.underline, dispatch]);

  const setFontSize = useCallback((fontSize: number) => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { fontSize },
      },
    });
  }, [activeSheet.id, selection, dispatch]);

  const setTextColor = useCallback((textColor: string) => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { textColor },
      },
    });
  }, [activeSheet.id, selection, dispatch]);

  const setBackgroundColor = useCallback((backgroundColor: string) => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { backgroundColor },
      },
    });
  }, [activeSheet.id, selection, dispatch]);

  const setHorizontalAlign = useCallback((horizontalAlign: 'left' | 'center' | 'right') => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { horizontalAlign },
      },
    });
  }, [activeSheet.id, selection, dispatch]);

  const setNumberFormat = useCallback((numberFormat: NumberFormatType, decimalPlaces?: number) => {
    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: { numberFormat, decimalPlaces: decimalPlaces ?? activeCellStyle.decimalPlaces ?? 2 },
      },
    });
  }, [activeSheet.id, selection, activeCellStyle.decimalPlaces, dispatch]);

  const applyBorders = useCallback((type: 'all' | 'outside' | 'top' | 'bottom' | 'left' | 'right' | 'none') => {
    const borderObj = { style: 'thin' as const, color: '#374151' };
    let borderStyle: Partial<CellStyle> = {};

    switch (type) {
      case 'all':
        borderStyle = { borderTop: borderObj, borderBottom: borderObj, borderLeft: borderObj, borderRight: borderObj };
        break;
      case 'outside':
        // Handle perimeter
        break;
      case 'top':
        borderStyle = { borderTop: borderObj };
        break;
      case 'bottom':
        borderStyle = { borderBottom: borderObj };
        break;
      case 'left':
        borderStyle = { borderLeft: borderObj };
        break;
      case 'right':
        borderStyle = { borderRight: borderObj };
        break;
      case 'none':
        borderStyle = { borderTop: undefined, borderBottom: undefined, borderLeft: undefined, borderRight: undefined };
        break;
    }

    dispatch({
      type: 'FORMAT_CELLS',
      payload: {
        sheetId: activeSheet.id,
        range: selection,
        style: borderStyle,
      },
    });
  }, [activeSheet.id, selection, dispatch]);

  const toggleMergeSelection = useCallback(() => {
    // Check if selection is already merged
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    const isMerged = activeSheet.mergedCells.some(
      (m) => m.startRow === minRow && m.startCol === minCol && m.endRow === maxRow && m.endCol === maxCol
    );

    if (isMerged) {
      dispatch({
        type: 'UNMERGE_CELLS',
        payload: {
          sheetId: activeSheet.id,
          range: selection,
        },
      });
    } else {
      dispatch({
        type: 'MERGE_CELLS',
        payload: {
          sheetId: activeSheet.id,
          range: selection,
        },
      });
    }
  }, [activeSheet, selection, dispatch]);

  const value: WorkbookContextType = {
    workbook,
    activeSheet,
    activeCell,
    selection,
    editingCell,
    clipboard,
    theme,
    canExport: permissions?.canExport === true,
    canEdit,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    setActiveCell,
    setSelection,
    startEditing,
    stopEditing,
    setTheme,
    dispatch,
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteSelection,
    clearSelection,
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
  };

  return <WorkbookContext.Provider value={value}>{children}</WorkbookContext.Provider>;
};

export const useWorkbook = (): WorkbookContextType => {
  const context = useContext(WorkbookContext);
  if (!context) {
    throw new Error('useWorkbook must be used within a WorkbookProvider');
  }
  return context;
};
