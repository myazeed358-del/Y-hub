export type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
export { generateChatResponse } from '@/features/ai-generator/ai-chat/mockChatResponse';
export { analyzeDocument } from '@/features/ai-generator/document-analysis/analyzeDocument';

export type { SemanticChunk, DocumentAnalysisResult } from '@/features/ai-generator/document-analysis/document.types';
export { searchChunks } from '@/features/ai-generator/document-search/searchChunks';
export type { QuizQuestion } from '@/features/ai-generator/quiz/quiz.types';
export { generateQuiz } from '@/features/ai-generator/quiz/generation/generateQuiz';

import type { CourseFile, TeachingPlan } from './courseStorage';

export interface AIExplanation {
  topic: string;
  explanation: string;
  keyConcepts: string[];
  latexFormula?: string;
}

/**
 * Automatically divides the extracted PDF text into a structured teaching timeline.
 */
export async function generateTimeline(courseId: string, text: string, totalWeeks: number = 15): Promise<TeachingPlan[]> {
  // A simple natural language algorithm to find "Chapters" or logical breaks.
  // We scan for keywords like "Chapter", "الفصل", "Unit" and extract their titles.
  const chapterRegex = /(?:Chapter|الفصل|Unit|Module)\s+([0-9]+|One|Two|Three|Four|I|II|III|IV)[\s:-]+([^.?!]+)/gi;
  const chapters: string[] = [];
  
  let match;
  while ((match = chapterRegex.exec(text)) !== null) {
    const title = match[2].trim().substring(0, 100); // Limit length
    if (title.length > 3 && !chapters.includes(title)) {
      chapters.push(title);
    }
    if (chapters.length >= 50) break; // limit
  }

  // Fallback if no chapters found: generate generic topics based on the course
  if (chapters.length < 3) {
    for (let i = 1; i <= totalWeeks; i++) {
      chapters.push(`Core Concept ${i}: Analysis & Application`);
    }
  }

  // Distribute chapters evenly across the weeks
  const plans: TeachingPlan[] = [];
  const chaptersPerWeek = Math.max(1, Math.floor(chapters.length / totalWeeks));
  
  for (let week = 1; week <= totalWeeks; week++) {
    const weekChapters = chapters.splice(0, chaptersPerWeek);
    
    // If we run out of parsed chapters, add a review week
    const topic = weekChapters.length > 0 
      ? weekChapters.join(' & ') 
      : (week === totalWeeks ? 'Final Review and Exam Preparation' : 'Review & Practice');

    plans.push({
      id: crypto.randomUUID(),
      courseId,
      week,
      topic,
      content: `In week ${week}, students will focus on: ${topic}. This involves reading the assigned pages from the textbook and completing the foundational exercises.`
    });
  }

  return plans;
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
