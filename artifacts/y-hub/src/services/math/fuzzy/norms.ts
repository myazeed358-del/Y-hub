import { TNormType, TConormType } from './types';

export const TNorms = {
  min: (a: number, b: number) => Math.min(a, b),
  prod: (a: number, b: number) => a * b,
  bounded: (a: number, b: number) => Math.max(0, a + b - 1),
  drastic: (a: number, b: number) => (b === 1 ? a : a === 1 ? b : 0),
};

export const TConorms = {
  max: (a: number, b: number) => Math.max(a, b),
  probsum: (a: number, b: number) => a + b - a * b,
  bounded: (a: number, b: number) => Math.min(1, a + b),
  drastic: (a: number, b: number) => (b === 0 ? a : a === 0 ? b : 1),
};
