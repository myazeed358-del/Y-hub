import type { ModuleManifest } from '../contracts';

export default {
  id: 'y-sheets',
  version: '1.0.0',
  apiVersion: 2,
  kind: 'application',
  category: 'productivity',

  title: {
    ar: 'Y-Sheets | جداول البيانات',
    en: 'Y-Sheets | Spreadsheets',
  },

  description: {
    ar: 'إنشاء وتحرير جداول البيانات والصيغ الحسابية.',
    en: 'Create and edit spreadsheets and formulas.',
  },

  keywords: [
    'spreadsheet',
    'excel',
    'sheets',
    'جداول',
  ],

  defaultEnabled: true,

  access: {
    roles: [
      'student',
      'instructor',
      'admin',
      'super_admin',
    ],
  },

  routes: [
    {
      path: '/y-sheets',
      order: 150,
      load: () => import('./YSheetsPage'),

      navigation: {
        group: 'applications',
        title: {
          ar: 'Y-Sheets',
          en: 'Y-Sheets',
        },
        iconId: 'grid2x2',
        order: 20,
      },
    },
  ],
} satisfies ModuleManifest;
