export type EngineAccessRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'super_admin';

export interface EngineDefinition {
  id: string;
  route: string;
  majors: readonly string[];
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  keywords: readonly string[];
}

/**
 * Central catalog for every academic engine in Y HUB.
 *
 * Add future engines here once, then reuse this catalog for:
 * - Sidebar visibility
 * - Instructor engine search
 * - Route authorization
 * - Engine labels and metadata
 */
export const ENGINE_CATALOG: readonly EngineDefinition[] = [
  {
    id: 'calculus-plotter',
    route: '/calculus',
    majors: ['mathematics'],
    title: {
      ar: 'التفاضل والتكامل 2',
      en: 'Calculus II',
    },
    description: {
      ar: 'النهايات، الاشتقاق، التكامل، التطبيقات الهندسية والمتسلسلات مع خطوات الحل والرسوم البيانية.',
      en: 'Limits, derivatives, integrals, geometric applications, and series with step-by-step solutions and graphs.',
    },
    keywords: [
      'calculus',
      'derivative',
      'integral',
      'plot',
      'graph',
      'تفاضل',
      'تكامل',
      'مشتقة',
      'رسم',
    ],
  },
  {
    id: 'calculus-iii',
    route: '/math-solver',
    majors: ['mathematics'],
    title: {
      ar: 'التفاضل والتكامل 3',
      en: 'Calculus III',
    },
    description: {
      ar: 'المشتقات الجزئية، التدرج، التكاملات المتعددة، المتجهات والمسائل متعددة المتغيرات.',
      en: 'Partial derivatives, gradients, multiple integrals, vectors, and multivariable calculus problems.',
    },
    keywords: [
      'calculus 3',
      'calculus iii',
      'multivariable',
      'vector calculus',
      'تفاضل 3',
      'تكامل 3',
      'متعدد المتغيرات',
    ],
  },
  {
    id: 'fuzzy-logic-solver',
    route: '/solver',
    majors: ['mathematics'],
    title: {
      ar: 'المنطق الضبابي',
      en: 'Fuzzy Logic',
    },
    description: {
      ar: 'جرّب عمليات المنطق الضبابي وT-norm، وتحقق من النتائج مع خطوات توضيحية وتحديات عكسية.',
      en: 'Explore fuzzy-logic and T-norm operations, validate results, and work through guided reverse challenges.',
    },
    keywords: [
      'math',
      'solver',
      'equation',
      'algebra',
      'fuzzy logic',
      't-norm',
      'membership',
      'logic solver',
      'منطق ضبابي',
      'دالة العضوية',
      'تقاطع ضبابي',
      'تي نورم',
    ],
  },
  {
    id: 'fuzzy-lab',
    route: '/lab',
    majors: ['mathematics'],
    title: {
      ar: 'مختبر المنطق الضبابي',
      en: 'Fuzzy Logic Lab',
    },
    description: {
      ar: 'استكشف دوال العضوية بصرياً، وعدّل المعلمات وشاهد تأثيرها على المنحنى ودرجة العضوية مباشرة.',
      en: 'Explore membership functions visually, adjust their parameters, and see how the curve and membership degree change in real time.',
    },
    keywords: [
      'fuzzy',
      'membership',
      'logic',
      'ضبابي',
      'منطق ضبابي',
      'دالة العضوية',
    ],
  },
] as const;

export const ALL_ENGINE_ROUTES = ENGINE_CATALOG.map(
  (engine) => engine.route
);

/**
 * Returns engines academically associated with a major.
 * Used for the normal Student/Instructor sidebar.
 */
export function getEnginesForMajor(
  major?: string | null
): readonly EngineDefinition[] {
  if (!major) return [];

  return ENGINE_CATALOG.filter((engine) =>
    engine.majors.includes(major)
  );
}

/**
 * Backwards-compatible helper used by the current UI.
 */
export function getAllowedEngineRoutes(
  major?: string | null
): readonly string[] {
  return getEnginesForMajor(major).map((engine) => engine.route);
}

/**
 * Sidebar visibility:
 *
 * Student:
 *   only engines belonging to the student's major.
 *
 * Instructor:
 *   only engines belonging to the instructor's teaching major.
 *   Other engines will be discoverable through instructor search.
 *
 * Admin / Super Admin:
 *   all engines.
 */
export function getSidebarEngineRoutes(
  role: EngineAccessRole | null | undefined,
  major?: string | null
): readonly string[] {
  if (role === 'admin' || role === 'super_admin') {
    return ALL_ENGINE_ROUTES;
  }

  return getAllowedEngineRoutes(major);
}

/**
 * Real route authorization.
 *
 * Student:
 *   strictly restricted to engines belonging to the student's major.
 *
 * Instructor:
 *   may open any engine. The normal sidebar still shows only engines
 *   belonging to the instructor's teaching major; the rest are intended
 *   to be discovered through Engine Search.
 *
 * Admin / Super Admin:
 *   may open any engine.
 */
export function canRoleAccessEngineRoute(
  role: EngineAccessRole | null | undefined,
  major: string | null | undefined,
  route: string
): boolean {
  if (
    role === 'instructor' ||
    role === 'admin' ||
    role === 'super_admin'
  ) {
    return ALL_ENGINE_ROUTES.includes(route);
  }

  if (role === 'student') {
    return getAllowedEngineRoutes(major).includes(route);
  }

  return false;
}

/**
 * Legacy helper retained temporarily while the remaining callers
 * are migrated to role-aware authorization.
 */
export function canAccessEngineRoute(
  major: string | null | undefined,
  route: string
): boolean {
  return getAllowedEngineRoutes(major).includes(route);
}

/**
 * Search the complete engine catalog.
 * Intended for Instructor/Admin engine discovery.
 */
export function searchEngines(
  query: string,
  language: 'ar' | 'en' = 'en'
): readonly EngineDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return [];

  return ENGINE_CATALOG.filter((engine) => {
    const searchableText = [
      engine.title[language],
      engine.title.ar,
      engine.title.en,
      engine.description[language],
      ...engine.keywords,
      ...engine.majors,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
