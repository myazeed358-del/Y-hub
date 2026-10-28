import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AuditLogPage from '../AuditLogPage';
import { listAuditEvents } from '../services/auditLogRepository';
import { event } from './fixtures';
import type { AuditPage } from '../domain/auditLog';
const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'ar', role: 'super_admin', id: 'reviewer' }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => state }));
vi.mock('../services/auditLogRepository', () => ({ listAuditEvents: vi.fn(), suggestAuditPeople: vi.fn().mockResolvedValue([]) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.id }, role: state.role }) }));
const list = vi.mocked(listAuditEvents);
beforeEach(() => { state.language = 'en'; state.role = 'super_admin'; state.id = 'reviewer'; list.mockReset(); list.mockResolvedValue({ events: [event], next: null, total: 1 }); });
afterEach(cleanup);

describe('audit review UI', () => {
  it('renders a genuine repository result and read-only redacted details', async () => {
    render(<AuditLogPage />);
    expect(await screen.findByText('Test Instructor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('true')).toBeTruthy();
    expect(within(dialog).getByText('false')).toBeTruthy();
    expect(within(dialog).getAllByText('Redacted')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
  it('shows loading, empty results and safe failure with retry', async () => {
    let reject!: (error: Error) => void;
    list.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    render(<AuditLogPage />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    await act(async () => reject(new Error('private database details')));
    expect(screen.getByRole('alert').textContent).toContain('Unable to load');
    expect(screen.queryByText('private database details')).toBeNull();
    list.mockResolvedValueOnce({ events: [], next: null, total: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('No events match these filters.')).toBeTruthy();
  });
  it('filters on the server and resets pagination without fetching all rows', async () => {
    const cursor = { id: event.id, time: event.occurred_at };
    list.mockResolvedValueOnce({ events: [event], next: cursor, total: 50 });
    render(<AuditLogPage />);
    await screen.findByText('Test Instructor');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.anything(), cursor, expect.any(AbortSignal)));
    await screen.findByText('Test Instructor');
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'deleted' } });
    fireEvent.change(screen.getByLabelText('Search actor name or event'), { target: { value: 'Instructor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'deleted', search: 'Instructor' }), null, expect.any(AbortSignal)));
    expect(screen.getByText('Page 1')).toBeTruthy();
  });
  it('aborts on unmount and ignores stale results', async () => {
    let resolve!: (page: AuditPage) => void;
    list.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const { unmount } = render(<AuditLogPage />);
    const signal = list.mock.calls[0][2];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ events: [event], next: null, total: 1 }));
    expect(screen.queryByText('Test Instructor')).toBeNull();
  });
  it('validates user/date filters and renders Arabic with RTL', async () => {
    state.language = 'ar';
    render(<AuditLogPage />);
    const title = await screen.findByRole('heading', { name: 'سجل التدقيق' });
    expect(title.closest('section')?.getAttribute('dir')).toBe('rtl');
    await screen.findByText('Test Instructor');
    fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('حتى تاريخ'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'تطبيق الفلاتر' }));
    expect(screen.getByRole('alert').textContent).toContain('تحقق');
    expect(list).toHaveBeenCalledTimes(1);
  });
  it('renders supplied text literally rather than executing markup', async () => {
    list.mockResolvedValueOnce({ events: [{ ...event, actor_name: '<img src=x onerror=alert(1)>' }], next: null, total: 1 });
    const { container } = render(<AuditLogPage />);
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });
});

it.each(['en','ar'] as const)('filters new catalog audit events in %s without changing access rules', async language => {
  state.language=language;
  list.mockResolvedValue({events:[{...event,entity_type:'course_definitions',actor_role:'admin',super_admin_only:true}],next:null,total:1});
  render(<AuditLogPage />);
  await screen.findByText('Test Instructor');
  fireEvent.change(screen.getByLabelText(language==='ar'?'الكيان':'Entity'),{target:{value:'course_definitions'}});
  fireEvent.click(screen.getByRole('button',{name:language==='ar'?'تطبيق الفلاتر':'Apply filters'}));
  await waitFor(()=>expect(list).toHaveBeenLastCalledWith(expect.objectContaining({entity:'course_definitions'}),null,expect.any(AbortSignal)));
  expect(screen.getAllByText(language==='ar'?'تعريفات المواد':'Course definitions').length).toBeGreaterThan(0);
});

it('clears Owner details and aborts requests when the viewer role changes', async () => {
  const { rerender } = render(<AuditLogPage />);
  await screen.findByText('Test Instructor');
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  const signal = list.mock.calls[0][2];
  state.role = 'admin'; list.mockResolvedValue({ events: [], next: null, total: 0 });
  rerender(<AuditLogPage />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(signal.aborted).toBe(true);
  await screen.findByText('No events match these filters.');
  state.role = 'student'; rerender(<AuditLogPage />);
  expect(screen.queryByText('Audit log')).toBeNull();
});
