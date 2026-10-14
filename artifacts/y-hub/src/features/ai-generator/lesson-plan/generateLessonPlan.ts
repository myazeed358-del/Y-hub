export interface AIExplanation {
  topic: string;
  explanation: string;
  keyConcepts: string[];
  latexFormula?: string;
}

/**
 * Mocks the AI Generator endpoint, using the real extracted text context.
 */
export async function generateLessonPlan(topic: string, textbookContent: string): Promise<AIExplanation> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM thinking

  // Find if the topic exists in the text context
  const hasContext = textbookContent.toLowerCase().includes(topic.toLowerCase().substring(0, 10));

  return {
    topic,
    explanation: hasContext
      ? `Based on the textbook analysis, this topic is explicitly covered. Here is the synthesized explanation:\n\nWhen dealing with fuzzy sets, we often represent the membership function as $ \mu_A(x) $. For intersection, the standard operation is the minimum T-norm, defined formally as:$$ \mu_{A \cap B}(x) = \min(\mu_A(x), \mu_B(x)) $$\nThis guarantees that the resulting membership is bounded appropriately.`
      : `This topic was not explicitly detailed in the first 50 pages of the reference, but based on the general domain context, here is the generated explanation involving $ x^2 + y^2 = z^2 $.`,
    keyConcepts: ['Foundational Principle', 'Core Mechanism', 'Practical Application'],
    latexFormula: topic.toLowerCase().includes('fuzzy') ? `\mu_{A \cap B}(x) = \min(\mu_A(x), \mu_B(x))` : undefined
  };
}
