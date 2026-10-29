import { z } from 'zod';

export const PAGE_SIZE = 25;
export const AUDIT_ACTIONS = ['created', 'updated', 'deleted', 'published', 'unpublished', 'enrollment_opened', 'enrollment_closed', 'enrollment_changed', 'role_changed', 'access_changed'] as const;
export const AUDIT_ENTITIES = ['courses', 'course_definitions', 'course_materials', 'exams', 'questions', 'course_enrollments', 'syllabus_units', 'syllabus_sections', 'users', 'lesson_completion_rules', 'lesson_completion_overrides'] as const;
export const auditPersonSchema = z.object({
  person_id: z.string().uuid(), relation: z.enum(['actor', 'affected']),
  full_name: z.string(), full_name_ar: z.string().nullable(), full_name_en: z.string().nullable(),
  user_number: z.string().regex(/^\d{9}$/).nullable(), recorded: z.boolean(),
});
export type AuditPerson = z.infer<typeof auditPersonSchema>;
export type PersonScope = 'actor' | 'affected' | 'either';
export const auditEventSchema = z.object({
  id: z.string().uuid(), occurred_at: z.string(), actor_id: z.string().uuid().nullable(),
  actor_role: z.enum(['system', 'student', 'instructor', 'admin', 'super_admin']), actor_name: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']), actions: z.array(z.string()),
  entity_type: z.string(), entity_id: z.string().uuid(),
  sensitivity: z.enum(['normal', 'high', 'critical']), super_admin_only: z.boolean(),
  people: z.array(auditPersonSchema).default([]),
  old_values: z.record(z.unknown()), new_values: z.record(z.unknown()), context: z.record(z.unknown()),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
export interface AuditFilters { search: string; actor: string; action: string; entity: string; from: string; to: string; personSearch: string; personScope: PersonScope }
export interface AuditCursor { time: string; id: string }
export interface AuditPage { events: AuditEvent[]; next: AuditCursor | null; total: number }
export const emptyFilters: AuditFilters = { search: '', actor: '', action: '', entity: '', from: '', to: '', personSearch: '', personScope: 'either' };

export function filterParameters(filters: AuditFilters) {
  if (filters.personSearch.trim().length > 120 || !['actor', 'affected', 'either'].includes(filters.personScope)) throw new Error('Invalid person filters');
  if (filters.search.trim().length > 200 || (filters.actor && !z.string().uuid().safeParse(filters.actor.trim()).success)) throw new Error('Invalid filters');
  const date = (value: string) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date');
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
    return parsed;
  };
  const from = date(filters.from), to = date(filters.to);
  if (from && to && from > to) throw new Error('Invalid date range');
  if (to) to.setUTCDate(to.getUTCDate() + 1);
  return { p_person_search: filters.personSearch.trim(), p_person_scope: filters.personScope, p_search: filters.search.trim(), p_actor: filters.actor.trim() || null,
    p_action: filters.action || null, p_entity: filters.entity || null,
    p_from: from?.toISOString() ?? null, p_to: to?.toISOString() ?? null };
}
