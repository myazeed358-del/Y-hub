import type { ModuleManifest } from '../contracts';

export default {
  "id": "calculus-plotter",
  "title": {
    "ar": "التفاضل والتكامل 2",
    "en": "Calculus II"
  },
  "description": {
    "ar": "النهايات، الاشتقاق، التكامل، التطبيقات الهندسية والمتسلسلات مع خطوات الحل والرسوم البيانية.",
    "en": "Limits, derivatives, integrals, geometric applications, and series with step-by-step solutions and graphs."
  },
  "keywords": [
    "calculus",
    "derivative",
    "integral",
    "plot",
    "graph",
    "تفاضل",
    "تكامل",
    "مشتقة",
    "رسم"
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
    path: "/calculus",
    order: 60,
    load: () => import('@/features/calculus'),
    navigation: {"labelKey": "calculusPlotter", "iconId": "lineChart", "order": 20},
  }],
} satisfies ModuleManifest;
