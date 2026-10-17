import type { ModuleManifest } from '../contracts';

export default {
  "id": "fuzzy-logic-solver",
  "title": {
    "ar": "المنطق الضبابي",
    "en": "Fuzzy Logic"
  },
  "description": {
    "ar": "جرّب عمليات المنطق الضبابي وT-norm، وتحقق من النتائج مع خطوات توضيحية وتحديات عكسية.",
    "en": "Explore fuzzy-logic and T-norm operations, validate results, and work through guided reverse challenges."
  },
  "keywords": [
    "math",
    "solver",
    "equation",
    "algebra",
    "fuzzy logic",
    "t-norm",
    "membership",
    "logic solver",
    "منطق ضبابي",
    "دالة العضوية",
    "تقاطع ضبابي",
    "تي نورم"
  ],
  "version": "1.0.0",
  "apiVersion": 1,
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
    path: "/solver",
    order: 40,
    load: () => import('@/features/solver'),
    navigation: {"labelKey": "solver", "iconId": "calculator", "order": 40},
  }],
} satisfies ModuleManifest;
