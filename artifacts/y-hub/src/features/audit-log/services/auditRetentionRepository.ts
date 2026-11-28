import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
const revision = z.number().int().nonnegative();
const policy = z.object({ months: z.number().int().min(12).max(60), revision });
const hold = z.object({ active: z.boolean(), revision });
export type RetentionPolicy = z.infer<typeof policy>;
export type InvestigationHold = z.infer<typeof hold>;
async function request(name: string, parameters: Record<string, unknown>, signal: AbortSignal) {
  const { data, error } = await supabase.rpc(name, parameters).abortSignal(signal);
  if (error) throw new Error('Audit retention request failed');
  return data;
}
export async function getRetentionPolicy(signal: AbortSignal) {
  return policy.parse(await request('get_audit_retention_policy', {}, signal));
}
export async function saveRetentionPolicy(months: number, expectedRevision: number, signal: AbortSignal) {
  policy.parse({ months, revision: expectedRevision });
  return policy.parse(await request('set_audit_retention_policy', { p_months: months, p_revision: expectedRevision }, signal));
}
export async function getInvestigationHold(event: string, signal: AbortSignal) {
  z.string().uuid().parse(event);
  return hold.parse(await request('get_audit_investigation_hold', { p_event: event }, signal));
}
export async function saveInvestigationHold(event: string, active: boolean, expectedRevision: number, signal: AbortSignal) {
  z.string().uuid().parse(event); hold.parse({ active, revision: expectedRevision });
  return hold.parse(await request('set_audit_investigation_hold', { p_event: event, p_active: active, p_revision: expectedRevision }, signal));
}
