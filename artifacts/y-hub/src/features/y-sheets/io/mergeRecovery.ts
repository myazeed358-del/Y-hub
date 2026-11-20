import type { WorkbookData } from '../types/workbook';
import { validateWorkbook } from './workbookValidation';

// Compare semantic values rather than object insertion order. Derived cell caches
// are excluded by clean(); the existing reducer recalculates after adoption.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
function clean(input: WorkbookData): WorkbookData {
  const wb = validateWorkbook(input);
  for (const sheet of wb.sheets) for (const [key, cell] of Object.entries(sheet.cells)) {
    const { computed: _computed, error: _error, ...saved } = cell;
    sheet.cells[key] = saved;
  }
  return wb;
}
export class RecoveryMergeConflict extends Error {
  constructor() { super('Recovery changes overlap or sheet structure changed. Your local copy is retained.'); }
}
/** Conservative three-way merge: cells are atomic, structural edits require manual recovery. */
export function mergeRecovery(baseInput: WorkbookData, localInput: WorkbookData, remoteInput: WorkbookData): WorkbookData {
  const base = clean(baseInput), local = clean(localInput), remote = clean(remoteInput);
  if (base.id !== local.id || base.id !== remote.id) throw new RecoveryMergeConflict();
  const structure = (wb: WorkbookData) => wb.sheets.map(({ cells: _cells, ...rest }) => rest);
  if (!equal(structure(base), structure(local)) || !equal(structure(base), structure(remote)) ||
    base.version !== local.version || base.version !== remote.version) throw new RecoveryMergeConflict();
  const choose = <T,>(b: T, l: T, r: T): T => {
    if (equal(l, b)) return r;
    if (equal(r, b) || equal(l, r)) return l;
    throw new RecoveryMergeConflict();
  };
  const merged = structuredClone(remote);
  merged.name = choose(base.name, local.name, remote.name);
  // Selection is navigation state, not an edit to cell content.
  merged.activeSheetId = local.activeSheetId;
  for (let i = 0; i < base.sheets.length; i++) {
    const b = base.sheets[i]!.cells, l = local.sheets[i]!.cells, r = remote.sheets[i]!.cells;
    const target = merged.sheets[i]!.cells;
    for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
      const value = choose(b[key], l[key], r[key]);
      if (value === undefined) delete target[key]; else target[key] = structuredClone(value);
    }
  }
  return validateWorkbook(merged);
}
