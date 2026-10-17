import type { ModuleManifest } from '../contracts';

export default {
  id: 'audit-log', version: '1.0.0', apiVersion: 2,
  kind: 'application', category: 'custom:administration',
  title: { en: 'Audit log', ar: 'سجل التدقيق' },
  description: { en: 'Review trusted administrative changes.', ar: 'مراجعة التغييرات الإدارية الموثوقة.' },
  access: { roles: ['admin', 'super_admin'] },
  routes: [{ path: '/audit-log', load: () => import('@/features/audit-log'),
    navigation: { group: 'applications', iconId: 'activity', order: 10 },
  }],
} satisfies ModuleManifest;
