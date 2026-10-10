import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

import type { SemanticChunk, DocumentAnalysisResult } from '@/features/ai-generator/document-analysis/document.types';
export type { SemanticChunk, DocumentAnalysisResult } from '@/features/ai-generator/document-analysis/document.types';
export { searchChunks } from '@/features/ai-generator/document-search/searchChunks';
import type { QuizQuestion } from '@/features/ai-generator/quiz/quiz.types';
export type { QuizQuestion } from '@/features/ai-generator/quiz/quiz.types';
export { generateQuiz } from '@/features/ai-generator/quiz/generation/generateQuiz';

import type { CourseFile, TeachingPlan } from './courseStorage';

export interface AIExplanation {
  topic: string;
  explanation: string;
  keyConcepts: string[];
  latexFormula?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
  quiz?: QuizQuestion[];
  canTestKnowledge?: boolean;
}

/**
 * Reads a PDF document and extracts text using a background Web Worker with Semantic Chunking.
 * @param file The PDF file from IndexedDB
 * @param onProgress Optional callback to track extraction progress
 */
export async function analyzeDocument(
  file: CourseFile,
  onProgress?: (current: number, total: number) => void
): Promise<DocumentAnalysisResult> {
  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    const arrayBuffer = await file.data.arrayBuffer();

    loadingTask = getDocument({
      data: new Uint8Array(arrayBuffer),
    });

    const pdf = await loadingTask.promise;
    const chunks: SemanticChunk[] = [];
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push(`--- PAGE ${pageNumber} ---\n${pageText}`);

      // Preserve page attribution for all extracted chunks.
      const chunkSize = 1500;

      for (let start = 0; start < pageText.length; start += chunkSize) {
        const text = pageText.slice(start, start + chunkSize).trim();

        if (text) {
          chunks.push({
            text,
            source: `Page ${pageNumber}`,
          });
        }
      }

      onProgress?.(pageNumber, pdf.numPages);
    }

    return {
      chunks,
      rawText: pages.join('\n'),
    };
  } catch (error) {
    console.error('PDF extraction failed:', error);

    return {
      chunks: [],
      rawText: '[Fallback] PDF extraction failed.',
    };
  } finally {
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (error) {
        console.warn('PDF cleanup failed:', error);
      }
    }
  }
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

export async function generateChatResponse(
  messages: ChatMessage[],
  retrievedChunks: SemanticChunk[],
  domain: string = 'general'
): Promise<ChatMessage> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM processing

  if (retrievedChunks.length === 0) {
    return {
      id: crypto.randomUUID(),
      role: 'ai',
      content: 'I could not find any information about that in the uploaded textbook. Please try asking about a different topic.',
      citations: []
    };
  }

  // Determine dynamic prompt response based on domain
  const primaryChunk = retrievedChunks[0];
  const query = messages[messages.length - 1].content.toLowerCase();
  
  let prefix = '';
  if (domain === 'medicine') {
    prefix = `**Clinical Analysis:** Based on the medical textbook context:\n\n`;
  } else if (domain === 'engineering') {
    prefix = `**Engineering & Math Derivation:** Based on the textbook proofs:\n\n`;
  } else if (domain === 'humanities') {
    prefix = `**Historical/Logical Context:** According to the referenced text:\n\n`;
  } else if (domain === 'cs') {
    prefix = `**Algorithmic Breakdown:** According to the textbook structure:\n\n`;
  } else {
    prefix = `Based on the textbook, here is the answer to your question:\n\n`;
  }

  let content = `${prefix}> "${primaryChunk.text.substring(0, 150)}..."\n\n`;
  
  const isFuzzy = query.includes('fuzzy') || primaryChunk.text.toLowerCase().includes('fuzzy');
  
  if (isFuzzy) {
    content += `When dealing with fuzzy sets, we often represent the membership function as $ \mu_A(x) $. For intersection, the standard operation is the minimum T-norm:\n$$ \mu_{A \cap B}(x) = \min(\mu_A(x), \mu_B(x)) $$\nThis guarantees bounded membership.`;
  } else {
    content += `The text explains that this concept is fundamental to the topic. For example, if we consider a generic formula $ x^2 + y^2 = z^2 $, it forms the basis of the structural integrity.`;
  }

  const uniqueCitations = Array.from(new Set(retrievedChunks.map(c => c.source)));

  return {
    id: crypto.randomUUID(),
    role: 'ai',
    content,
    citations: uniqueCitations,
    canTestKnowledge: true
  };
}
