import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAuditEvents } from '../services/auditLogRepository';
import { emptyFilters, filterParameters, PAGE_SIZE } from '../domain/auditLog';
import { event } from './fixtures';
const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { rpc } }));
beforeEach(() => { vi.clearAllMocks(); rpc.mockReturnValue({ abortSignal }); });

describe('read-only audit repository', () => {
  it('requests one bounded page with a keyset and returns no lookahead duplicate', async () => {
    abortSignal.mockResolvedValue({ data: Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ ...event, id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}` })), error: null });
    const cursor = { time: event.occurred_at, id: event.id };
    const signal = new AbortController().signal;
    const page = await listAuditEvents({ ...emptyFilters, actor: event.actor_id!, action: 'unpublished', from: '2026-10-17', to: '2026-10-17' }, cursor, signal);
    expect(rpc).toHaveBeenCalledWith('search_audit_events', expect.objectContaining({ p_limit: 26, p_actor: event.actor_id, p_action: 'unpublished', p_before_id: event.id, p_from: '2026-10-17T00:00:00.000Z', p_to: '2026-10-18T00:00:00.000Z' }));
    expect(abortSignal).toHaveBeenCalledWith(signal);
    expect(page.events).toHaveLength(25);
    expect(page.next?.id).toBe(page.events[24].id);
  });
  it('handles empty and final pages', async () => {
    abortSignal.mockResolvedValue({ data: [], error: null });
    expect(await listAuditEvents(emptyFilters, null, new AbortController().signal)).toEqual({ events: [], next: null });
  });
  it('propagates query failures without exposing backend error details', async () => {
    abortSignal.mockResolvedValue({ data: null, error: { message: 'internal secret' } });
    await expect(listAuditEvents(emptyFilters, null, new AbortController().signal)).rejects.toThrow('Audit log query failed');
  });
  it('rejects malformed database responses', async () => {
    abortSignal.mockResolvedValue({ data: [{ id: 'invalid' }], error: null });
    await expect(listAuditEvents(emptyFilters, null, new AbortController().signal)).rejects.toThrow();
  });
  it.each([{ actor: 'not-uuid' }, { from: '2026-02-30' }, { from: '2026-12-01', to: '2026-01-01' }, { search: 'a'.repeat(201) }])('rejects invalid filters without a network request: %j', async patch => {
    await expect(listAuditEvents({ ...emptyFilters, ...patch }, null, new AbortController().signal)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('handles inclusive through-date across month/year boundaries', () => {
    expect(filterParameters({ ...emptyFilters, to: '2026-12-31' }).p_to).toBe('2027-01-01T00:00:00.000Z');
  });
});
