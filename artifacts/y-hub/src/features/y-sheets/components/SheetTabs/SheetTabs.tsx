import React, { useState, useRef, useEffect } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { Plus, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';

export const SheetTabs: React.FC = () => {
  const { workbook, dispatch } = useWorkbook();
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ sheetId: string; x: number; y: number } | null>(null);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSheetId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSheetId]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (): void => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleStartRename = (sheetId: string, currentName: string): void => {
    setEditingSheetId(sheetId);
    setEditName(currentName);
    setContextMenu(null);
  };

  const handleCommitRename = (): void => {
    if (editingSheetId && editName.trim()) {
      dispatch({
        type: 'RENAME_SHEET',
        payload: {
          sheetId: editingSheetId,
          newName: editName.trim(),
        },
      });
    }
    setEditingSheetId(null);
  };

  const handleAddSheet = (): void => {
    dispatch({ type: 'ADD_SHEET' });
  };

  const handleDeleteSheet = (sheetId: string): void => {
    if (workbook.sheets.length <= 1) return;
    if (confirm('Delete this sheet? This cannot be undone.')) {
      dispatch({ type: 'DELETE_SHEET', payload: sheetId });
    }
    setContextMenu(null);
  };

  const handleMoveSheet = (index: number, direction: 'left' | 'right'): void => {
    const toIndex = direction === 'left' ? index - 1 : index + 1;
    if (toIndex >= 0 && toIndex < workbook.sheets.length) {
      dispatch({
        type: 'REORDER_SHEETS',
        payload: { fromIndex: index, toIndex },
      });
    }
    setContextMenu(null);
  };

  const scrollTabs = (offset: number): void => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += offset;
    }
  };

  return (
    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 select-none">
      {/* Scroll left */}
      <button
        type="button"
        onClick={() => scrollTabs(-100)}
        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
        title="Scroll tabs left"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Tabs list */}
      <div
        ref={tabsContainerRef}
        className="flex items-center flex-1 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {workbook.sheets.map((sheet) => {
          const isActive = sheet.id === workbook.activeSheetId;

          return (
            <div
              key={sheet.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SHEET', payload: sheet.id })}
              onDoubleClick={() => handleStartRename(sheet.id, sheet.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ sheetId: sheet.id, x: e.clientX, y: e.clientY });
              }}
              className={`flex items-center gap-1.5 px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 cursor-pointer transition min-w-[100px] justify-between group ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 font-bold text-emerald-700 dark:text-emerald-400 border-b-2 border-b-emerald-600 shadow-sm'
                  : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              {editingSheetId === sheet.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  aria-label="Worksheet name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') setEditingSheetId(null);
                  }}
                  className="w-20 px-1 py-0.5 bg-zinc-50 dark:bg-zinc-900 border border-emerald-500 rounded text-xs outline-none"
                />
              ) : (
                <span className="truncate">{sheet.name}</span>
              )}

              {/* Context menu icon on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ sheetId: sheet.id, x: rect.left, y: rect.top });
                }}
                aria-label={`Options for worksheet ${sheet.name}`}
                className="ys-sheet-options opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded transition"
              >
                <MoreVertical className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Scroll right */}
      <button
        type="button"
        onClick={() => scrollTabs(100)}
        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
        title="Scroll tabs right"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Add Sheet (+) Button */}
      <button
        type="button"
        onClick={handleAddSheet}
        className="flex items-center gap-1 px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-l border-zinc-200 dark:border-zinc-800 font-medium transition"
        title="Insert New Sheet"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Add Sheet</span>
      </button>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y - 120, left: Math.min(contextMenu.x, window.innerWidth - 180) }}
          className="fixed z-50 w-44 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const sheet = workbook.sheets.find((s) => s.id === contextMenu.sheetId);
            const index = workbook.sheets.findIndex((s) => s.id === contextMenu.sheetId);
            if (!sheet) return null;

            return (
              <>
                <button
                  type="button"
                  onClick={() => handleStartRename(sheet.id, sheet.name)}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Rename
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveSheet(index, 'left')}
                  disabled={index === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Move Left
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveSheet(index, 'right')}
                  disabled={index === workbook.sheets.length - 1}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-40"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Move Right
                </button>

                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                <button
                  type="button"
                  onClick={() => handleDeleteSheet(sheet.id)}
                  disabled={workbook.sheets.length <= 1}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-2 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
