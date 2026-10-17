import { CellValue } from '../../types/cell';
import { flattenArgs } from './statistical';

export function toBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const trimmed = val.trim().toUpperCase();
    if (trimmed === 'TRUE') return true;
    if (trimmed === 'FALSE') return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num !== 0;
    return val.length > 0;
  }
  return false;
}

export function ifFunction(args: unknown[]): CellValue {
  if (args.length < 2) throw new Error('#VALUE! IF requires at least 2 arguments');
  const condition = toBoolean(args[0]);
  if (condition) {
    return (args[1] as CellValue) ?? true;
  }
  return (args[2] as CellValue) ?? false;
}

export function andFunction(args: unknown[]): boolean {
  const flat = flattenArgs(args);
  if (flat.length === 0) throw new Error('#VALUE! AND requires at least 1 argument');
  for (const item of flat) {
    if (!toBoolean(item)) return false;
  }
  return true;
}

export function orFunction(args: unknown[]): boolean {
  const flat = flattenArgs(args);
  if (flat.length === 0) throw new Error('#VALUE! OR requires at least 1 argument');
  for (const item of flat) {
    if (toBoolean(item)) return true;
  }
  return false;
}

export function notFunction(args: unknown[]): boolean {
  if (args.length !== 1) throw new Error('#VALUE! NOT requires exactly 1 argument');
  return !toBoolean(args[0]);
}
