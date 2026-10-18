import React, { useState, useEffect, useRef } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { formatCellReference, formatRangeReference } from '../../engine/references';
import { cellCoordToKey } from '../../types/sheet';
import { Check, X } from 'lucide-react';

export const FormulaBar: React.FC = () => {
  const {
    activeCell,
    selection,
    activeSheet,
    dispatch,
    startEditing,
    reportDraft,
    canEdit,
  } = useWorkbook();

  const activeKey = cellCoordToKey(activeCell.row, activeCell.col);
  const activeCellData = activeSheet.cells[activeKey];
  const currentRaw = activeCellData?.raw || '';

  const [inputValue, setInputValue] = useState(currentRaw);
  const [isFocused, setIsFocused] = useState(false);
  const [showFxMenu, setShowFxMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(currentRaw);
    }
  }, [currentRaw, isFocused, activeCell]);

  const isMultiSelection =
    selection.startRow !== selection.endRow || selection.startCol !== selection.endCol;

  const addressLabel = isMultiSelection
    ? formatRangeReference(selection)
    : formatCellReference(activeCell.row, activeCell.col);

  const handleCommit = (): void => {
    dispatch({
      type: 'SET_CELL_RAW',
      payload: {
        sheetId: activeSheet.id,
        row: activeCell.row,
        col: activeCell.col,
        raw: inputValue,
      },
    });
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleCancel = (): void => {
    reportDraft(null);
    setInputValue(currentRaw);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const insertFunction = (funcName: string): void => {
    const newVal = `=${funcName}()`;
    setInputValue(newVal);
    setShowFxMenu(false);
    startEditing(activeCell, newVal);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(funcName.length + 2, funcName.length + 2);
      }
    }, 50);
  };

  const commonFunctions = [
    { name: 'SUM', desc: 'Adds all numbers in range' },
    { name: 'AVERAGE', desc: 'Calculates the average of numbers' },
    { name: 'IF', desc: 'Returns value based on condition' },
    { name: 'COUNT', desc: 'Counts cells with numbers' },
    { name: 'COUNTA', desc: 'Counts non-empty cells' },
    { name: 'MIN', desc: 'Returns minimum value' },
    { name: 'MAX', desc: 'Returns maximum value' },
    { name: 'ROUND', desc: 'Rounds number to specified decimals' },
    { name: 'ABS', desc: 'Absolute value' },
    { name: 'MOD', desc: 'Remainder after division' },
  ];

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-sm">
      {/* Name box */}
      <div className="flex items-center justify-center min-w-[70px] px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-semibold text-zinc-700 dark:text-zinc-200 select-none">
        {addressLabel}
      </div>

      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

      {/* fx button & menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowFxMenu(!showFxMenu)}
          title="Insert Function"
          className="flex items-center gap-1 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-serif italic font-bold"
        >
          <span className="text-sm">ƒx</span>
        </button>

        {showFxMenu && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 py-1 max-h-72 overflow-y-auto">
            <div className="px-3 py-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Insert Function
            </div>
            {commonFunctions.map((fn) => (
              <button
                key={fn.name}
                type="button"
                onClick={() => insertFunction(fn.name)}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs flex flex-col transition"
              >
                <span className="font-bold">{fn.name}</span>
                <span className="text-zinc-500 text-[11px]">{fn.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Commit & Cancel buttons when focused */}
      {isFocused && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={handleCommit}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
            title="Enter"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={handleCancel}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formula Input */}
      <div className="flex-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          readOnly={!canEdit}
          onChange={(e) => {
            setInputValue(e.target.value);
            reportDraft({sheetId:activeSheet.id,...activeCell,raw:e.target.value});
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { if (inputValue === currentRaw) setIsFocused(false); }}
          onKeyDown={handleKeyDown}
          placeholder="Enter a value or formula (=SUM, =AVERAGE, etc.)"
          className="w-full px-2.5 py-1 text-sm bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded text-zinc-900 dark:text-zinc-100 outline-none font-mono"
        />
      </div>
    </div>
  );
};
