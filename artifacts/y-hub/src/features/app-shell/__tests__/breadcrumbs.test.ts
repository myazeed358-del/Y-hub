import { describe, expect, it } from 'vitest';
import { createModuleRegistry, type ModuleManifest } from '@/modules';
import { resolveBreadcrumbs } from '../domain/breadcrumbs';
import { resolvePageTitle } from '../domain/resolvePageTitle';

const t = (key: string) => key;
const student = { role: 'student' as const, major: 'mathematics' };
const resolve = (path: string) => resolveBreadcrumbs(path, 'Current', 'en', t, student);

describe('contextual breadcrumbs', () => {
  it.each(['/', '/dashboard', '/profile', '/y-sheets', '/attendance', '/engine-access', '/calculus-1'])('hides root %s', path => {
    expect(resolve(path)).toEqual([]);
  });
  it('links the student Tutor to the read-only course route without exposing IDs as labels', () => {
    expect(resolve('/course/private-id/ai-tutor?token=private#section')).toEqual([
      { label: 'overview', href: '/dashboard' },
      { label: 'coursePlan', href: '/course/private-id/view' },
      { label: 'Current' },
    ]);
  });
  it.each(['instructor', 'admin', 'super_admin'] as const)('links %s to the existing course manager', role => {
    const result = resolveBreadcrumbs('/course/id/ai-tutor', 'Tutor', 'ar', t, { role });
    expect(result[1].href).toBe('/course/id');
  });
  it.each(['/course/id', '/course/id/view/', '/exam/id', '/lesson/intro'])('does not invent a parent entity for %s', path => {
    expect(resolve(path)).toEqual([{ label: 'overview', href: '/dashboard' }, { label: 'Current' }]);
  });
  it.each(['/unknown/secret', '/course/id/unknown', '//evil.test/path', '/course/%2Fbad/ai-tutor', '/course/../ai-tutor'])('does not create links from unknown/unsafe route %s', path => {
    expect(resolve(path)).toEqual([]);
  });
  it('does not disclose navigation without a resolved role', () => {
    expect(resolveBreadcrumbs('/course/id/view', 'Course', 'en', t, { role: null })).toEqual([]);
  });
  it('discovers future module ancestors from validated API v2 manifests, without central registration', () => {
    const manifest: ModuleManifest = {
      apiVersion: 2, id: 'future-app', version: '1.0.0', kind: 'application', category: 'education',
      title: { en: 'Future app', ar: 'تطبيق' }, access: { roles: ['student'] },
      routes: ['/future', '/future/tools', '/future/tools/details'].map(path => ({
        path, load: async () => ({ default: () => null }),
        navigation: { group: 'applications', iconId: 'box', order: 1, title: { en: path, ar: 'أدوات' } },
      })),
    };
    const { routes } = createModuleRegistry({ fixture: manifest });
    expect(resolveBreadcrumbs('/future/tools/details', 'Details', 'ar', t, student, routes)).toEqual([
      { label: 'overview', href: '/dashboard' }, { label: 'أدوات', href: '/future' },
      { label: 'أدوات', href: '/future/tools' }, { label: 'Details' },
    ]);
    expect(resolveBreadcrumbs('/future/tools/details', 'Details', 'en', t, { role: 'admin' }, routes)).toEqual([]);
    const restricted = routes.map(route => ({ ...route, module: { ...route.module, access: { roles: ['student' as const], permissions: ['course:read' as const] } } }));
    expect(resolveBreadcrumbs('/future/tools/details', 'Details', 'en', t, student, restricted)).toEqual([]);
  });
  it('keeps contextual page titles translated independently of breadcrumbs', () => {
    expect(resolvePageTitle('/course/id/ai-tutor?source=book', 'ar', t)).toBe('المعلم الذكي');
    expect(resolvePageTitle('/exam/id/', 'en', t)).toBe('Exam');
  });
});
