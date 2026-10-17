import React, { useState } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { ValidationType, ValidationOperator, ValidationRule } from '../../types/validation';
import { cellCoordToKey } from '../../types/sheet';
import { formatCellReference } from '../../engine/references';
import { X, CheckCircle, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DataValidationDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeCell, activeSheet, dispatch } = useWorkbook();
  const activeKey = cellCoordToKey(activeCell.row, activeCell.col);
  const existingRule = activeSheet.validations?.[activeKey];

  const [type, setType] = useState<ValidationType>(existingRule?.type || 'list');
  const [operator, setOperator] = useState<ValidationOperator>(existingRule?.operator || 'between');
  const [val1, setVal1] = useState(existingRule?.value1 ? String(existingRule.value1) : 'Pass,Fail,Incomplete');
  const [val2, setVal2] = useState(existingRule?.value2 ? String(existingRule.value2) : '');
  const [allowBlank, setAllowBlank] = useState(existingRule?.allowBlank ?? true);
  const [errorMessage, setErrorMessage] = useState(existingRule?.errorMessage || '');

  if (!isOpen) return null;

  const cellRefLabel = formatCellReference(activeCell.row, activeCell.col);

  const handleSave = (): void => {
    const rule: ValidationRule = {
      type,
      operator: type !== 'list' ? operator : undefined,
      value1: val1,
      value2: val2 ? val2 : undefined,
      allowBlank,
      errorMessage: errorMessage || undefined,
    };

    dispatch({
      type: 'SET_CELL_VALIDATION',
      payload: {
        sheetId: activeSheet.id,
        row: activeCell.row,
        col: activeCell.col,
        rule,
      },
    });

    onClose();
  };

  const handleClear = (): void => {
    dispatch({
      type: 'REMOVE_CELL_VALIDATION',
      payload: {
        sheetId: activeSheet.id,
        row: activeCell.row,
        col: activeCell.col,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-5 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 font-semibold text-base">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Data Validation ({cellRefLabel})
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Allow Criteria
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ValidationType)}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
            >
              <option value="list">List of Items (Dropdown)</option>
              <option value="wholeNumber">Whole Number</option>
              <option value="decimal">Decimal</option>
              <option value="textLength">Text Length</option>
            </select>
          </div>

          {type === 'list' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Source (Comma separated items)
              </label>
              <input
                type="text"
                value={val1}
                onChange={(e) => setVal1(e.target.value)}
                placeholder="Item 1, Item 2, Item 3"
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
              />
              <span className="text-[11px] text-zinc-400">
                Example: Freshman, Sophomore, Junior, Senior
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Operator
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as ValidationOperator)}
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
                >
                  <option value="between">between</option>
                  <option value="notBetween">not between</option>
                  <option value="equalTo">equal to</option>
                  <option value="greaterThan">greater than</option>
                  <option value="lessThan">less than</option>
                  <option value="greaterThanOrEqualTo">greater than or equal to</option>
                  <option value="lessThanOrEqualTo">less than or equal to</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Value 1
                  </label>
                  <input
                    type="number"
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
                  />
                </div>
                {['between', 'notBetween'].includes(operator) && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Value 2
                    </label>
                    <input
                      type="number"
                      value={val2}
                      onChange={(e) => setVal2(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Error Alert Message
            </label>
            <input
              type="text"
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder="e.g. Value must be between 0 and 100."
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={allowBlank}
              onChange={(e) => setAllowBlank(e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600"
            />
            Ignore blank cells
          </label>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-700">
          {existingRule ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Rule
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm"
            >
              Apply Validation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
