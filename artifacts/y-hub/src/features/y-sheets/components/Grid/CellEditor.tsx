import React, { useState, useEffect, useRef } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { cellCoordToKey } from '../../types/sheet';
import { validateCellValue } from '../../data/validation';

interface Props {
  row: number;
  col: number;
  top: number;
  left: number;
  width: number;
  height: number;
  initialValue: string;
}

export const CellEditor: React.FC<Props> = ({
  row,
  col,
  top,
  left,
  width,
  height,
  initialValue,
}) => {
  const { activeSheet, stopEditing, reportDraft } = useWorkbook();
  const [value, setValue] = useState(initialValue);
  const finished = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    reportDraft({sheetId:activeSheet.id,row,col,raw:initialValue});
  }, []);

  const changeValue = (raw: string) => {
    setValue(raw);
    reportDraft({sheetId:activeSheet.id,row,col,raw});
  };

  const cellKey = cellCoordToKey(row, col);
  const validationRule = activeSheet.validations?.[cellKey];

  useEffect(() => {
    if (validationRule?.type === 'list' && selectRef.current) {
      selectRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [validationRule]);

  const handleCommit = (valToCommit = value): void => {
    if(finished.current) return;
    // Validate if rule present
    if (validationRule) {
      const result = validateCellValue(valToCommit, validationRule);
      if (!result.isValid) {
        alert(`Validation Error: ${result.message || 'Value is not valid.'}`);
        return;
      }
    }
    finished.current=true;
    stopEditing(valToCommit);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finished.current=true;
      stopEditing(); // cancel
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
    }
  };

  // If list validation, render a native styled select
  if (validationRule?.type === 'list') {
    const options = String(validationRule.value1)
      .split(',')
      .map((s) => s.trim());

    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => {
          changeValue(e.target.value);
          handleCommit(e.target.value);
        }}
        onBlur={() => handleCommit()}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          top,
          left,
          width,
          height,
          zIndex: 40,
        }}
        className="bg-white dark:bg-zinc-800 border-2 border-emerald-500 rounded text-xs px-1 text-zinc-900 dark:text-zinc-100 outline-none shadow-lg"
      >
        <option value="">(Select value)</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      maxLength={32767}
      value={value}
      onChange={(e) => changeValue(e.target.value)}
      onBlur={() => handleCommit()}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        top,
        left,
        width: Math.max(width, 100),
        minHeight: height,
        zIndex: 40,
      }}
      className="bg-white dark:bg-zinc-800 border-2 border-emerald-500 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none shadow-xl font-mono"
    />
  );
};
