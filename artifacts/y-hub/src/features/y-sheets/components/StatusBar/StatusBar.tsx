import React from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { cellCoordToKey } from '../../types/sheet';
import { formatCellReference, formatRangeReference } from '../../engine/references';

export const StatusBar: React.FC = () => {
  const { activeSheet, activeCell, selection, editingCell } = useWorkbook();

  const isMultiSelection =
    selection.startRow !== selection.endRow || selection.startCol !== selection.endCol;

  // Calculate selection summary statistics
  let count = 0;
  let numCount = 0;
  let sum = 0;

  if (isMultiSelection) {
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = cellCoordToKey(r, c);
        const cell = activeSheet.cells[key];
        if (cell && (cell.raw !== '' || cell.computed !== undefined)) {
          count++;
          const val = cell.computed !== undefined ? cell.computed : Number(cell.raw);
          if (typeof val === 'number' && !isNaN(val)) {
            sum += val;
            numCount++;
          }
        }
      }
    }
  }

  const average = numCount > 0 ? (sum / numCount).toFixed(2) : null;

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 select-none">
      <div className="flex items-center gap-3">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {editingCell ? 'EDIT' : 'READY'}
        </span>
        <span className="text-zinc-400">•</span>
        <span>
          {isMultiSelection
            ? formatRangeReference(selection)
            : formatCellReference(activeCell.row, activeCell.col)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {isMultiSelection && count > 0 && (
          <>
            {average !== null && (
              <span>
                Average: <strong className="text-zinc-700 dark:text-zinc-200">{average}</strong>
              </span>
            )}
            <span>
              Count: <strong className="text-zinc-700 dark:text-zinc-200">{count}</strong>
            </span>
            {numCount > 0 && (
              <span>
                Sum: <strong className="text-zinc-700 dark:text-zinc-200">{sum.toLocaleString()}</strong>
              </span>
            )}
          </>
        )}
        <span className="text-zinc-400">•</span>
        <span>100%</span>
      </div>
    </div>
  );
};
