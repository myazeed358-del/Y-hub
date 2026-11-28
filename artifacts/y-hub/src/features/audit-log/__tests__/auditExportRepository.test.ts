import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { exportAuditPage, downloadAuditExport, type AuditExport } from '../services/auditExportRepository';
import { event } from './fixtures';
const { rpc, abortSignal } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { rpc } }));
const signal = new AbortController().signal;
const exported: AuditExport = { format_version: 1, export_id: '99999999-9999-4999-8999-999999999999', issued_at: '2026-11-28T12:00:00Z', scope: 'selected_page', events: [event] };
beforeEach(() => { vi.resetAllMocks(); rpc.mockReturnValue({ abortSignal }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('requests only IDs and preserves the server-issued evidence identity', async () => {
  abortSignal.mockResolvedValue({ data: exported, error: null });
  expect(await exportAuditPage([event.id], signal)).toEqual(exported);
  expect(rpc).toHaveBeenCalledWith('export_audit_page', { p_event_ids: [event.id] });
  expect(abortSignal).toHaveBeenCalledWith(signal);
});
it.each([[], ['bad'], [event.id,event.id], Array.from({length:26},(_,i)=>`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`)])('rejects invalid selection before transport: %j', async ids => {
  await expect(exportAuditPage(ids,signal)).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
});
it('rejects missing, duplicate, unexpected and malformed returned rows', async () => {
  for (const events of [[], [event,event], [{...event,id: exported.export_id}]]) {
    abortSignal.mockResolvedValue({ data:{...exported,events}, error:null });
    await expect(exportAuditPage([event.id],signal)).rejects.toThrow();
  }
  abortSignal.mockResolvedValue({data:{...exported,issued_at:'bad'},error:null});
  await expect(exportAuditPage([event.id],signal)).rejects.toThrow();
});
it('does not expose internal errors', async () => {
  abortSignal.mockResolvedValue({data:null,error:{message:'secret SQL'}});
  await expect(exportAuditPage([event.id],signal)).rejects.toThrow('Audit export failed');
});
it('downloads JSON with a validated-server identity filename and releases its object URL', () => {
  vi.useFakeTimers();
  const createObjectURL = vi.fn().mockReturnValue('blob:local-export'), revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL,revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this: HTMLAnchorElement) {
    expect(this.download).toBe(`y-hub-audit-${exported.export_id}.json`);
    expect(this.href).toBe('blob:local-export');
  });
  downloadAuditExport(exported);
  expect(click).toHaveBeenCalledOnce();
  expect(createObjectURL.mock.calls[0][0].type).toBe('application/json;charset=utf-8');
  expect(document.querySelector('a')).toBeNull();
  vi.runAllTimers(); expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-export');
});
