import type { AuditEvent } from '../domain/auditLog';
export const event: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111', occurred_at: '2026-10-17T10:00:00Z',
  actor_id: '22222222-2222-4222-8222-222222222222', actor_role: 'instructor', actor_name: 'Test Instructor',
  operation: 'UPDATE', actions: ['updated', 'unpublished'], entity_type: 'courses',
  entity_id: '33333333-3333-4333-8333-333333333333', sensitivity: 'normal', super_admin_only: false,
  old_values: { is_published: true, title: '[REDACTED]' }, new_values: { is_published: false, title: '[REDACTED]' },
  people: [],
  context: { changed_fields: ['is_published', 'title'] },
};
