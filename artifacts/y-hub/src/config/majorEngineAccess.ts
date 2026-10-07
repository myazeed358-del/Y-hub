export const ENGINE_ACCESS_BY_MAJOR: Record<string, readonly string[]> = {
  mathematics: [
    '/calculus',
    '/math-solver',
    '/solver',
    '/lab',
  ],

  // Future examples:
  // physics: ['/physics-mechanics', '/physics-electromagnetism'],
  // nursing: ['/nursing-clinical', '/nursing-dosage'],
  // cybersecurity: ['/cybersecurity-lab'],
};

export const ALL_ENGINE_ROUTES = [
  '/calculus',
  '/math-solver',
  '/solver',
  '/lab',
] as const;

export function getAllowedEngineRoutes(
  major?: string | null
): readonly string[] {
  if (!major) return [];
  return ENGINE_ACCESS_BY_MAJOR[major] ?? [];
}

export function canAccessEngineRoute(
  major: string | null | undefined,
  route: string
): boolean {
  return getAllowedEngineRoutes(major).includes(route);
}
