import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
import { auditEventSchema, PAGE_SIZE } from '../domain/auditLog';
const selection = z.array(z.string().uuid()).min(1).max(PAGE_SIZE).refine(ids => new Set(ids).size === ids.length);
const exportSchema = z.object({
  format_version: z.literal(1), export_id: z.string().uuid(), issued_at: z.string().datetime({ offset: true }),
  scope: z.literal('selected_page'), events: z.array(auditEventSchema).min(1).max(PAGE_SIZE),
});
export type AuditExport = z.infer<typeof exportSchema>;
export async function exportAuditPage(ids: string[], signal: AbortSignal): Promise<AuditExport> {
  selection.parse(ids);
  const { data, error } = await supabase.rpc('export_audit_page', { p_event_ids: ids }).abortSignal(signal);
  if (error) throw new Error('Audit export failed');
  const result = exportSchema.parse(data);
  const received = new Set(result.events.map(event => event.id));
  if (result.events.length !== ids.length || received.size !== ids.length || ids.some(id => !received.has(id))) throw new Error('Audit export selection mismatch');
  return result;
}
/** A download request is not proof that the browser saved the file. */
export function downloadAuditExport(data: AuditExport): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  try {
    anchor.href = url; anchor.download = `y-hub-audit-${data.export_id}.json`;
    document.body.append(anchor); anchor.click();
  } finally {
    anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
