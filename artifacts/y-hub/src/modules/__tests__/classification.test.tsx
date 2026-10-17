import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { Box } from 'lucide-react';
import { createModuleRegistry } from '../registry';
import { moduleRegistry } from '../discovery';
import { getModuleNavigation } from '../navigation';
import { canAccessModule } from '../access';
import type { ModuleManifest } from '../contracts';
import {
  ENGINE_CATALOG, ALL_ENGINE_ROUTES, getEngineCatalog, searchEngines,
  getSidebarEngineRoutes, getAllowedEngineRoutes, canRoleAccessEngineRoute,
} from '@/config/majorEngineAccess';
import { buildNavigationRouteGroups } from '@/features/app-shell/domain/navigationRoutes';
import { resolveInstructorEngineSearch } from '@/features/app-shell/domain/instructorEngineSearch';
import { SidebarNavigation } from '@/features/app-shell/components/sidebar/SidebarNavigation';
import { EngineInfoTooltip } from '@/features/app-shell/components/EngineInfoTooltip';

// Discover fixture metadata with the same Vite glob pattern. No host inventory edits.
vi.mock('../discovery', async importOriginal => {
  const actual = await importOriginal<typeof import('../discovery')>();
  const { createModuleRegistry } = await import('../registry');
  const fixtures = import.meta.glob('./fixtures/*/module.ts', { eager: true, import: 'default' });
  return { ...actual, moduleRegistry: createModuleRegistry({ ...actual.discoveredModules, ...fixtures }) };
});
vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('@/features/app-shell/components/sidebar/SidebarLessonPath', () => ({ SidebarLessonPath: () => null }));
afterEach(() => cleanup());

function fixture(name: string): ModuleManifest {
  const module = moduleRegistry.modules.find(item => item.id === 'fixture-' + name);
  if (!module) throw new Error('Undiscovered fixture: ' + name);
  return module;
}

describe('independent module classification', () => {
  it('discovers mathematical/scientific engines, applications and laboratories', () => {
    expect(moduleRegistry.issues).toEqual([]);
    expect(fixture('math').kind).toBe('engine');
    expect(fixture('science')).toMatchObject({ kind: 'engine', category: 'physics', access: { majors: ['engineering'] } });
    expect(fixture('application').kind).toBe('application');
    expect(fixture('laboratory')).toMatchObject({ kind: 'laboratory', category: 'custom:astronomy' });
    expect(ENGINE_CATALOG.filter(item => item.id.startsWith('fixture-')).map(item => item.id)).toEqual(['fixture-math', 'fixture-science']);
    expect(searchEngines('physics').map(item => item.id)).toContain('fixture-science');
  });

  it('keeps applications/laboratories out of every engine-specific selector and instructor search', () => {
    expect(resolveInstructorEngineSearch('instructor', 'fixture', 'en').instructorSearchResults.map(item => item.id)).toEqual(['fixture-math', 'fixture-science']);
    for (const name of ['application', 'laboratory']) {
      const path = '/fixture-' + name;
      expect(ALL_ENGINE_ROUTES).not.toContain(path);
      expect(getSidebarEngineRoutes('admin')).not.toContain(path);
      expect(getAllowedEngineRoutes('mathematics')).not.toContain(path);
      expect(canRoleAccessEngineRoute('admin', null, path)).toBe(false);
      expect(searchEngines('Fixture ' + name)).toEqual([]);
      expect(canAccessModule(fixture(name).access, { role: 'student' })).toBe(true);
    }
  });

  it('does not infer kind or access from subject, capabilities or placement', () => {
    const app = fixture('application');
    const registry = createModuleRegistry({ app: {
      ...app, category: 'mathematics', capabilities: ['engine', 'admin'],
      access: { roles: ['student'], permissions: ['course:read'] },
      routes: app.routes.map(route => ({ ...route, navigation: { ...route.navigation!, group: 'tools' } })),
    } });
    expect(registry.issues).toEqual([]);
    expect(getEngineCatalog(registry)).toEqual([]);
    expect(getModuleNavigation(registry, { role: 'student' })).toEqual([]);
    expect(getModuleNavigation(registry, { role: 'student', permissions: ['course:read'] })[0].group).toBe('tools');
    expect(getModuleNavigation(registry, { role: 'admin', permissions: ['course:read'] })).toEqual([]);
  });

  it.each([
    { kind: undefined }, { kind: 'physics' }, { category: undefined },
    { category: 'custom:' }, { category: 'custom:Invalid subject' }, { apiVersion: 1 },
  ])('quarantines invalid or obsolete classification: %j', patch => {
    const registry = createModuleRegistry({ bad: { ...fixture('application'), ...patch }, healthy: fixture('science') });
    expect(registry.modules.map(item => item.id)).toEqual(['fixture-science']);
    expect(registry.issues[0].code).toBe('invalid-manifest');
  });

  it('requires an explicit supported navigation group', () => {
    for (const group of [undefined, 'mathematics']) {
      const app = fixture('application');
      const registry = createModuleRegistry({ app: { ...app, routes: app.routes.map(route => ({ ...route, navigation: { ...route.navigation, group } })) } });
      expect(registry.modules).toEqual([]);
      expect(registry.issues[0].code).toBe('invalid-manifest');
    }
  });

  it('preserves dependency quarantine and selection across kinds', () => {
    const entries = { engine: fixture('math'), app: { ...fixture('application'), dependencies: ['fixture-math'] }, lab: { ...fixture('laboratory'), dependencies: ['fixture-application'] } };
    expect(createModuleRegistry(entries).modules).toHaveLength(3);
    expect(createModuleRegistry(entries, { disabledIds: ['fixture-math'] }).modules).toEqual([]);
    expect(createModuleRegistry({ ...entries, engine: { ...entries.engine, kind: 'invalid' } }).modules).toEqual([]);
  });
});

describe('classification presentation and compatibility', () => {
  it('places application/laboratory contributions in their declared areas and keeps dashboard independent', () => {
    const groups = buildNavigationRouteGroups('admin');
    expect(groups.find(group => group.section === 'moduleApplications')?.items.map(item => item.href)).toEqual(['/fixture-application']);
    expect(groups.find(group => group.section === 'moduleLaboratories')?.items.map(item => item.href)).toEqual(['/fixture-laboratory']);
    const dashboard = getModuleNavigation(moduleRegistry, { role: 'admin' }, 'dashboard');
    expect(dashboard.filter(item => item.href.startsWith('/fixture-'))).toHaveLength(4);
    expect(dashboard.slice(0, 3).map(item => [item.href, item.title.en, item.iconId])).toEqual([
      ['/calculus', 'Graphing', 'lineChart'], ['/solver', 'Equations', 'functionSquare'], ['/lab', 'Statistics', 'activity'],
    ]);
  });

  it('supports a learning-area contribution without changing the host inventory', () => {
    const app = fixture('application');
    const registry = createModuleRegistry({ app: { ...app, routes: app.routes.map(route => ({ ...route, navigation: { ...route.navigation!, group: 'learning' } })) } });
    expect(buildNavigationRouteGroups('student', null, registry)).toMatchObject([
      { section: 'learningSpace', items: [{ href: '/' }, { href: '/quiz' }, { href: '/fixture-application' }] },
    ]);
  });

  it('preserves Fuzzy Logic Lab catalog, search, sidebar, major restrictions and tooltips', () => {
    expect(moduleRegistry.modules.find(item => item.id === 'fuzzy-lab')).toMatchObject({ kind: 'engine', category: 'mathematics' });
    expect(searchEngines('membership').map(item => item.route)).toContain('/lab');
    expect(canRoleAccessEngineRoute('student', 'medicine', '/lab')).toBe(false);
    expect(canRoleAccessEngineRoute('student', 'mathematics', '/lab')).toBe(true);
    expect(canRoleAccessEngineRoute('instructor', 'medicine', '/lab')).toBe(true);
    expect(buildNavigationRouteGroups('student', 'mathematics')[1].items.find(item => item.href === '/lab')).toMatchObject({ key: 'lab', iconId: 'flaskConical' });
    render(<EngineInfoTooltip tooltip={{ engineId: 'fuzzy-lab', top: 10, anchorX: 10 }} language="en" />);
    expect(screen.getByRole('tooltip').textContent).toContain('Fuzzy Logic Lab');
  });

  it('renders grouped links with engine-only info affordances', () => {
    const groups = buildNavigationRouteGroups('admin').map(group => ({ ...group, items: group.items.map(item => ({ ...item, icon: Box })) }));
    render(<Router hook={memoryLocation({ path: '/' }).hook}>
      <SidebarNavigation isInstructor={false} location="/" onCloseMobileNav={() => {}}
        dynamicNavItems={groups} onEngineInfoTooltipChange={() => {}} />
      <EngineInfoTooltip tooltip={{ engineId: 'fixture-application', top: 10, anchorX: 10 }} language="en" />
    </Router>);
    expect(screen.getByRole('button', { name: 'About Fixture science' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'About Fixture application' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'About Fixture laboratory' })).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
    const applicationArea = screen.getByText('moduleApplications').parentElement!;
    expect(within(applicationArea).getByRole('link', { name: 'Fixture application' })).toBeTruthy();
    const laboratoryArea = screen.getByText('moduleLaboratories').parentElement!;
    expect(within(laboratoryArea).getByRole('link', { name: 'Fixture laboratory' })).toBeTruthy();
  });
});
