import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateQuiz } from '../generateQuiz';
import { generateQuiz as legacyGenerateQuiz } from '@/utils/pdfEngine';

afterEach(() => {
  vi.useRealTimers();
});

async function runGenerator(context: string) {
  vi.useFakeTimers();

  const result = generateQuiz(context);

  await vi.advanceTimersByTimeAsync(1500);

  return result;
}

function verifyQuestions(
  questions: Awaited<ReturnType<typeof generateQuiz>>
) {
  expect(questions.length).toBeGreaterThan(0);

  for (const question of questions) {
    expect(question.question.length).toBeGreaterThan(0);
    expect(question.options.length).toBeGreaterThan(1);
    expect(question.correctIndex).toBeGreaterThanOrEqual(0);
    expect(question.correctIndex).toBeLessThan(
      question.options.length
    );
    expect(question.explanation.length).toBeGreaterThan(0);
  }
}

describe('Quiz Generation', () => {
  it('preserves the legacy export', () => {
    expect(legacyGenerateQuiz).toBe(generateQuiz);
  });

  it('generates fuzzy logic questions', async () => {
    const questions = await runGenerator(
      'Introduction to fuzzy sets'
    );

    expect(questions).toHaveLength(3);
    verifyQuestions(questions);
  });

  it('recognizes t-norm context', async () => {
    const questions = await runGenerator(
      'Minimum t-norm operation'
    );

    expect(questions).toHaveLength(3);
    verifyQuestions(questions);
  });

  it('generates fallback questions', async () => {
    const questions = await runGenerator(
      'General academic subject'
    );

    expect(questions).toHaveLength(2);
    verifyQuestions(questions);
  });
});
