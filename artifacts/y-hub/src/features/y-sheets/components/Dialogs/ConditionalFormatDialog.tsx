import React, { useState } from 'react';
import { useWorkbook } from '../../state/workbookContext';
import { ConditionalFormatType, ConditionalFormatRule } from '../../types/formatting';
import { formatRangeReference } from '../../engine/references';
import { X, Plus, Trash2, Palette } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ConditionalFormatDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeSheet, selection, dispatch } = useWorkbook();

  const [ruleType, setRuleType] = useState<ConditionalFormatType>('greaterThan');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [bgColor, setBgColor] = useState('#dcfce7');
  const [textColor, setTextColor] = useState('#15803d');
  const [isBold, setIsBold] = useState(true);

  if (!isOpen) return null;

  const currentRules = activeSheet.conditionalFormats || [];

  const handleAddRule = (): void => {
    if (!val1) return;

    const newRule: ConditionalFormatRule = {
      id: `cf-${Date.now()}`,
      range: selection,
      type: ruleType,
      value1: isNaN(Number(val1)) ? val1 : Number(val1),
      value2: val2 ? (isNaN(Number(val2)) ? val2 : Number(val2)) : undefined,
      style: {
        backgroundColor: bgColor || undefined,
        textColor: textColor || undefined,
        bold: isBold,
      },
    };

    dispatch({
      type: 'ADD_CONDITIONAL_FORMAT',
      payload: {
        sheetId: activeSheet.id,
        rule: newRule,
      },
    });

    setVal1('');
    setVal2('');
  };

  const handleRemoveRule = (ruleId: string): void => {
    dispatch({
      type: 'REMOVE_CONDITIONAL_FORMAT',
      payload: {
        sheetId: activeSheet.id,
        ruleId,
      },
    });
  };

  const colorPresets = [
    { label: 'Light Green', bg: '#dcfce7', text: '#15803d' },
    { label: 'Light Red', bg: '#fee2e2', text: '#b91c1c' },
    { label: 'Light Yellow', bg: '#fef9c3', text: '#854d0e' },
    { label: 'Light Blue', bg: '#dbeafe', text: '#1d4ed8' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-5 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Palette className="w-4 h-4 text-emerald-600" />
            Conditional Formatting Rules
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create Rule Form */}
        <div className="py-4 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Add New Rule for {formatRangeReference(selection)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Condition
              </label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as ConditionalFormatType)}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
              >
                <option value="greaterThan">Cell Value &gt;</option>
                <option value="lessThan">Cell Value &lt;</option>
                <option value="equalTo">Cell Value =</option>
                <option value="between">Cell Value between</option>
                <option value="textContains">Text contains</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Value / Text
              </label>
              <input
                type="text"
                value={val1}
                onChange={(e) => setVal1(e.target.value)}
                placeholder="Value..."
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
              />
            </div>
          </div>

          {ruleType === 'between' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Second Value
              </label>
              <input
                type="text"
                value={val2}
                onChange={(e) => setVal2(e.target.value)}
                placeholder="Upper bound..."
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Format Style Presets
              </label>
              <div className="flex gap-2">
                {colorPresets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setBgColor(p.bg);
                      setTextColor(p.text);
                    }}
                    style={{ backgroundColor: p.bg, color: p.text }}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      bgColor === p.bg ? 'ring-2 ring-emerald-500 font-bold' : 'border-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isBold}
                onChange={(e) => setIsBold(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600"
              />
              Bold
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleAddRule}
              disabled={!val1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Formatting Rule
            </button>
          </div>
        </div>

        {/* Existing Rules List */}
        <div className="py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Active Rules in Current Sheet ({currentRules.length})
          </div>

          {currentRules.length === 0 ? (
            <div className="text-xs text-zinc-400 italic py-2">No conditional formatting rules yet.</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {currentRules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium border"
                      style={{
                        backgroundColor: r.style.backgroundColor || '#fff',
                        color: r.style.textColor || '#000',
                        fontWeight: r.style.bold ? 'bold' : 'normal',
                      }}
                    >
                      Sample
                    </span>
                    <div>
                      <span className="font-semibold">{formatRangeReference(r.range)}: </span>
                      <span>
                        {r.type} {String(r.value1)}
                        {r.value2 ? ` and ${String(r.value2)}` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveRule(r.id)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 rounded hover:bg-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
