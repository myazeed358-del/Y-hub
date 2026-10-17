import type { ModuleManifest } from '../contracts';

export default {
  "id": "calculus-iii",
  "title": {
    "ar": "التفاضل والتكامل 3",
    "en": "Calculus III"
  },
  "description": {
    "ar": "المشتقات الجزئية، التدرج، التكاملات المتعددة، المتجهات والمسائل متعددة المتغيرات.",
    "en": "Partial derivatives, gradients, multiple integrals, vectors, and multivariable calculus problems."
  },
  "keywords": [
    "calculus 3",
    "calculus iii",
    "multivariable",
    "vector calculus",
    "تفاضل 3",
    "تكامل 3",
    "متعدد المتغيرات"
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
    path: "/math-solver",
    order: 30,
    load: () => import('@/features/math-solver'),
    navigation: {"labelKey": "calculus3Solver", "iconId": "box", "order": 30},
  }],
} satisfies ModuleManifest;
