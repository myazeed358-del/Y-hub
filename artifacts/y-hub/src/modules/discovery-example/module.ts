import type { ModuleManifest } from '../contracts';

/** Disabled in the application; enabled explicitly by integration tests. */
export default {
  id: 'discovery-example',
  version: '1.0.0',
  apiVersion: 2,
  kind: 'application',
  category: 'education',
  title: { ar: 'مثال الوحدة', en: 'Module discovery example' },
  defaultEnabled: false,
  access: { roles: ['admin'] },
  routes: [{
    path: '/module-example',
    load: () => import('./ExamplePage'),
    dashboard: { title: { en: 'Module discovery example', ar: 'مثال الوحدة' }, iconId: 'box', order: 100 },
    navigation: { group: 'applications', iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
