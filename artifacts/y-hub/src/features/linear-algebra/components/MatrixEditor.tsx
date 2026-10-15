import * as React from 'react';
export interface MatrixEditorProps {
  value: readonly (readonly string[])[];
  onChange: (matrix: string[][]) => void;
  language?: 'ar' | 'en';
  disabled?: boolean;
  maxDimension?: number;
  title?: string;
}

export function MatrixEditor({
  value,
  onChange,
  language = 'ar',
  disabled = false,
  maxDimension = 10,
  title,
}: MatrixEditorProps) {
  const rows = value.length;
  const columns = value[0]?.length ?? 0;
  const ar = language === 'ar';

  const copy = ar
    ? {
        title: 'المصفوفة',
        addRow: 'إضافة صف',
        removeRow: 'حذف صف',
        addColumn: 'إضافة عمود',
        removeColumn: 'حذف عمود',
        row: 'صف',
        column: 'عمود',
      }
    : {
        title: 'Matrix',
        addRow: 'Add row',
        removeRow: 'Remove row',
        addColumn: 'Add column',
        removeColumn: 'Remove column',
        row: 'Row',
        column: 'Column',
      };

  function updateCell(
    rowIndex: number,
    columnIndex: number,
    nextValue: string
  ) {
    onChange(
      value.map((row, i) =>
        row.map((cell, j) =>
          i === rowIndex && j === columnIndex
            ? nextValue
            : cell
        )
      )
    );
  }

  function addRow() {
    if (disabled || rows >= maxDimension || columns === 0) return;

    onChange([
      ...value.map(row => [...row]),
      Array(columns).fill('0'),
    ]);
  }

  function removeRow() {
    if (disabled || rows <= 1) return;

    onChange(value.slice(0, -1).map(row => [...row]));
  }

  function addColumn() {
    if (disabled || columns >= maxDimension || rows === 0) return;

    onChange(value.map(row => [...row, '0']));
  }

  function removeColumn() {
    if (disabled || columns <= 1) return;

    onChange(value.map(row => row.slice(0, -1)));
  }

  return (
    <section
      className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground"
      aria-label={title ?? copy.title}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {title ?? copy.title}
        </h2>

        <span className="text-sm text-muted-foreground">
          {rows} × {columns}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="inline-grid min-w-max gap-2 p-1"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(4.25rem, 1fr))`,
          }}
        >
          {value.map((row, i) =>
            row.map((cell, j) => (
              <input
                key={`${i}-${j}`}
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={cell}
                disabled={disabled}
                aria-label={`${copy.row} ${i + 1}, ${copy.column} ${j + 1}`}
                onChange={event =>
                  updateCell(i, j, event.target.value)
                }
                className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-center text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || rows >= maxDimension || columns === 0}
          aria-label={copy.addRow}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
        >
          + {copy.row}
        </button>

        <button
          type="button"
          onClick={removeRow}
          disabled={disabled || rows <= 1}
          aria-label={copy.removeRow}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
        >
          − {copy.row}
        </button>

        <button
          type="button"
          onClick={addColumn}
          disabled={disabled || columns >= maxDimension || rows === 0}
          aria-label={copy.addColumn}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
        >
          + {copy.column}
        </button>

        <button
          type="button"
          onClick={removeColumn}
          disabled={disabled || columns <= 1}
          aria-label={copy.removeColumn}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
        >
          − {copy.column}
        </button>
      </div>
    </section>
  );
}
