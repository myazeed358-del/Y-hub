import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { colIndexToLabel } from '../../engine/references';
import { cellCoordToKey } from '../../types/sheet';
import { formatCellValue } from '../../formatting/numberFormatter';
import { applyConditionalFormatting } from '../../formatting/conditionalFormatter';
import { CellPosition } from '../../types/cell';
import { CellEditor } from './CellEditor';
import { ContextMenu } from './ContextMenu';
import { Filter } from 'lucide-react';

const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 24;
const ROW_HEADER_WIDTH = 45;
const COL_HEADER_HEIGHT = 26;
const OVERSCAN_ROWS = 6;
const OVERSCAN_COLS = 4;

export const Grid: React.FC = () => {
  const {
    activeSheet,
    activeCell,
    selection,
    editingCell,
    setActiveCell,
    setSelection,
    startEditing,
    copySelection,
    cutSelection,
    pasteSelection,
    clearSelection,
    undo,
    redo,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    dispatch,
  } = useWorkbook();

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 600 });
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null);

  // Resize state
  const [resizingCol, setResizingCol] = useState<{ col: number; startX: number; startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ row: number; startY: number; startHeight: number } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);

  // Measure viewport size
  useEffect(() => {
    const updateSize = (): void => {
      if (containerRef.current) {
        setViewportSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute column and row offsets
  const getColWidth = useCallback((col: number): number => {
    return activeSheet.columnWidths[col] || DEFAULT_COL_WIDTH;
  }, [activeSheet.columnWidths]);

  const getRowHeight = useCallback((row: number): number => {
    if (activeSheet.hiddenRows?.[row]) return 0;
    return activeSheet.rowHeights[row] || DEFAULT_ROW_HEIGHT;
  }, [activeSheet.rowHeights, activeSheet.hiddenRows]);

  const { colOffsets, totalWidth } = useMemo(() => {
    const offsets: number[] = [0];
    let total = 0;
    for (let c = 0; c < activeSheet.colCount; c++) {
      const w = activeSheet.columnWidths[c] || DEFAULT_COL_WIDTH;
      total += w;
      offsets.push(total);
    }
    return { colOffsets: offsets, totalWidth: total };
  }, [activeSheet.colCount, activeSheet.columnWidths]);

  const { rowOffsets, totalHeight } = useMemo(() => {
    const offsets: number[] = [0];
    let total = 0;
    for (let r = 0; r < activeSheet.rowCount; r++) {
      const h = activeSheet.hiddenRows?.[r] ? 0 : (activeSheet.rowHeights[r] || DEFAULT_ROW_HEIGHT);
      total += h;
      offsets.push(total);
    }
    return { rowOffsets: offsets, totalHeight: total };
  }, [activeSheet.rowCount, activeSheet.rowHeights, activeSheet.hiddenRows]);

  // Virtual window calculation
  const visibleCols = useMemo(() => {
    const scrollLeft = scrollPos.left;
    let start = 0;
    while (start < activeSheet.colCount && (colOffsets[start + 1] || 0) < scrollLeft) {
      start++;
    }
    start = Math.max(0, start - OVERSCAN_COLS);

    let end = start;
    const viewRight = scrollLeft + viewportSize.width;
    while (end < activeSheet.colCount && (colOffsets[end] || 0) < viewRight) {
      end++;
    }
    end = Math.min(activeSheet.colCount - 1, end + OVERSCAN_COLS);

    return { start, end };
  }, [scrollPos.left, viewportSize.width, activeSheet.colCount, colOffsets]);

  const visibleRows = useMemo(() => {
    const scrollTop = scrollPos.top;
    let start = 0;
    while (start < activeSheet.rowCount && (rowOffsets[start + 1] || 0) < scrollTop) {
      start++;
    }
    start = Math.max(0, start - OVERSCAN_ROWS);

    let end = start;
    const viewBottom = scrollTop + viewportSize.height;
    while (end < activeSheet.rowCount && (rowOffsets[end] || 0) < viewBottom) {
      end++;
    }
    end = Math.min(activeSheet.rowCount - 1, end + OVERSCAN_ROWS);

    return { start, end };
  }, [scrollPos.top, viewportSize.height, activeSheet.rowCount, rowOffsets]);

  // Handle Scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    setScrollPos({
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft,
    });
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (editingCell) return; // Handled in CellEditor

    // Clipboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        copySelection();
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        cutSelection();
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        pasteSelection();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setSelection({
          startRow: 0,
          startCol: 0,
          endRow: activeSheet.rowCount - 1,
          endCol: activeSheet.colCount - 1,
        });
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleBold();
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        toggleItalic();
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        toggleUnderline();
        return;
      }
    }

    // Navigation
    let dRow = 0;
    let dCol = 0;
    if (e.key === 'ArrowUp') dRow = -1;
    else if (e.key === 'ArrowDown') dRow = 1;
    else if (e.key === 'ArrowLeft') dCol = -1;
    else if (e.key === 'ArrowRight') dCol = 1;
    else if (e.key === 'Tab') {
      e.preventDefault();
      dCol = e.shiftKey ? -1 : 1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      dRow = e.shiftKey ? -1 : 1;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearSelection();
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Direct typing into cell starts editing!
      startEditing(activeCell, e.key);
      return;
    }

    if (dRow !== 0 || dCol !== 0) {
      e.preventDefault();
      const targetPos: CellPosition = {
        row: Math.max(0, Math.min(activeCell.row + dRow, activeSheet.rowCount - 1)),
        col: Math.max(0, Math.min(activeCell.col + dCol, activeSheet.colCount - 1)),
      };
      setActiveCell(targetPos, e.shiftKey);
    }
  };

  // Mouse handlers for cell selection
  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent): void => {
    if (e.button !== 0) return; // Only left button
    setIsSelecting(true);
    setSelectionAnchor({ row, col });
    setActiveCell({ row, col }, e.shiftKey);
  };

  const handleCellMouseEnter = (row: number, col: number): void => {
    if (isSelecting && selectionAnchor) {
      setSelection({
        startRow: Math.min(selectionAnchor.row, row),
        startCol: Math.min(selectionAnchor.col, col),
        endRow: Math.max(selectionAnchor.row, row),
        endCol: Math.max(selectionAnchor.col, col),
      });
    }
  };

  const handleMouseUp = (): void => {
    setIsSelecting(false);
    setResizingCol(null);
    setResizingRow(null);
  };

  // Column resizing mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (resizingCol) {
        const delta = e.clientX - resizingCol.startX;
        const newWidth = Math.max(35, resizingCol.startWidth + delta);
        dispatch({
          type: 'SET_COL_WIDTH',
          payload: {
            sheetId: activeSheet.id,
            col: resizingCol.col,
            width: newWidth,
          },
        }, false);
      } else if (resizingRow) {
        const delta = e.clientY - resizingRow.startY;
        const newHeight = Math.max(20, resizingRow.startHeight + delta);
        dispatch({
          type: 'SET_ROW_HEIGHT',
          payload: {
            sheetId: activeSheet.id,
            row: resizingRow.row,
            height: newHeight,
          },
        }, false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, resizingRow, activeSheet.id, dispatch]);

  // Selection bounding box coordinates
  const selMinRow = Math.min(selection.startRow, selection.endRow);
  const selMaxRow = Math.max(selection.startRow, selection.endRow);
  const selMinCol = Math.min(selection.startCol, selection.endCol);
  const selMaxCol = Math.max(selection.startCol, selection.endCol);

  const selTop = rowOffsets[selMinRow] ?? 0;
  const selLeft = colOffsets[selMinCol] ?? 0;
  const selWidth = (colOffsets[selMaxCol + 1] ?? 0) - selLeft;
  const selHeight = (rowOffsets[selMaxRow + 1] ?? 0) - selTop;

  // Active cell coordinates
  const activeTop = rowOffsets[activeCell.row] ?? 0;
  const activeLeft = colOffsets[activeCell.col] ?? 0;
  const activeW = getColWidth(activeCell.col);
  const activeH = getRowHeight(activeCell.row);

  // Check merged regions
  const isCellCoveredByMerge = (r: number, c: number): boolean => {
    return activeSheet.mergedCells.some(
      (m) => r >= m.startRow && r <= m.endRow && c >= m.startCol && c <= m.endCol && !(r === m.startRow && c === m.startCol)
    );
  };

  const getMergeSpan = (r: number, c: number): { width: number; height: number } | null => {
    const m = activeSheet.mergedCells.find((region) => region.startRow === r && region.startCol === c);
    if (!m) return null;
    const w = (colOffsets[m.endCol + 1] ?? 0) - (colOffsets[m.startCol] ?? 0);
    const h = (rowOffsets[m.endRow + 1] ?? 0) - (rowOffsets[m.startRow] ?? 0);
    return { width: w, height: h };
  };

  return (
    <div
      data-y-sheets-scroll
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      className="relative flex-1 w-full h-full overflow-auto bg-zinc-100 dark:bg-zinc-950 outline-none select-none"
    >
      {/* Scrollable Canvas */}
      <div
        style={{
          width: totalWidth + ROW_HEADER_WIDTH,
          height: totalHeight + COL_HEADER_HEIGHT,
          position: 'relative',
        }}
      >
        {/* Top-Left Corner Header */}
        <div
          onClick={() => {
            setSelection({
              startRow: 0,
              startCol: 0,
              endRow: activeSheet.rowCount - 1,
              endCol: activeSheet.colCount - 1,
            });
          }}
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            width: ROW_HEADER_WIDTH,
            height: COL_HEADER_HEIGHT,
            zIndex: 35,
          }}
          className="bg-zinc-200 dark:bg-zinc-800 border-r border-b border-zinc-300 dark:border-zinc-700 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
        />

        {/* Sticky Column Headers (A, B, C...) */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            marginLeft: ROW_HEADER_WIDTH,
            marginTop: -COL_HEADER_HEIGHT,
            height: COL_HEADER_HEIGHT,
            width: totalWidth,
            zIndex: 30,
          }}
          className="bg-zinc-100 dark:bg-zinc-850 border-b border-zinc-300 dark:border-zinc-700 flex pointer-events-none"
        >
          {Array.from({ length: visibleCols.end - visibleCols.start + 1 }).map((_, idx) => {
            const col = visibleCols.start + idx;
            const left = (colOffsets[col] ?? 0);
            const width = getColWidth(col);
            const isColSelected = col >= selMinCol && col <= selMaxCol;

            return (
              <div
                data-y-sheets-column={col}
                key={`col-${col}`}
                style={{
                  position: 'absolute',
                  left,
                  width,
                  height: COL_HEADER_HEIGHT,
                  pointerEvents: 'auto',
                }}
                onClick={() => {
                  setActiveCell({ row: 0, col });
                  setSelection({
                    startRow: 0,
                    startCol: col,
                    endRow: activeSheet.rowCount - 1,
                    endCol: col,
                  });
                }}
                className={`flex items-center justify-center border-r border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer relative group ${
                  isColSelected
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{colIndexToLabel(col)}</span>

                {/* Filter indicator */}
                {activeSheet.filter && col >= activeSheet.filter.range.startCol && col <= activeSheet.filter.range.endCol && (
                  <Filter className="w-2.5 h-2.5 ml-1 text-emerald-600" />
                )}

                {/* Column resize handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingCol({ col, startX: e.clientX, startWidth: width });
                  }}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500 z-10"
                />
              </div>
            );
          })}
        </div>

        {/* Sticky Row Headers (1, 2, 3...) */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            width: ROW_HEADER_WIDTH,
            height: totalHeight,
            zIndex: 25,
          }}
          className="bg-zinc-100 dark:bg-zinc-850 border-r border-zinc-300 dark:border-zinc-700 pointer-events-none"
        >
          {Array.from({ length: visibleRows.end - visibleRows.start + 1 }).map((_, idx) => {
            const row = visibleRows.start + idx;
            if (activeSheet.hiddenRows?.[row]) return null;
            const top = (rowOffsets[row] ?? 0);
            const height = getRowHeight(row);
            const isRowSelected = row >= selMinRow && row <= selMaxRow;

            return (
              <div
                data-y-sheets-row={row}
                key={`row-${row}`}
                style={{
                  position: 'absolute',
                  top,
                  width: ROW_HEADER_WIDTH,
                  height,
                  pointerEvents: 'auto',
                }}
                onClick={() => {
                  setActiveCell({ row, col: 0 });
                  setSelection({
                    startRow: row,
                    startCol: 0,
                    endRow: row,
                    endCol: activeSheet.colCount - 1,
                  });
                }}
                className={`flex items-center justify-center border-b border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer relative group ${
                  isRowSelected
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{row + 1}</span>

                {/* Row resize handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingRow({ row, startY: e.clientY, startHeight: height });
                  }}
                  className="absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-emerald-500 z-10"
                />
              </div>
            );
          })}
        </div>

        {/* Grid Cells Layer */}
        <div
          style={{
            position: 'absolute',
            left: ROW_HEADER_WIDTH,
            top: COL_HEADER_HEIGHT,
            width: totalWidth,
            height: totalHeight,
          }}
        >
          {/* Render Visible Virtualized Cells */}
          {Array.from({ length: visibleRows.end - visibleRows.start + 1 }).map((_, rIdx) => {
            const row = visibleRows.start + rIdx;
            if (activeSheet.hiddenRows?.[row]) return null;
            const top = rowOffsets[row] ?? 0;
            const rowH = getRowHeight(row);

            return Array.from({ length: visibleCols.end - visibleCols.start + 1 }).map((__, cIdx) => {
              const col = visibleCols.start + cIdx;
              if (isCellCoveredByMerge(row, col)) return null;

              const left = colOffsets[col] ?? 0;
              const colW = getColWidth(col);
              const mergeSpan = getMergeSpan(row, col);
              const cellWidth = mergeSpan ? mergeSpan.width : colW;
              const cellHeight = mergeSpan ? mergeSpan.height : rowH;

              const key = cellCoordToKey(row, col);
              const cell = activeSheet.cells[key];
              const value = cell?.computed !== undefined ? cell.computed : cell?.raw || '';

              // Apply conditional formatting
              const effectiveStyle = applyConditionalFormatting(
                row,
                col,
                value,
                cell?.style,
                activeSheet.conditionalFormats
              );

              const formattedText = formatCellValue(value, effectiveStyle);

              // Borders
              const borderStyles: React.CSSProperties = {};
              if (effectiveStyle.borderTop) borderStyles.borderTop = `${effectiveStyle.borderTop.style === 'thick' ? 2 : 1}px solid ${effectiveStyle.borderTop.color}`;
              if (effectiveStyle.borderBottom) borderStyles.borderBottom = `${effectiveStyle.borderBottom.style === 'thick' ? 2 : 1}px solid ${effectiveStyle.borderBottom.color}`;
              if (effectiveStyle.borderLeft) borderStyles.borderLeft = `${effectiveStyle.borderLeft.style === 'thick' ? 2 : 1}px solid ${effectiveStyle.borderLeft.color}`;
              if (effectiveStyle.borderRight) borderStyles.borderRight = `${effectiveStyle.borderRight.style === 'thick' ? 2 : 1}px solid ${effectiveStyle.borderRight.color}`;

              const isError = typeof value === 'string' && value.startsWith('#');

              return (
                <div
                  data-y-sheets-cell={`${row},${col}`}
                  key={`cell-${row}-${col}`}
                  onMouseDown={(e) => handleCellMouseDown(row, col, e)}
                  onMouseEnter={() => handleCellMouseEnter(row, col)}
                  onDoubleClick={() => startEditing({ row, col })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, row, col });
                  }}
                  style={{
                    position: 'absolute',
                    top,
                    left,
                    width: cellWidth,
                    height: cellHeight,
                    backgroundColor: effectiveStyle.backgroundColor || undefined,
                    color: effectiveStyle.textColor || (isError ? '#dc2626' : undefined),
                    fontWeight: effectiveStyle.bold ? 'bold' : undefined,
                    fontStyle: effectiveStyle.italic ? 'italic' : undefined,
                    textDecoration: effectiveStyle.underline ? 'underline' : undefined,
                    fontSize: effectiveStyle.fontSize ? `${effectiveStyle.fontSize}pt` : '10pt',
                    textAlign: effectiveStyle.horizontalAlign || 'left',
                    ...borderStyles,
                  }}
                  className={`border-r border-b border-zinc-200 dark:border-zinc-800/80 px-1.5 flex items-center overflow-hidden text-ellipsis whitespace-nowrap cursor-cell text-zinc-900 dark:text-zinc-100 ${
                    effectiveStyle.horizontalAlign === 'right' ? 'justify-end' : effectiveStyle.horizontalAlign === 'center' ? 'justify-center' : 'justify-start'
                  }`}
                >
                  <span className="truncate">{formattedText}</span>
                </div>
              );
            });
          })}

          {/* Selection Box Overlay */}
          <div
            style={{
              position: 'absolute',
              top: selTop,
              left: selLeft,
              width: selWidth,
              height: selHeight,
              pointerEvents: 'none',
              zIndex: 15,
            }}
            className="border-2 border-emerald-600 bg-emerald-500/10"
          >
            {/* Fill handle bottom-right */}
            <div
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 7,
                height: 7,
              }}
              className="bg-emerald-600 border border-white cursor-crosshair pointer-events-auto"
            />
          </div>

          {/* Active Cell Border Highlight */}
          <div
            style={{
              position: 'absolute',
              top: activeTop,
              left: activeLeft,
              width: activeW,
              height: activeH,
              pointerEvents: 'none',
              zIndex: 20,
            }}
            className="border-2 border-emerald-700 shadow-sm"
          />

          {/* Inline Cell Editor when Editing */}
          {editingCell && (
            <CellEditor
              row={editingCell.position.row}
              col={editingCell.position.col}
              top={rowOffsets[editingCell.position.row] ?? 0}
              left={colOffsets[editingCell.position.col] ?? 0}
              width={getColWidth(editingCell.position.col)}
              height={getRowHeight(editingCell.position.row)}
              initialValue={editingCell.initialValue}
            />
          )}
        </div>
      </div>

      {/* Context Menu Popup */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          row={contextMenu.row}
          col={contextMenu.col}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
