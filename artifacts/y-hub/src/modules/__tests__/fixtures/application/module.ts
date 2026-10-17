import type { ModuleManifest } from '../../../contracts';

/** Test-only metadata: never matched by production discovery. */
export default {
  id: 'fixture-application', version: '1.0.0', apiVersion: 2,
  kind: 'application', category: 'productivity',
  title: { en: 'Fixture application', ar: 'اختبار application' },
  description: { en: 'Fixture application description', ar: 'وصف application' },
  capabilities: ['fixture-capability'],
  access: { roles: ['student', 'instructor', 'admin'] },
  routes: [{
    path: '/fixture-application', load: () => import('../FixturePage'),
    navigation: { group: 'applications', iconId: 'box', order: 100 },
    dashboard: { title: { en: 'Fixture application', ar: 'اختبار application' }, iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
