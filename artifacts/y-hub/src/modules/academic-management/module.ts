import type { ModuleManifest } from '../contracts';
export default {
  id: 'academic-management', version: '1.0.0', apiVersion: 2,
  kind: 'application', category: 'education',
  title: { en: 'Academic management', ar: 'الإدارة الأكاديمية' },
  description: { en: 'Manage course definitions, sections and instructor assignments.', ar: 'إدارة تعريفات المواد والشعب وإسناد الدكاترة.' },
  access: { roles: ['instructor', 'admin', 'super_admin'] },
  routes: [{ path: '/academic-management', load: () => import('@/features/academic-management'),
    navigation: { group: 'learning', iconId: 'grid2x2', order: 40 },
  }],
} satisfies ModuleManifest;
