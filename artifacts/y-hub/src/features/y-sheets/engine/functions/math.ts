import { CellValue } from '../../types/cell';

export function roundFunction(args: CellValue[]): number {
  if (args.length === 0) throw new Error('#VALUE! ROUND requires at least 1 argument');
  const num = Number(args[0]);
  if (isNaN(num)) throw new Error('#VALUE! Argument must be numeric');
  const decimals = args.length > 1 ? Number(args[1]) : 0;
  if (isNaN(decimals)) throw new Error('#VALUE! Decimals must be numeric');

  const factor = Math.pow(10, Math.trunc(decimals));
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function absFunction(args: CellValue[]): number {
  if (args.length !== 1) throw new Error('#VALUE! ABS requires exactly 1 argument');
  const num = Number(args[0]);
  if (isNaN(num)) throw new Error('#VALUE! Argument must be numeric');
  return Math.abs(num);
}

export function modFunction(args: CellValue[]): number {
  if (args.length !== 2) throw new Error('#VALUE! MOD requires 2 arguments');
  const num = Number(args[0]);
  const divisor = Number(args[1]);
  if (isNaN(num) || isNaN(divisor)) throw new Error('#VALUE! Arguments must be numeric');
  if (divisor === 0) throw new Error('#DIV/0! Division by zero');

  // Excel MOD returns result with same sign as divisor:
  return num - divisor * Math.floor(num / divisor);
}
