import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecoveryConflictDetails } from '../workspace/RecoveryConflictDetails';
import { RecoveryMergeConflict } from '../io/mergeRecovery';
const locale = vi.hoisted(() => ({ language: 'en' }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => locale }));
afterEach(cleanup);
it.each(['ar', 'en'])('renders escaped locations and truncation notice in %s with no overwrite control', language => {
  locale.language = language;
  const conflict = new RecoveryMergeConflict('cells', [{ sheetName: '<img src=x onerror=alert(1)>', address: 'AA2' }], 12);
  render(<RecoveryConflictDetails conflict={conflict}/>);
  const alert = screen.getByRole('alert');
  expect(alert.getAttribute('dir')).toBe(language === 'ar' ? 'rtl' : 'ltr');
  expect(alert.textContent).toContain('12'); expect(alert.textContent).toContain('AA2');
  expect(alert.textContent).toContain(language === 'ar' ? 'تظهر أول' : 'Only the first');
  expect(alert.querySelector('img,button,a,input')).toBeNull();
  expect(alert.getAttribute('tabindex')).toBe('0');
});
it.each(['identity','structure','name'] as const)('explains %s separately from cell overlaps', kind => {
  locale.language = 'en';
  render(<RecoveryConflictDetails conflict={new RecoveryMergeConflict(kind)}/>);
  expect(screen.getByRole('alert').querySelector('ul')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('The merge was not saved');
});
