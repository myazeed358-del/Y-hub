import { CellValue } from '../../types/cell';

/**
 * Flattens nested arguments (such as ranges expanded into arrays)
 */
export function flattenArgs(args: unknown[]): CellValue[] {
  const result: CellValue[] = [];
  for (const item of args) {
    if (Array.isArray(item)) {
      result.push(...flattenArgs(item));
    } else {
      result.push(item as CellValue);
    }
  }
  return result;
}

export function sumFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let total = 0;
  for (const item of flat) {
    if (item === null || item === undefined || item === '') continue;
    const num = Number(item);
    if (!isNaN(num)) {
      total += num;
    }
  }
  return total;
}

export function averageFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let total = 0;
  let count = 0;
  for (const item of flat) {
    if (item === null || item === undefined || item === '') continue;
    const num = Number(item);
    if (!isNaN(num)) {
      total += num;
      count++;
    }
  }
  if (count === 0) throw new Error('#DIV/0! Cannot compute average of empty set');
  return total / count;
}

export function minFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let min: number | null = null;
  for (const item of flat) {
    if (item === null || item === undefined || item === '') continue;
    const num = Number(item);
    if (!isNaN(num)) {
      if (min === null || num < min) {
        min = num;
      }
    }
  }
  return min ?? 0;
}

export function maxFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let max: number | null = null;
  for (const item of flat) {
    if (item === null || item === undefined || item === '') continue;
    const num = Number(item);
    if (!isNaN(num)) {
      if (max === null || num > max) {
        max = num;
      }
    }
  }
  return max ?? 0;
}

export function countFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let count = 0;
  for (const item of flat) {
    if (item === null || item === undefined || item === '') continue;
    if (typeof item === 'number') {
      count++;
    } else if (typeof item === 'string' && item.trim() !== '' && !isNaN(Number(item))) {
      count++;
    }
  }
  return count;
}

export function countaFunction(args: unknown[]): number {
  const flat = flattenArgs(args);
  let count = 0;
  for (const item of flat) {
    if (item !== null && item !== undefined && item !== '') {
      count++;
    }
  }
  return count;
}
