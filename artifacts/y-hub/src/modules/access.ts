import type { ModuleAccessContext, ModuleAccessPolicy } from './contracts';

/** UI policy only; services/RLS must independently authorize protected data. */
export function canAccessModule(policy: ModuleAccessPolicy, context: ModuleAccessContext, engineId?: string): boolean {
  if (!context.role || !policy.roles.includes(context.role)) return false;
  if (policy.permissions?.some(permission => !context.permissions?.includes(permission))) return false;
  const restricted = policy.majorRestrictedRoles ?? policy.roles;
  if (policy.majors?.length && restricted.includes(context.role)) {
    return Boolean((context.major && policy.majors.includes(context.major)) ||
      (context.role === 'student' && engineId && context.engineGrants?.includes(engineId)));
  }
  return true;
}
