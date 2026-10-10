import type { QuizQuestion } from '../quiz.types';

/**
 * Simulates generating MCQs from a given context.
 */
export async function generateQuiz(context: string): Promise<QuizQuestion[]> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM processing

  const isFuzzy = context.toLowerCase().includes('fuzzy') || context.toLowerCase().includes('t-norm');

  if (isFuzzy) {
    return [
      {
        question: "What is the standard operation used for fuzzy intersection?",
        options: ["Maximum T-conorm", "Minimum T-norm", "Algebraic Sum", "Arithmetic Mean"],
        correctIndex: 1,
        explanation: "The minimum T-norm is the most widely used standard intersection operation in fuzzy set theory because it correctly bounds the resulting membership."
      },
      {
        question: "How is the membership function typically denoted in fuzzy mathematics?",
        options: ["$\\lambda(x)$", "$f(x)$", "$\\mu_A(x)$", "$\\alpha_A(x)$"],
        correctIndex: 2,
        explanation: "The Greek letter mu ($\\mu$) is standard notation for membership functions, indicating the degree to which an element belongs to a fuzzy set A."
      },
      {
        question: "What does the resulting membership value of an intersection represent?",
        options: ["The degree of belonging to either set", "The degree of belonging to both sets simultaneously", "The crisp boundary of the set", "The difference between two sets"],
        correctIndex: 1,
        explanation: "Intersection represents the logical 'AND', meaning it evaluates how much an element belongs to both sets at the same time."
      }
    ];
  }

  // Generic fallback quiz
  return [
    {
      question: "Based on the text, what is the foundational principle of this topic?",
      options: ["It relies strictly on linear progression", "It forms the basis of structural integrity", "It is only applicable in theoretical models", "It replaces the need for algorithms"],
      correctIndex: 1,
      explanation: "The text explicitly states that this concept forms the basis of structural integrity."
    },
    {
      question: "Which formula was highlighted as a generic example in the explanation?",
      options: ["$E = mc^2$", "$x^2 + y^2 = z^2$", "$a^2 + b^2 = c^2$", "$y = mx + b$"],
      correctIndex: 1,
      explanation: "The explanation specifically used $x^2 + y^2 = z^2$ as an example formula to illustrate the point."
    }
  ];
}
