export type ActiveCourseRoute =
  | { kind: 'course'; courseId: string }
  | { kind: 'lesson' }
  | { kind: 'preserve' }
  | { kind: 'clear' };

const contextPreservingTools = new Set([
  '/lab',
  '/matrix-calc',
  '/simplex',
  '/calculus-1',
  '/calculus',
  '/solver',
  '/sandbox',
  '/med-sim',
]);

export function resolveActiveCourseRoute(
  location: string
): ActiveCourseRoute {
  // Preserve the matching behavior of the original AppShell.
  const courseMatch = location.match(/\/course\/([^/]+)/);

  if (courseMatch && courseMatch[1]) {
    return {
      kind: 'course',
      courseId: courseMatch[1],
    };
  }

  if (location.startsWith('/lesson/')) {
    return { kind: 'lesson' };
  }

  if (contextPreservingTools.has(location)) {
    return { kind: 'preserve' };
  }

  return { kind: 'clear' };
}
