# Document Search

## Purpose
Search extracted document chunks for relevant text
used by the Y-Hub AI Tutor.

## Implementation
- searchChunks.ts: Keyword matching and ranking.
- __tests__/searchChunks.test.ts: Behavior and compatibility tests.

## Input
- User search query
- Array of SemanticChunk objects
- Maximum number of results (topK)

## Output
An array of matching SemanticChunk objects.

## Current limitations
- Keyword matching only
- No embeddings or vector database
- No true semantic similarity ranking
- Keywords of three or fewer characters are ignored

## Dependencies
- Document types:
  ../document-analysis/document.types.ts
- Consumer:
  ../../../pages/AIGenerator.tsx

## Troubleshooting
1. No results: inspect keyword filtering.
2. Incorrect ranking: inspect score calculation.
3. Missing document text: inspect PDF extraction
   in utils/pdfEngine.ts and utils/pdfWorker.ts.
4. Results not displayed: inspect AIGenerator.tsx.

## Verification
Run:
pnpm --filter y-hub typecheck
pnpm --filter y-hub exec vitest run
pnpm --filter y-hub build
