import { expect, it } from 'vitest';
import { moduleRegistry } from '@/modules';
import { canAccessModule } from '@/modules/access';
import { ENGINE_CATALOG } from '@/config/majorEngineAccess';
it('is automatically discovered as an application with a lazy guarded route', () => {
  const module = moduleRegistry.modules.find(m => m.id === 'academic-management')!;
  expect(module.kind).toBe('application');
  expect(module.routes[0].path).toBe('/academic-management');
  expect(module.routes[0].load).toBeTypeOf('function');
  expect(ENGINE_CATALOG.some(e => e.route === '/academic-management')).toBe(false);
});
it('allows staff presentation and denies student/guest presentation', () => {
  const module = moduleRegistry.modules.find(m => m.id === 'academic-management')!;
  for (const role of ['instructor','admin','super_admin'] as const) expect(canAccessModule(module.access, { role })).toBe(true);
  expect(canAccessModule(module.access, { role: 'student' })).toBe(false);
  expect(canAccessModule(module.access, { role: null })).toBe(false);
});
