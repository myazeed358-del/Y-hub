export type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
export { generateChatResponse } from '@/features/ai-generator/ai-chat/mockChatResponse';
export { analyzeDocument } from '@/features/ai-generator/document-analysis/analyzeDocument';

export type { SemanticChunk, DocumentAnalysisResult } from '@/features/ai-generator/document-analysis/document.types';
export { searchChunks } from '@/features/ai-generator/document-search/searchChunks';
export type { QuizQuestion } from '@/features/ai-generator/quiz/quiz.types';
export { generateQuiz } from '@/features/ai-generator/quiz/generation/generateQuiz';

// Stable legacy API for callers that still import '@/utils/pdfEngine'.
export { generateTimeline } from '@/features/course-manager/domain/generateTimeline';
export { generateLessonPlan } from '@/features/ai-generator/lesson-plan/generateLessonPlan';
export type { AIExplanation } from '@/features/ai-generator/lesson-plan/generateLessonPlan';
