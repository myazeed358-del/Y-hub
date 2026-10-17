import { supabase } from '@/utils/supabaseClient';
import { z } from 'zod';
import { auditEventSchema, filterParameters, PAGE_SIZE, type AuditCursor, type AuditFilters, type AuditPage } from '../domain/auditLog';

/** Read-only repository. PostgreSQL owns event creation and authorization. */
export async function listAuditEvents(filters: AuditFilters, cursor: AuditCursor | null, signal: AbortSignal): Promise<AuditPage> {
  const { data, error } = await supabase.rpc('search_audit_events', {
    ...filterParameters(filters), p_before_time: cursor?.time ?? null, p_before_id: cursor?.id ?? null, p_limit: PAGE_SIZE + 1,
  }).abortSignal(signal);
  if (error) throw new Error('Audit log query failed'); // Do not expose backend/internal errors in UI.
  const rows = z.array(auditEventSchema).parse(data);
  const events = rows.slice(0, PAGE_SIZE);
  const last = events.at(-1);
  return { events, next: rows.length > PAGE_SIZE && last ? { time: last.occurred_at, id: last.id } : null };
}
