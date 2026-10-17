import type { ModuleManifest } from '../../../contracts';

/** Test-only metadata: never matched by production discovery. */
export default {
  id: 'fixture-science', version: '1.0.0', apiVersion: 2,
  kind: 'engine', category: 'physics',
  title: { en: 'Fixture science', ar: 'اختبار science' },
  description: { en: 'Fixture science description', ar: 'وصف science' },
  capabilities: ['fixture-capability'],
  access: { roles: ['student', 'instructor', 'admin'], majors: ['engineering'], majorRestrictedRoles: ['student'] },
  routes: [{
    path: '/fixture-science', load: () => import('../FixturePage'),
    navigation: { group: 'tools', iconId: 'box', order: 100 },
    dashboard: { title: { en: 'Fixture science', ar: 'اختبار science' }, iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
