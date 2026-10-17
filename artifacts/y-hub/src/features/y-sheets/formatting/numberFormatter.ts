import { CellStyle, CellValue } from '../types/cell';

/**
 * Formats a raw cell value according to its cell style (numberFormat and decimalPlaces)
 */
export function formatCellValue(value: CellValue, style?: CellStyle): string {
  if (value === null || value === undefined) return '';

  // If the cell is an error string (starts with #)
  if (typeof value === 'string' && value.startsWith('#')) {
    return value;
  }

  // If boolean
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  const format = style?.numberFormat || 'general';
  const decimals = style?.decimalPlaces ?? 2;

  if (format === 'text') {
    return String(value);
  }

  const num = typeof value === 'number' ? value : Number(value);

  // If it is not a valid number, render as string
  if (isNaN(num)) {
    return String(value);
  }

  switch (format) {
    case 'number': {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    case 'currency': {
      return num.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    case 'percentage': {
      const pct = num * 100;
      return `${pct.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    }

    case 'general':
    default:
      if (typeof value === 'number') {
        // Avoid precision artifacts like 0.1 + 0.2 = 0.30000000000000004
        return parseFloat(value.toPrecision(12)).toString();
      }
      return String(value);
  }
}
