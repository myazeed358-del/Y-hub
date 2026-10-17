import type { ModuleManifest } from '../contracts';

export default {
  "id": "calculus-1",
  "title": {
    "ar": "التفاضل والتكامل 1",
    "en": "Calculus I"
  },
  "description": {
    "ar": "حل النهايات والاشتقاق باستخدام محركات رياضية داخلية.",
    "en": "Limits and derivatives using internal math engines."
  },
  "keywords": [
    "calculus 1",
    "calculus i",
    "limits",
    "derivatives",
    "تفاضل وتكامل 1",
    "كالك 1",
    "نهايات",
    "اشتقاق"
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
    path: "/calculus-1",
    order: 50,
    load: () => import('@/features/calculus-1'),
    navigation: {"group": "tools", "labelKey": "calculus1Solver", "iconId": "lineChart", "order": 10},
  }],
} satisfies ModuleManifest;
