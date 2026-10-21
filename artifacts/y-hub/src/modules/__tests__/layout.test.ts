import { expect, it } from 'vitest';
import { createModuleRegistry } from '../registry';
import { getModuleLayout } from '../layout';
import sheets from '../y-sheets/module';

it('discovers fullscreen from metadata, not module identity or URL', () => {
  const registry = createModuleRegistry({ app: { ...sheets, id: 'future-app', routes: [{ ...sheets.routes[0], path: '/future-app' }] } });
  expect(getModuleLayout(registry, '/future-app', { role: 'student' })).toBe('fullscreen');
  expect(getModuleLayout(registry, '/y-sheets', { role: 'student' })).toBe('standard');
  expect(getModuleLayout(registry, '/FUTURE-APP/', { role: 'student' })).toBe('fullscreen');
});
it('defaults to standard and fails closed on disabled, invalid or unauthorized manifests', () => {
  const base = createModuleRegistry({ app: sheets });
  expect(getModuleLayout(base, '/y-sheets', { role: null })).toBe('standard');
  expect(getModuleLayout(createModuleRegistry({ app: sheets }, { disabledIds: ['y-sheets'] }), '/y-sheets', { role: 'admin' })).toBe('standard');
  expect(getModuleLayout(base, '/dashboard', { role: 'admin' })).toBe('standard');
  const invalid = createModuleRegistry({ app: { ...sheets, routes: [{ ...sheets.routes[0], layout: 'bypass' }] } });
  expect(invalid.routes).toEqual([]);
  expect(invalid.issues[0].code).toBe('invalid-manifest');
  const standard = createModuleRegistry({ app: { ...sheets, routes: [{ ...sheets.routes[0], layout: undefined }] } });
  expect(getModuleLayout(standard, '/y-sheets', { role: 'student' })).toBe('standard');
});
