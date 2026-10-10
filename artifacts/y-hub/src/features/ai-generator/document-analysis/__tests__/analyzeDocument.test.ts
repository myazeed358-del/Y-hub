import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { analyzeDocument } from '@/utils/pdfEngine';
import type { CourseFile } from '@/utils/courseStorage';

const mocked = vi.hoisted(() => ({
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: mocked.getDocument,
  GlobalWorkerOptions: { workerSrc: '' },
}));

const file: CourseFile = {
  id: 'test-pdf',
  courseId: 'test-course',
  type: 'book',
  name: 'two-pages.pdf',
  data: new NodeBlob(['PDF test data']) as unknown as Blob,
};

beforeEach(() => {
  mocked.getDocument.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Document Analysis', () => {
  it('extracts text with correct page sources and progress', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const progress = vi.fn();

    const getPage = vi.fn(async (number: number) => ({
      getTextContent: async () => ({
        items: [
          { str: number === 1 ? 'Linear Algebra' : 'Calculus' },
        ],
      }),
    }));

    mocked.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage,
      }),
      destroy,
    });

    const result = await analyzeDocument(file, progress);

    expect(result.chunks).toEqual([
      { text: 'Linear Algebra', source: 'Page 1' },
      { text: 'Calculus', source: 'Page 2' },
    ]);

    expect(result.rawText).toContain('Linear Algebra');
    expect(result.rawText).toContain('Calculus');

    expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2);

    expect(getPage).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();

    expect(mocked.getDocument).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    });
  });

  it('handles PDF extraction failure and cleans up', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    mocked.getDocument.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF')),
      destroy,
    });

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await analyzeDocument(file);

    expect(result.chunks).toEqual([]);
    expect(result.rawText).toContain('[Fallback]');
    expect(consoleSpy).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
