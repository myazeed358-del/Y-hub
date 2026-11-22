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
export type RecoveryConflictKind = 'identity' | 'structure' | 'name' | 'layout' | 'cells';
export interface RecoveryConflictCell { sheetName: string; address: string }
export class RecoveryMergeConflict extends Error {
  constructor(
    public readonly kind: RecoveryConflictKind,
    public readonly cells: readonly RecoveryConflictCell[] = [],
    public readonly totalCells = 0,
  ) { super('Recovery changes overlap or sheet structure changed. Your local copy is retained.'); }
}
function address(key: string): string {
  const [row, col] = key.split(',').map(Number);
  let column = '', value = col + 1;
  while (value > 0) { column = String.fromCharCode(65 + (value - 1) % 26) + column; value = Math.floor((value - 1) / 26); }
  return `${column}${row + 1}`;
}
/** Atomic cells and independent presentation settings; coordinate-changing edits stay blocked. */
export function mergeRecovery(baseInput: WorkbookData, localInput: WorkbookData, remoteInput: WorkbookData): WorkbookData {
  const base = clean(baseInput), local = clean(localInput), remote = clean(remoteInput);
  if (base.id !== local.id || base.id !== remote.id) throw new RecoveryMergeConflict('identity');
  const structure = (wb: WorkbookData) => wb.sheets.map(({ cells: _cells, name: _name, columnWidths: _widths, rowHeights: _heights, ...rest }) => rest);
  if (!equal(structure(base), structure(local)) || !equal(structure(base), structure(remote)) ||
    [base.version, local.version, remote.version].some(v => !Number.isSafeInteger(v) || v >= Number.MAX_SAFE_INTEGER)) throw new RecoveryMergeConflict('structure');
  const choose = <T,>(b: T, l: T, r: T, kind: RecoveryConflictKind = 'name'): T => {
    if (equal(l, b)) return r;
    if (equal(r, b) || equal(l, r)) return l;
    throw new RecoveryMergeConflict(kind);
  };
  const mergeSizes = (b: Record<string, number>, l: Record<string, number>, r: Record<string, number>) => {
    const result: Record<string, number> = {};
    for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
      const value = choose(b[key], l[key], r[key], 'layout');
      if (value !== undefined) result[key] = value;
    }
    return result;
  };
  const merged = structuredClone(remote);
  // This is the editor mutation counter, not the server CAS revision or a schema version.
  merged.version = Math.max(base.version, local.version, remote.version) + 1;
  merged.name = choose(base.name, local.name, remote.name);
  // Selection is navigation state, not an edit to cell content.
  merged.activeSheetId = local.activeSheetId;
  const conflicts: RecoveryConflictCell[] = [];
  let totalCells = 0;
  for (let i = 0; i < base.sheets.length; i++) {
    const bs = base.sheets[i]!, ls = local.sheets[i]!, rs = remote.sheets[i]!, output = merged.sheets[i]!;
    output.name = choose(bs.name, ls.name, rs.name, 'layout');
    output.columnWidths = mergeSizes(bs.columnWidths, ls.columnWidths, rs.columnWidths);
    output.rowHeights = mergeSizes(bs.rowHeights, ls.rowHeights, rs.rowHeights);
    const b = base.sheets[i]!.cells, l = local.sheets[i]!.cells, r = remote.sheets[i]!.cells;
    const target = merged.sheets[i]!.cells;
    const keys = [...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])].sort((a, b) => {
      const [ar, ac] = a.split(',').map(Number), [br, bc] = b.split(',').map(Number);
      return ar - br || ac - bc;
    });
    for (const key of keys) {
      if (!equal(l[key], b[key]) && !equal(r[key], b[key]) && !equal(l[key], r[key])) {
        totalCells++;
        if (conflicts.length < 10) conflicts.push({ sheetName: base.sheets[i]!.name, address: address(key) });
        continue;
      }
      const value = choose(b[key], l[key], r[key]);
      if (value === undefined) delete target[key]; else target[key] = structuredClone(value);
    }
  }
  if (new Set(merged.sheets.map(s => s.name.toLowerCase())).size !== merged.sheets.length)
    throw new RecoveryMergeConflict('layout');
  if (totalCells) throw new RecoveryMergeConflict('cells', conflicts, totalCells);
  return validateWorkbook(merged);
}
