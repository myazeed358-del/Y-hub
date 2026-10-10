import { describe, expect, it } from 'vitest';
import { searchChunks } from '../searchChunks';
import { searchChunks as legacySearchChunks } from '@/utils/pdfEngine';
import type { SemanticChunk } from '@/features/ai-generator/document-analysis/document.types';

describe('Document Search', () => {
  const chunks: SemanticChunk[] = [
    { text: 'Linear algebra basics', source: 'Page 1' },
    { text: 'Linear algebra and matrix methods', source: 'Page 2' },
    { text: 'Matrix operations and applications', source: 'Page 3' },
  ];

  it('preserves the legacy export', () => {
    expect(legacySearchChunks).toBe(searchChunks);
  });

  it('searches case-insensitively', () => {
    const result = searchChunks('MATRIX', chunks);

    expect(result).toEqual([chunks[1], chunks[2]]);
  });

  it('ranks matches and respects topK', () => {
    const result = searchChunks('linear matrix', chunks, 2);

    expect(result).toEqual([chunks[1], chunks[0]]);
  });

  it('returns initial chunks for short keywords', () => {
    const result = searchChunks('a of', chunks, 2);

    expect(result).toEqual(chunks.slice(0, 2));
  });

  it('returns no results when nothing matches', () => {
    const result = searchChunks('astronomy', chunks);

    expect(result).toEqual([]);
  });
});
