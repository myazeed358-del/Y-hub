import type { ModuleManifest } from '../contracts';

export default {
  "id": "ode",
  "title": {
    "ar": "المعادلات التفاضلية",
    "en": "Differential Equations"
  },
  "description": {
    "ar": "حل المعادلات التفاضلية رمزيًا وعدديًا مع خطوات الحل.",
    "en": "Symbolic and numerical ODE solving with steps."
  },
  "keywords": [
    "ode",
    "differential equations",
    "euler",
    "runge kutta",
    "معادلات تفاضلية",
    "تفاضلية"
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
    path: "/ode",
    order: 10,
    load: () => import('@/features/ode'),
    navigation: {"group": "tools", "labelKey": "odeSolver", "iconId": "lineChart", "order": 70},
  }],
} satisfies ModuleManifest;
