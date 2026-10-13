import { describe, expect, it } from 'vitest';
import { formatExamTime } from '../domain/formatExamTime';

describe('formatExamTime', () => {
  it('formats zero and whole minutes', () => {
    expect(formatExamTime(0)).toBe('0:00');
    expect(formatExamTime(600)).toBe('10:00');
  });

  it('pads remaining seconds', () => {
    expect(formatExamTime(65)).toBe('1:05');
  });
});
