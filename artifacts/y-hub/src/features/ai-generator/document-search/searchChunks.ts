import type { SemanticChunk } from '@/features/ai-generator/document-analysis/document.types';

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
