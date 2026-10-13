import { describe, expect, it } from 'vitest';
import { calculateQuizScore } from '../domain/calculateQuizScore';

const questions = [
  { answer: 1 },
  { answer: 2 },
  { answer: 0 },
];

describe('calculateQuizScore', () => {
  it('returns zero for unanswered questions', () => {
    expect(calculateQuizScore(questions, {})).toBe(0);
  });

  it('counts all correct answers', () => {
    expect(
      calculateQuizScore(
        questions,
        { 0: 1, 1: 2, 2: 0 }
      )
    ).toBe(3);
  });

  it('counts only correct selections', () => {
    expect(
      calculateQuizScore(
        questions,
        { 0: 1, 1: 0, 2: 0 }
      )
    ).toBe(2);
  });

  it('accepts a correct answer with index zero', () => {
    expect(
      calculateQuizScore(
        [{ answer: 0 }],
        { 0: 0 }
      )
    ).toBe(1);
  });

  it('does not change the answers object', () => {
    const answers = { 0: 1 };

    calculateQuizScore(questions, answers);

    expect(answers).toEqual({ 0: 1 });
  });
});
