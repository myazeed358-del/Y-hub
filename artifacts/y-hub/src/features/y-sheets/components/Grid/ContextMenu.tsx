import React, { useEffect } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Combine,
  Eraser,
} from 'lucide-react';

interface Props {
  x: number;
  y: number;
  row: number;
  col: number;
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ x, y, row, col, onClose }) => {
  const {
    activeSheet,
    clipboard,
    cutSelection,
    copySelection,
    pasteSelection,
    clearSelection,
    toggleMergeSelection,
    dispatch,
  } = useWorkbook();

  useEffect(() => {
    const handleOutsideClick = (): void => onClose();
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [onClose]);

  const handleInsertRow = (before: boolean): void => {
    dispatch({
      type: 'INSERT_ROW',
      payload: { sheetId: activeSheet.id, row, before },
    });
    onClose();
  };

  const handleDeleteRow = (): void => {
    dispatch({
      type: 'DELETE_ROW',
      payload: { sheetId: activeSheet.id, row },
    });
    onClose();
  };

  const handleInsertCol = (before: boolean): void => {
    dispatch({
      type: 'INSERT_COL',
      payload: { sheetId: activeSheet.id, col, before },
    });
    onClose();
  };

  const handleDeleteCol = (): void => {
    dispatch({
      type: 'DELETE_COL',
      payload: { sheetId: activeSheet.id, col },
    });
    onClose();
  };

  // Adjust coordinates so menu doesn't overflow screen
  const menuWidth = 200;
  const menuHeight = 280;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      style={{ top: adjustedY, left: adjustedX }}
      className="fixed z-50 w-52 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-700 py-1.5 text-xs text-zinc-700 dark:text-zinc-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => { cutSelection(); onClose(); }}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-zinc-500" />
          <span>Cut</span>
        </div>
        <span className="text-[10px] text-zinc-400">Ctrl+X</span>
      </button>

      <button
        type="button"
        onClick={() => { copySelection(); onClose(); }}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
          <span>Copy</span>
        </div>
        <span className="text-[10px] text-zinc-400">Ctrl+C</span>
      </button>

      <button
        type="button"
        onClick={() => { pasteSelection(); onClose(); }}
        disabled={!clipboard}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between disabled:opacity-40"
      >
        <div className="flex items-center gap-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-zinc-500" />
          <span>Paste</span>
        </div>
        <span className="text-[10px] text-zinc-400">Ctrl+V</span>
      </button>

      <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

      <button
        type="button"
        onClick={() => handleInsertRow(true)}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
      >
        <ArrowUp className="w-3.5 h-3.5 text-zinc-500" />
        <span>Insert Row Above</span>
      </button>

      <button
        type="button"
        onClick={() => handleInsertRow(false)}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
      >
        <ArrowDown className="w-3.5 h-3.5 text-zinc-500" />
        <span>Insert Row Below</span>
      </button>

      <button
        type="button"
        onClick={handleDeleteRow}
        className="w-full px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete Row</span>
      </button>

      <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

      <button
        type="button"
        onClick={() => handleInsertCol(true)}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-zinc-500" />
        <span>Insert Column Left</span>
      </button>

      <button
        type="button"
        onClick={() => handleInsertCol(false)}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
      >
        <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
        <span>Insert Column Right</span>
      </button>

      <button
        type="button"
        onClick={handleDeleteCol}
        className="w-full px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete Column</span>
      </button>

      <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

      <button
        type="button"
        onClick={() => { toggleMergeSelection(); onClose(); }}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
      >
        <Combine className="w-3.5 h-3.5 text-zinc-500" />
        <span>Merge / Unmerge</span>
      </button>

      <button
        type="button"
        onClick={() => { clearSelection(); onClose(); }}
        className="w-full px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 text-red-500"
      >
        <Eraser className="w-3.5 h-3.5" />
        <span>Clear Contents</span>
      </button>
    </div>
  );
};
