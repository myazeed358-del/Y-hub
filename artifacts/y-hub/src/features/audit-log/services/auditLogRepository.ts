import { supabase } from '@/utils/supabaseClient';
import { z } from 'zod';
import { auditEventSchema, auditPersonSchema, type PersonScope, filterParameters, PAGE_SIZE, type AuditCursor, type AuditFilters, type AuditPage } from '../domain/auditLog';

/** Read-only repository. PostgreSQL owns event creation and authorization. */
export async function listAuditEvents(filters: AuditFilters, cursor: AuditCursor | null, signal: AbortSignal): Promise<AuditPage> {
  const { data, error } = await supabase.rpc('search_audit_events_v2', {
    ...filterParameters(filters), p_before_time: cursor?.time ?? null, p_before_id: cursor?.id ?? null, p_limit: PAGE_SIZE + 1,
  }).abortSignal(signal);
  if (error) throw new Error('Audit log query failed'); // Do not expose backend/internal errors in UI.
  const response = z.object({ events: z.array(auditEventSchema), total: z.number().int().nonnegative() }).parse(data);
  const rows = response.events;
  const events = rows.slice(0, PAGE_SIZE);
  const last = events.at(-1);
  return { events, total: response.total, next: rows.length > PAGE_SIZE && last ? { time: last.occurred_at, id: last.id } : null };
}

export async function suggestAuditPeople(search: string, scope: PersonScope, signal: AbortSignal) {
  if (search.trim().length < 2) return [];
  if (search.length > 120 || !['actor', 'affected', 'either'].includes(scope)) throw new Error('Invalid person filters');
  const { data, error } = await supabase.rpc('suggest_audit_people', { p_search: search.trim(), p_scope: scope, p_limit: 10 }).abortSignal(signal);
  if (error) throw new Error('Person search failed');
  return z.array(auditPersonSchema).max(10).parse(data);
}
