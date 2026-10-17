import type { ModuleManifest } from '../contracts';

export default {
  "id": "linear-algebra",
  "title": {
    "ar": "الجبر الخطي",
    "en": "Linear Algebra"
  },
  "description": {
    "ar": "المصفوفات، المحددات، المعكوس، واختزال الصفوف وحل الأنظمة الخطية.",
    "en": "Matrices, determinants, inverses, row reduction, and linear systems."
  },
  "keywords": [
    "linear algebra",
    "matrix",
    "determinant",
    "inverse",
    "rref",
    "جبر خطي",
    "مصفوفات",
    "محدد"
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
    path: "/linear-algebra",
    order: 20,
    load: () => import('@/features/linear-algebra'),
    navigation: {"labelKey": "linearAlgebra", "iconId": "grid2x2", "order": 60},
  }],
} satisfies ModuleManifest;
