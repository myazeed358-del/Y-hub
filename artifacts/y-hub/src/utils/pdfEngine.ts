import type { CourseFile, TeachingPlan } from './courseStorage';

export interface AIExplanation {
  topic: string;
  explanation: string;
  keyConcepts: string[];
  latexFormula?: string;
}

export interface SemanticChunk {
  text: string;
  source: string;
}

export interface DocumentAnalysisResult {
  chunks: SemanticChunk[];
  rawText: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
  quiz?: QuizQuestion[];
  canTestKnowledge?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.data.arrayBuffer();
      
      // Spawn the web worker
      const worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'progress' && onProgress) {
          onProgress(data.currentPage, data.totalPages);
        } else if (data.type === 'complete') {
          worker.terminate();
          try {
            const chunks: SemanticChunk[] = JSON.parse(data.text);
            resolve({ chunks, rawText: data.rawText });
          } catch (err) {
            resolve({ chunks: [{ text: data.rawText, source: 'Page 1' }], rawText: data.rawText });
          }
        } else if (data.type === 'error') {
          worker.terminate();
          console.error('Worker error:', data.error);
          resolve({ chunks: [], rawText: `[Fallback] Error: ${data.error}` });
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        console.error('Worker fatal error:', err);
        resolve({ chunks: [], rawText: `[Fallback] Fatal error` });
      };

      // Transfer the buffer to the worker (zero-copy for performance)
      worker.postMessage({ arrayBuffer }, [arrayBuffer]);

    } catch (error) {
      console.error('PDF initialization error:', error);
      resolve({ chunks: [], rawText: `[Fallback] Extracted pseudo-content from ${file.name} due to initialization error.` });
    }
  });
}

/**
 * Searches the semantic chunks for keywords from the query. (Local Vector DB Mock)
 */
export function searchChunks(query: string, chunks: SemanticChunk[], topK: number = 3): SemanticChunk[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (keywords.length === 0) return chunks.slice(0, topK);

  const scoredChunks = chunks.map(chunk => {
    const textLower = chunk.text.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) score += 1;
    }
    return { chunk, score };
  });

  return scoredChunks
    .filter(sc => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(sc => sc.chunk);
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
