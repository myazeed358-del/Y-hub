import type { ModuleManifest } from '../../../contracts';

/** Test-only metadata: never matched by production discovery. */
export default {
  id: 'fixture-laboratory', version: '1.0.0', apiVersion: 2,
  kind: 'laboratory', category: 'custom:astronomy',
  title: { en: 'Fixture laboratory', ar: 'اختبار laboratory' },
  description: { en: 'Fixture laboratory description', ar: 'وصف laboratory' },
  capabilities: ['fixture-capability'],
  access: { roles: ['student', 'instructor', 'admin'] },
  routes: [{
    path: '/fixture-laboratory', load: () => import('../FixturePage'),
    navigation: { group: 'laboratories', iconId: 'box', order: 100 },
    dashboard: { title: { en: 'Fixture laboratory', ar: 'اختبار laboratory' }, iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
