import type { ModuleManifest } from '../contracts';

export default {
  "id": "fuzzy-lab",
  "title": {
    "ar": "مختبر المنطق الضبابي",
    "en": "Fuzzy Logic Lab"
  },
  "description": {
    "ar": "استكشف دوال العضوية بصرياً، وعدّل المعلمات وشاهد تأثيرها على المنحنى ودرجة العضوية مباشرة.",
    "en": "Explore membership functions visually, adjust their parameters, and see how the curve and membership degree change in real time."
  },
  "keywords": [
    "fuzzy",
    "membership",
    "logic",
    "ضبابي",
    "منطق ضبابي",
    "دالة العضوية"
  ],
  "version": "1.0.0",
  "apiVersion": 2,
  "kind": "engine",
  "category": "mathematics",
  "access": {
    "roles": [
      "student",
      "instructor",
      "admin",
      "super_admin"
    ],
    "majors": [
      "mathematics"
    ],
    "majorRestrictedRoles": [
      "student"
    ]
  },
  routes: [{
    path: "/lab",
    order: 70,
    load: () => import('@/features/legacy-lab'),
    dashboard: { title: { en: 'Statistics', ar: 'الإحصاء' }, iconId: 'activity', order: 30 },
    navigation: {"group": "tools", "labelKey": "lab", "iconId": "flaskConical", "order": 50},
  }],
} satisfies ModuleManifest;
