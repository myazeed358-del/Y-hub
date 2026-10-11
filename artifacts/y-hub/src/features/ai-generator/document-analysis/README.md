# Document Analysis

## Purpose
Extract text from PDF files for the Y-Hub AI Tutor.

## Files
- analyzeDocument.ts: PDF extraction logic.
- document.types.ts: Document and chunk types.
- __fixtures__/two-pages.pdf: Test PDF.
- __tests__/analyzeDocument.test.ts: Unit tests.

## Dependencies
- pdfjs-dist: PDF parsing.
- courseStorage.ts: CourseFile type.
- PDF.js worker: Loaded through Vite asset URL.

## Current Behavior
- Extracts text page by page.
- Divides page text into chunks of up to 1500 characters.
- Preserves page numbers as source metadata.
- Reports extraction progress.
- Releases PDF resources after completion.
- Returns an empty-chunk fallback on failure.

## Limitations
- Text extraction only; no OCR.
- Fixed-length chunking, not semantic chunking.
- Browser integration must be tested after changes.
- Extraction failures currently return fallback results.

## Troubleshooting
1. Extraction failure: Check analyzeDocument.ts.
2. Worker errors: Check PDF.js worker URL.
3. Incorrect page sources: Check page iteration.
4. Missing document: Check course material download.
5. Missing chat context: Check Document Search.
6. AI Tutor issues: Check pages/AIGenerator.tsx.

## Verification
pnpm --filter y-hub typecheck
pnpm --filter y-hub exec vitest run
pnpm --filter y-hub build
