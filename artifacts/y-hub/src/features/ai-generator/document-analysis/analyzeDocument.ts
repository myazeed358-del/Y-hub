import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { CourseFile } from '@/utils/courseStorage';
import type { DocumentAnalysisResult, SemanticChunk } from './document.types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
