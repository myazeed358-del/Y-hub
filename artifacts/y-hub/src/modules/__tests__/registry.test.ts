import { describe, expect, it, vi } from 'vitest';
import { createModuleRegistry } from '../registry';
import { canAccessModule } from '../access';
import { getModuleNavigation } from '../navigation';
import { discoveredModules, moduleRegistry } from '../discovery';
import type { ModuleManifest } from '../contracts';

const load = vi.fn(async () => ({ default: () => null }));
function manifest(id = 'example', patch: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id, version: '1.0.0', apiVersion: 2, kind: 'application', category: 'education',
    title: { en: id, ar: id },
    access: { roles: ['student', 'instructor', 'admin', 'super_admin'],
      majors: ['mathematics'], majorRestrictedRoles: ['student'] },
    routes: [{ path: '/' + id, load, navigation: { group: 'applications', iconId: 'box', order: 1 } }],
    ...patch,
  };
}

describe('module validation and dependency isolation', () => {
  it('discovers existing engines with no eager entry execution', () => {
    expect(moduleRegistry.issues).toEqual([]);
    expect(moduleRegistry.routes.map(route => route.path)).toEqual([
      '/ode', '/linear-algebra', '/math-solver', '/solver', '/calculus-1', '/calculus', '/lab', '/y-sheets', '/audit-log', '/engine-access',
    ]);
    const registry = createModuleRegistry({ example: manifest() });
    expect(registry.routes).toHaveLength(1);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    undefined, {}, manifest('Uppercase'),
    { ...manifest(), apiVersion: 3 },
    { ...manifest(), version: 'next' },
    { ...manifest(), title: { en: 'Missing Arabic' } },
    { ...manifest(), access: { roles: ['owner'] } },
    { ...manifest(), access: { roles: ['admin'], permissions: ['admin:everything'] } },
    { ...manifest(), routes: [{ path: '/example', load: 'not a function' }] },
    { ...manifest(), routes: [{ path: '/example/', load }] },
    { ...manifest(), routes: [{ path: '/EXAMPLE', load }] },
    { ...manifest(), routes: [{ path: '/:id', load }] },
    { ...manifest(), routes: [{ path: '/example', load, navigation: { group: 'applications', iconId: 'bad', order: 0 } }] },
    { ...manifest(), routes: [{ path: '/example', load, navigation: { group: 'applications', iconId: 'box', order: 0, labelKey: 'missing-copy' } }] },
  ])('quarantines invalid manifests while preserving a healthy module: %j', bad => {
    const registry = createModuleRegistry({ bad, healthy: manifest('healthy') });
    expect(registry.modules.map(module => module.id)).toEqual(['healthy']);
    expect(registry.issues[0].code).toBe('invalid-manifest');
  });

  it('quarantines both duplicate IDs independent of file order', () => {
    const entries = { first: manifest('duplicate'), second: manifest('duplicate'), healthy: manifest('healthy') };
    const result = createModuleRegistry(entries);
    expect(result.modules.map(module => module.id)).toEqual(['healthy']);
    expect(result.issues.filter(issue => issue.code === 'duplicate-id')).toHaveLength(2);
    expect(createModuleRegistry(Object.fromEntries(Object.entries(entries).reverse()))).toEqual(result);
  });

  it('rejects conflicting routes across and within modules', () => {
    const route = { path: '/collision', load };
    const registry = createModuleRegistry({
      a: manifest('a', { routes: [route] }), b: manifest('b', { routes: [route] }),
      c: manifest('c', { routes: [{ path: '/same', load }, { path: '/same', load }] }),
      healthy: manifest('healthy'),
    });
    expect(registry.modules.map(module => module.id)).toEqual(['healthy']);
    expect(registry.issues.every(issue => issue.code === 'route-collision')).toBe(true);
  });

  it.each(['/login', '/dashboard', '/profile', '/course/123', '/course/123/view', '/course/123/ai-tutor', '/exam/123', '/lesson/example'])(
    'protects the host route %s from shadowing', path => {
      expect(createModuleRegistry({ bad: manifest('bad', { routes: [{ path, load }] }) }).issues[0].code).toBe('reserved-route');
    },
  );

  it('rejects cycles and dependants, retaining independent modules', () => {
    const registry = createModuleRegistry({
      a: manifest('a', { dependencies: ['b'] }), b: manifest('b', { dependencies: ['a'] }),
      dependent: manifest('dependent', { dependencies: ['a'] }), healthy: manifest('healthy'),
    });
    expect(registry.modules.map(module => module.id)).toEqual(['healthy']);
    expect(registry.issues.some(issue => issue.code === 'dependency-cycle')).toBe(true);
    expect(registry.issues.some(issue => issue.code === 'unavailable-dependency')).toBe(true);
  });

  it('propagates disabled/missing dependencies and allows explicit composition selection', () => {
    const manifests = { a: manifest('a', { defaultEnabled: false }), b: manifest('b', { dependencies: ['a'] }) };
    expect(createModuleRegistry(manifests).modules).toEqual([]);
    expect(createModuleRegistry(manifests, { enabledIds: ['a'] }).modules).toHaveLength(2);
    expect(createModuleRegistry(manifests, { enabledIds: ['a'], disabledIds: ['a'] }).modules).toEqual([]);
    expect(createModuleRegistry({ missing: manifest('missing', { dependencies: ['absent'] }) }).modules).toEqual([]);
  });

  it('discovers the disabled example by the production glob and enables it without central registration', () => {
    expect(discoveredModules).toHaveProperty('./discovery-example/module.ts');
    expect(moduleRegistry.routes.some(route => route.path === '/module-example')).toBe(false);
    const enabled = createModuleRegistry(discoveredModules, { enabledIds: ['discovery-example'] });
    expect(enabled.routes.some(route => route.path === '/module-example')).toBe(true);
    expect(getModuleNavigation(enabled, { role: 'admin' }).some(item => item.href === '/module-example')).toBe(true);
    expect(getModuleNavigation(enabled, { role: 'student', major: 'mathematics' }).some(item => item.href === '/module-example')).toBe(false);
  });
});

describe('shared access policy', () => {
  const policy = manifest().access;
  it.each([
    [null, 'mathematics', false], ['student', null, false], ['student', 'medicine', false],
    ['student', 'mathematics', true], ['instructor', 'medicine', true],
    ['admin', null, true], ['super_admin', null, true],
  ] as const)('role %s / major %s -> %s', (role, major, allowed) => {
    expect(canAccessModule(policy, { role, major })).toBe(allowed);
  });

  it('does not bypass explicit module roles even for administrators', () => {
    expect(canAccessModule({ roles: ['instructor'] }, { role: 'admin' })).toBe(false);
  });

  it('fails closed for missing resource permissions', () => {
    const policy = { roles: ['student'], permissions: ['course:read'] } as const;
    expect(canAccessModule(policy, { role: 'student' })).toBe(false);
    expect(canAccessModule(policy, { role: 'student', permissions: ['course:read'] })).toBe(true);
    expect(canAccessModule(policy, { role: 'student', permissions: ['course:manage'] })).toBe(false);
  });

  it('keeps instructor search access wider than normal sidebar discovery', () => {
    const registry = createModuleRegistry({ example: manifest() });
    expect(canAccessModule(policy, { role: 'instructor', major: 'medicine' })).toBe(true);
    expect(getModuleNavigation(registry, { role: 'instructor', major: 'medicine' })).toEqual([]);
  });
});
