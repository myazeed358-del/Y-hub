import type { ModuleManifest } from '../../../contracts';

/** Test-only metadata: never matched by production discovery. */
export default {
  id: 'fixture-math', version: '1.0.0', apiVersion: 2,
  kind: 'engine', category: 'mathematics',
  title: { en: 'Fixture math', ar: 'اختبار math' },
  description: { en: 'Fixture math description', ar: 'وصف math' },
  capabilities: ['fixture-capability'],
  access: { roles: ['student', 'instructor', 'admin'] },
  routes: [{
    path: '/fixture-math', load: () => import('../FixturePage'),
    navigation: { group: 'tools', iconId: 'box', order: 100 },
    dashboard: { title: { en: 'Fixture math', ar: 'اختبار math' }, iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
