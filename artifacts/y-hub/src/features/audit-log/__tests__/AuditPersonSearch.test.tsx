import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AuditPersonSearch } from '../components/AuditPersonSearch';
import { AuditPersonIdentity } from '../components/AuditPersonIdentity';
import { auditCopy } from '../domain/copy';
import { emptyFilters, type AuditPerson } from '../domain/auditLog';
import { suggestAuditPeople } from '../services/auditLogRepository';
const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'ar' }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => state }));
vi.mock('../services/auditLogRepository', () => ({ suggestAuditPeople: vi.fn() }));
const suggest = vi.mocked(suggestAuditPeople);
const person: AuditPerson = { person_id: '22222222-2222-4222-8222-222222222222', relation: 'affected', full_name: 'Legacy name', full_name_ar: 'أحمد التجريبي', full_name_en: 'Ahmad Test', user_number: '001234567', recorded: true };
function Search() {
  const [filters, setFilters] = useState(emptyFilters);
  return <><AuditPersonSearch filters={filters} onChange={setFilters} copy={auditCopy[state.language]} /><output data-testid="filters">{JSON.stringify(filters)}</output></>;
}
beforeEach(() => { state.language = 'en'; suggest.mockReset(); suggest.mockResolvedValue([person]); });
afterEach(cleanup);

it('selects an immutable identity and clears it when the query or scope changes', async () => {
  render(<Search />);
  fireEvent.change(screen.getByLabelText(auditCopy.en.person), { target: { value: 'Ahmad' } });
  fireEvent.click(await screen.findByRole('button', { name: /Ahmad Test/ }));
  expect(JSON.parse(screen.getByTestId('filters').textContent!)).toMatchObject({ actor: person.person_id, personSearch: '001234567' });
  expect(screen.queryByRole('list')).toBeNull();
  fireEvent.change(screen.getByLabelText(auditCopy.en.personScope), { target: { value: 'actor' } });
  expect(JSON.parse(screen.getByTestId('filters').textContent!)).toMatchObject({ actor: '', personScope: 'actor' });
  await waitFor(() => expect(suggest).toHaveBeenLastCalledWith('001234567', 'actor', expect.any(AbortSignal)));
});
it('aborts pending suggestions and ignores late results from old queries', async () => {
  let resolve!: (rows: AuditPerson[]) => void;
  suggest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const { unmount } = render(<Search />);
  fireEvent.change(screen.getByLabelText(auditCopy.en.person), { target: { value: 'old' } });
  await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
  const signal = suggest.mock.calls[0][2];
  fireEvent.change(screen.getByLabelText(auditCopy.en.person), { target: { value: '' } });
  expect(signal.aborted).toBe(true);
  await act(async () => resolve([person]));
  expect(screen.queryByRole('list')).toBeNull();
  unmount();
});
it('shows a safe recoverable suggestion failure without preventing typed search', async () => {
  suggest.mockRejectedValueOnce(new Error('private table details'));
  render(<Search />);
  fireEvent.change(screen.getByLabelText(auditCopy.en.person), { target: { value: 'Ahmad' } });
  expect((await screen.findByText(auditCopy.en.suggestionError)).getAttribute('role')).toBe('status');
  expect(screen.queryByText('private table details')).toBeNull();
  expect(JSON.parse(screen.getByTestId('filters').textContent!).personSearch).toBe('Ahmad');
});
it('uses Arabic names and keeps the complete nine-digit number LTR', () => {
  state.language = 'ar';
  render(<AuditPersonIdentity person={person} copy={auditCopy.ar} />);
  expect(screen.getByText('أحمد التجريبي')).toBeTruthy();
  expect(screen.getByText('001234567').getAttribute('dir')).toBe('ltr');
});
it('labels legacy lookups and does not fabricate missing historical numbers', () => {
  render(<AuditPersonIdentity person={{ ...person, recorded: false, user_number: null }} copy={auditCopy.en} />);
  expect(screen.getByText(auditCopy.en.legacy)).toBeTruthy();
  expect(screen.getByText(auditCopy.en.unknown)).toBeTruthy();
});
