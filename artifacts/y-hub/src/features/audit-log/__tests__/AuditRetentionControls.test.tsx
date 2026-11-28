import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuditRetentionControls } from '../components/AuditRetentionControls';
import * as repository from '../services/auditRetentionRepository';
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('../services/auditRetentionRepository', () => ({ getRetentionPolicy: vi.fn(), saveRetentionPolicy: vi.fn(), getInvestigationHold: vi.fn(), saveInvestigationHold: vi.fn() }));
const api = vi.mocked(repository);
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.getRetentionPolicy.mockResolvedValue({ months: 24, revision: 3 });
  api.getInvestigationHold.mockResolvedValue({ active: false, revision: 0 });
});
it('requires confirmation for shortening and sends the loaded revision', async () => {
  api.saveRetentionPolicy.mockResolvedValue({ months: 12, revision: 4 });
  render(<AuditRetentionControls />);
  fireEvent.change(await screen.findByLabelText('Period in months'), { target: { value: '12' } });
  const save = screen.getByRole('button', { name: 'Save period' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(save);
  await screen.findByText('Saved and recorded in the audit log.');
  expect(api.saveRetentionPolicy).toHaveBeenCalledWith(12, 3, expect.any(AbortSignal));
});
it.each(['11','61','12.5',''])('rejects invalid period %s', async months => {
  render(<AuditRetentionControls />);
  fireEvent.change(await screen.findByLabelText('Period in months'), { target: { value: months } });
  expect((screen.getByRole('button', { name: 'Save period' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.saveRetentionPolicy).not.toHaveBeenCalled();
});
it('requires reload after a conflict and never shows internal errors', async () => {
  api.saveRetentionPolicy.mockRejectedValue(new Error('private SQL'));
  render(<AuditRetentionControls />);
  fireEvent.change(await screen.findByLabelText('Period in months'), { target: { value: '36' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('private SQL')).toBeNull();
  api.getRetentionPolicy.mockResolvedValue({ months: 60, revision: 4 });
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() => expect((screen.getByLabelText('Period in months') as HTMLInputElement).value).toBe('60'));
});
it('sets and releases the selected event hold with current revision', async () => {
  api.saveInvestigationHold.mockResolvedValueOnce({ active: true, revision: 1 }).mockResolvedValueOnce({ active: false, revision: 2 });
  render(<AuditRetentionControls eventId="11111111-1111-4111-8111-111111111111" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Hold for investigation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Release investigation hold' }));
  await screen.findByRole('button', { name: 'Hold for investigation' });
  expect(api.saveInvestigationHold).toHaveBeenLastCalledWith('11111111-1111-4111-8111-111111111111', false, 1, expect.any(AbortSignal));
});
it('aborts pending reads on unmount without exposing late owner data', async () => {
  let resolve!: (value: repository.RetentionPolicy) => void;
  api.getRetentionPolicy.mockReturnValue(new Promise(done => { resolve = done; }));
  const { unmount } = render(<AuditRetentionControls />);
  const signal = api.getRetentionPolicy.mock.calls[0][0];
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ months: 60, revision: 7 }));
  expect(screen.queryByLabelText('Period in months')).toBeNull();
});
