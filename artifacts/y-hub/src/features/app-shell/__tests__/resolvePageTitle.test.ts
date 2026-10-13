import {
  describe,
  expect,
  it,
} from 'vitest';

import type { UiKey } from '@/i18n/uiCopy';

import {
  resolvePageTitle,
} from '../domain/resolvePageTitle';

const translate = (key: UiKey) => `translated:${key}`;

describe('resolvePageTitle', () => {
  const routeCases = [
    ['/', 'overview'],
    ['/dashboard', 'overview'],
    ['/lab', 'lab'],
    ['/solver', 'solver'],
    ['/course', 'coursePlan'],
    ['/course/123', 'coursePlan'],
    ['/quiz', 'quickPractice'],
    ['/calculus', 'calculusPlotter'],
    ['/math-solver', 'calculus3Solver'],
    ['/lesson/introduction', 'lessonPath'],
    ['/unknown', 'lessonPath'],
  ] as const;

  for (const [route, key] of routeCases) {
    it(`preserves title for ${route}`, () => {
      expect(
        resolvePageTitle(route, 'ar', translate)
      ).toBe(`translated:${key}`);
    });
  }

  it('preserves the Arabic profile title', () => {
    expect(
      resolvePageTitle('/profile', 'ar', translate)
    ).toBe('الملف الشخصي');
  });

  it('preserves the English profile title', () => {
    expect(
      resolvePageTitle('/profile', 'en', translate)
    ).toBe('Profile');
  });

  it('preserves prefix matching for course paths', () => {
    expect(
      resolvePageTitle('/courses/archive', 'ar', translate)
    ).toBe('translated:coursePlan');
  });

  it('preserves fallback for an unknown subroute', () => {
    expect(
      resolvePageTitle('/profile/edit', 'en', translate)
    ).toBe('translated:lessonPath');
  });
});
