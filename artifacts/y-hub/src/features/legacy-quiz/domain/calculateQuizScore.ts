export interface ScoredQuestion {
  answer: number;
}

export function calculateQuizScore(
  questions: readonly ScoredQuestion[],
  answers: Readonly<Record<number, number>>
): number {
  return questions.reduce(
    (total, question, index) =>
      total + (answers[index] === question.answer ? 1 : 0),
    0
  );
}
