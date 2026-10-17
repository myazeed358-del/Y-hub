import React, { useState } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { findMatches, replaceMatch, replaceAll, FindOptions } from '../../data/findReplace';
import { X, Search } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const FindReplaceDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeSheet, setActiveCell, dispatch } = useWorkbook();
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  const options: FindOptions = { matchCase, exactMatch };

  const handleFindNext = (): void => {
    if (!findText) return;
    const matches = findMatches(activeSheet, findText, options);
    if (matches.length === 0) {
      setStatusMessage('No matches found.');
      setCurrentMatchIndex(-1);
      return;
    }

    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    const target = matches[nextIndex]!;
    setActiveCell(target);
    setStatusMessage(`Match ${nextIndex + 1} of ${matches.length}`);
  };

  const handleFindPrev = (): void => {
    if (!findText) return;
    const matches = findMatches(activeSheet, findText, options);
    if (matches.length === 0) {
      setStatusMessage('No matches found.');
      setCurrentMatchIndex(-1);
      return;
    }

    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    const target = matches[prevIndex]!;
    setActiveCell(target);
    setStatusMessage(`Match ${prevIndex + 1} of ${matches.length}`);
  };

  const handleReplaceCurrent = (): void => {
    if (!findText) return;
    const matches = findMatches(activeSheet, findText, options);
    if (matches.length === 0) {
      setStatusMessage('No matches found to replace.');
      return;
    }

    const indexToReplace = currentMatchIndex >= 0 ? currentMatchIndex : 0;
    const target = matches[indexToReplace]!;
    const updatedSheet = replaceMatch(activeSheet, target, findText, replaceText, options);

    dispatch({
      type: 'SET_WORKBOOK',
      payload: {
        ...updatedSheet,
        id: activeSheet.id,
      } as any,
    });

    handleFindNext();
    setStatusMessage('Replaced 1 occurrence.');
  };

  const handleReplaceAll = (): void => {
    if (!findText) return;
    const { updatedSheet, count } = replaceAll(activeSheet, findText, replaceText, options);

    if (count === 0) {
      setStatusMessage('No matching cells found to replace.');
      return;
    }

    dispatch({
      type: 'SET_WORKBOOK',
      payload: {
        ...updatedSheet,
        id: activeSheet.id,
      } as any,
    });

    setStatusMessage(`Successfully replaced all ${count} occurrences.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-5 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Search className="w-4 h-4 text-emerald-600" />
            Find and Replace
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Find what
            </label>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFindNext()}
              className="w-full px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Text or number to find..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Replace with
            </label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Replacement text..."
            />
          </div>

          <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Match case
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={exactMatch}
                onChange={(e) => setExactMatch(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Entire cell
            </label>
          </div>

          {statusMessage && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleFindPrev}
              disabled={!findText}
              className="px-2.5 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleFindNext}
              disabled={!findText}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              Find Next
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReplaceCurrent}
              disabled={!findText}
              className="px-2.5 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={!findText}
              className="px-2.5 py-1.5 text-xs font-medium bg-zinc-800 dark:bg-zinc-700 text-white rounded hover:bg-zinc-900 disabled:opacity-50"
            >
              Replace All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
