import type { CalculusHistoryEntry } from '../types';

const KEY = 'calculus_history';

export const calculusHistoryStorage = {
  read(): string | null {
    return localStorage.getItem(KEY);
  },

  write(entries: CalculusHistoryEntry[]): void {
    localStorage.setItem(KEY, JSON.stringify(entries));
  },

  clear(): void {
    localStorage.removeItem(KEY);
  },
};
