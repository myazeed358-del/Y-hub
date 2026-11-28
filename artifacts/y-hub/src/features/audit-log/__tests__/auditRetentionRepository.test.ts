import { beforeEach, expect, it, vi } from 'vitest';
import { getRetentionPolicy, saveRetentionPolicy, getInvestigationHold, saveInvestigationHold } from '../services/auditRetentionRepository';
const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { rpc } }));
const signal = new AbortController().signal;
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.resetAllMocks(); rpc.mockReturnValue({ abortSignal }); });
it('reads a validated policy and propagates cancellation', async () => {
  abortSignal.mockResolvedValue({ data: { months: 24, revision: 0 }, error: null });
  expect(await getRetentionPolicy(signal)).toEqual({ months: 24, revision: 0 });
  expect(abortSignal).toHaveBeenCalledWith(signal);
});
it('validates policy before transport', async () => {
  for (const months of [11,61,24.5,NaN]) await expect(saveRetentionPolicy(months, 0, signal)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it('does not accept malformed server results or expose database errors', async () => {
  abortSignal.mockResolvedValueOnce({ data: { months: 70, revision: 0 }, error: null });
  await expect(getRetentionPolicy(signal)).rejects.toThrow();
  abortSignal.mockResolvedValueOnce({ data: null, error: { message: 'internal secret' } });
  await expect(getRetentionPolicy(signal)).rejects.toThrow('Audit retention request failed');
});
it('validates event and revision before transport', async () => {
  await expect(getInvestigationHold('bad', signal)).rejects.toThrow();
  await expect(saveInvestigationHold(id,true,-1,signal)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it('sends compare-and-set hold inputs without caller actor or role', async () => {
  abortSignal.mockResolvedValue({ data: { active: true, revision: 2 }, error: null });
  expect(await saveInvestigationHold(id,true,1,signal)).toEqual({ active: true, revision: 2 });
  expect(rpc).toHaveBeenCalledWith('set_audit_investigation_hold', { p_event:id,p_active:true,p_revision:1 });
});
