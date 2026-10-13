import { useState } from 'react';
import { questions } from '../data/questions';
import { calculateQuizScore } from '../domain/calculateQuizScore';

export function useLegacyQuiz() {

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const score = calculateQuizScore(questions, answers);
  const answerQuestion = (questionIndex: number, optionIndex: number) => {
    if (submitted[questionIndex]) return;
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
    setSubmitted((current) => ({ ...current, [questionIndex]: true }));
  };
  const reset = () => { setAnswers({}); setSubmitted({}); setFinished(false); };

  return {
    questions,
    answers,
    submitted,
    finished,
    setFinished,
    score,
    answerQuestion,
    reset
  };
}
