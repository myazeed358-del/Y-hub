import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { Box } from 'lucide-react';
import { StudentDashboardSidebar } from '@/features/student-dashboard/components/StudentDashboardSidebar';
import { getModuleNavigation } from '../navigation';
import { AppRoutes } from '@/routing/AppRoutes';
import { buildNavigationRouteGroups } from '@/features/app-shell/domain/navigationRoutes';
import { SidebarNavigation } from '@/features/app-shell/components/sidebar/SidebarNavigation';
import { createModuleRegistry, type ModuleRegistry } from '../registry';
import { discoveredModules } from '../discovery';
import type { ModuleManifest, ModuleRole } from '../contracts';

const auth = vi.hoisted(() => ({
  user: { id: 'test' } as { id: string } | null,
  role: 'admin' as ModuleRole, loading: false, profile: { major: 'mathematics' },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', setLanguage: vi.fn(), t: (key: string) => key }),
}));
vi.mock('@/features/audit-log', () => ({ default: () => <p>Audit review page</p> }));
vi.mock('@/pages/Login', () => ({ default: () => <p>Sign in required</p> }));
vi.mock('@/pages/ResetPassword', () => ({ default: () => null }));
vi.mock('@/pages/GuestLanding', () => ({ default: () => <p>Guest landing</p> }));
vi.mock('@/pages/Profile', () => ({ default: () => null }));
vi.mock('@/pages/CourseManager', () => ({ default: () => null }));
vi.mock('@/pages/StudentCourseView', () => ({ default: () => null }));
vi.mock('@/pages/AIGenerator', () => ({ default: () => null }));
vi.mock('@/pages/ExamRunner', () => ({ default: () => null }));
vi.mock('@/routing/RoleBasedDashboard', () => ({ RoleBasedDashboard: () => <p>Dashboard intact</p> }));
vi.mock('@/features/app-shell/components/sidebar/SidebarLessonPath', () => ({ SidebarLessonPath: () => null }));

const Placeholder = () => null;
function mount(registry: ModuleRegistry, path: string) {
  const location = memoryLocation({ path });
  const navigation = buildNavigationRouteGroups(auth.role, auth.profile.major, registry).map(group => ({
    ...group, items: group.items.map(item => ({ ...item, icon: Box })),
  }));
  const tools = getModuleNavigation(registry, { role: auth.role, major: auth.profile.major }, 'dashboard')
    .map(item => ({ name: item.title.en, path: item.href, icon: Box }));
  render(<Router hook={location.hook}>
    <StudentDashboardSidebar tools={tools} t={key => key} setLocation={location.navigate} />
    <SidebarNavigation isInstructor={false} location={path} onCloseMobileNav={() => {}}
      dynamicNavItems={navigation} onEngineInfoTooltipChange={() => {}} />
    <AppRoutes Home={Placeholder} CoursePlan={Placeholder} LessonPage={Placeholder}
      Lab={Placeholder} Quiz={Placeholder} NotFound={() => <p>Not found</p>} modules={registry} />
  </Router>);
  return location;
}
function custom(load: ModuleManifest['routes'][number]['load'], access: ModuleManifest['access'] = { roles: ['admin'] }, kind: ModuleManifest['kind'] = 'application') {
  return createModuleRegistry({ custom: {
    id: 'custom', version: '1.0.0', apiVersion: 2, kind, category: 'education', title: { ar: 'اختبار', en: 'Custom module' },
    access, routes: [{ path: '/custom', load, navigation: { group: 'applications', iconId: 'box', order: 1 } }],
  } });
}
beforeEach(() => {
  auth.user = { id: 'test' }; auth.role = 'admin'; auth.loading = false; auth.profile.major = 'mathematics';
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('real host module integration', () => {
  it.each(['student', 'instructor', 'admin', 'super_admin'] as const)('enforces the audit module role guard for %s', async role => {
    auth.role = role;
    mount(createModuleRegistry(discoveredModules), '/audit-log');
    if (role === 'admin' || role === 'super_admin') {
      expect(await screen.findByText('Audit review page')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Audit log' })).toBeTruthy();
    } else {
      expect(screen.getByText('This tool is not available for your account')).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Audit log' })).toBeNull();
    }
  });

  it.each(['math', 'science', 'application', 'laboratory'])('discovers and lazy-loads the %s fixture through actual navigation', async name => {
    const fixtures = import.meta.glob('./fixtures/*/module.ts', { eager: true, import: 'default' });
    const registry = createModuleRegistry(fixtures);
    expect(registry.issues).toEqual([]);
    mount(registry, '/');
    fireEvent.click(screen.getByRole('link', { name: 'Fixture ' + name }));
    expect(await screen.findByText('Classification fixture loaded')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fixture ' + name })).toBeTruthy();
  });

  it('discovers the example, contributes a sidebar link and navigates to its lazy page without a host edit', async () => {
    const registry = createModuleRegistry(discoveredModules, { enabledIds: ['discovery-example'] });
    mount(registry, '/');
    expect(screen.getByText('Dashboard intact')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Module discovery example' }));
    expect(await screen.findByText('Automatically discovered module entry')).toBeTruthy();
  });

  it('contributes a dashboard tool that navigates without a host registry edit', async () => {
    const registry = createModuleRegistry(discoveredModules, { enabledIds: ['discovery-example'] });
    mount(registry, '/');
    fireEvent.click(screen.getByRole('button', { name: 'Module discovery example' }));
    expect(await screen.findByText('Automatically discovered module entry')).toBeTruthy();
  });

  it('keeps the example absent from routes and sidebar by default', () => {
    mount(createModuleRegistry(discoveredModules), '/module-example');
    expect(screen.getByText('Not found')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Module discovery example' })).toBeNull();
  });

  it.each(['student', 'instructor', 'super_admin'] as const)('rejects unauthorized direct access by %s', async role => {
    auth.role = role;
    const load = vi.fn(async () => ({ default: () => <p>Private module</p> }));
    mount(custom(load), '/custom');
    expect(screen.getByText('This tool is not available for your account')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Custom module' })).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('requires login before evaluating the module loader', () => {
    auth.user = null;
    const load = vi.fn(async () => ({ default: Placeholder }));
    mount(custom(load), '/custom');
    expect(screen.getByText('Sign in required')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('applies academic major restrictions on direct routes', () => {
    auth.role = 'student'; auth.profile.major = 'medicine';
    const load = vi.fn(async () => ({ default: Placeholder }));
    mount(custom(load, { roles: ['student'], majors: ['mathematics'] }), '/custom');
    expect(screen.getByText('This tool is not available for your account')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it.each(['engine', 'application', 'laboratory'] as const)('fails closed for missing resource grants on a %s', kind => {
    const load = vi.fn(async () => ({ default: Placeholder }));
    mount(custom(load, { roles: ['admin'], permissions: ['course:manage'] }, kind), '/custom');
    expect(screen.getByText('This tool is not available for your account')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('shows loading while the entry is unresolved', async () => {
    let resolve!: (entry: { default: React.ComponentType }) => void;
    const pending = new Promise<{ default: React.ComponentType }>(done => { resolve = done; });
    mount(custom(() => pending), '/custom');
    expect(screen.getByRole('status').textContent).toContain('Loading');
    await act(async () => { resolve({ default: () => <p>Lazy entry ready</p> }); });
    expect(await screen.findByText('Lazy entry ready')).toBeTruthy();
  });

  it.each(['engine', 'application', 'laboratory'] as const)('contains and retries a %s loader failure while keeping the host working', async kind => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn<ModuleManifest['routes'][number]['load']>()
      .mockRejectedValueOnce(new Error('Chunk unavailable'))
      .mockResolvedValueOnce({ default: () => <p>Recovered module</p> });
    const location = mount(custom(load, undefined, kind), '/custom');
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Custom module' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Recovered module')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
    act(() => location.navigate('/dashboard'));
    expect(screen.getByText('Dashboard intact')).toBeTruthy();
  });

  it('contains render errors and recovers on navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const location = mount(custom(async () => ({ default: () => { throw new Error('Module render failed'); } })), '/custom');
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    act(() => location.navigate('/dashboard'));
    expect(screen.getByText('Dashboard intact')).toBeTruthy();
  });

  it('keeps unrelated routes functional when invalid manifests are quarantined', () => {
    mount(createModuleRegistry({ broken: {} }), '/dashboard');
    expect(screen.getByText('Dashboard intact')).toBeTruthy();
  });
});
