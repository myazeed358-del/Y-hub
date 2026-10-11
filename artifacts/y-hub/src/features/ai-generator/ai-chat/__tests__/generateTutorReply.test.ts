import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTutorReply } from '../generateTutorReply';

const mocks = vi.hoisted(() => ({
  askAiTutor: vi.fn(),
}));

vi.mock('../aiTutorClient', () => ({
  askAiTutor: mocks.askAiTutor,
}));

const courseId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  mocks.askAiTutor.mockReset();
});

describe('AI Tutor reply service', () => {
  it('retrieves relevant context and sends it to the real client', async () => {
    mocks.askAiTutor.mockResolvedValue('Vectors belong to vector spaces.');

    const relevant = {
      text: 'Vectors are objects in a vector space.',
      source: 'Page 1',
    };

    const result = await generateTutorReply(
      courseId,
      'Explain vectors',
      [
        relevant,
        { text: 'Biology studies cells.', source: 'Page 2' },
      ]
    );

    expect(mocks.askAiTutor).toHaveBeenCalledTimes(1);
    expect(mocks.askAiTutor).toHaveBeenCalledWith({
      courseId,
      question: 'Explain vectors',
      chunks: [relevant],
    });

    expect(result.role).toBe('ai');
    expect(result.content).toBe('Vectors belong to vector spaces.');
    expect(result.citations).toEqual(['Page 1']);
    expect(result.canTestKnowledge).toBe(true);
  });

  it('does not call Groq when context has no match', async () => {
    const result = await generateTutorReply(
      courseId,
      'Explain matrices',
      [{ text: 'Biology studies cells.', source: 'Page 3' }]
    );

    expect(mocks.askAiTutor).not.toHaveBeenCalled();
    expect(result.content).toContain('could not find relevant');
    expect(result.citations).toEqual([]);
  });

  it('deduplicates document context labels', async () => {
    mocks.askAiTutor.mockResolvedValue('Vector explanation.');

    const result = await generateTutorReply(
      courseId,
      'vector',
      [
        { text: 'Vector addition', source: 'Page 1' },
        { text: 'Vector axioms', source: 'Page 1' },
        { text: 'Vector norms', source: 'Page 2' },
      ]
    );

    expect(result.citations).toEqual(['Page 1', 'Page 2']);
    expect(mocks.askAiTutor).toHaveBeenCalledTimes(1);
  });

  it('propagates API failures without fabricating answers', async () => {
    mocks.askAiTutor.mockRejectedValue(
      new Error('AI Tutor rate limit reached.')
    );

    await expect(
      generateTutorReply(
        courseId,
        'Explain vector addition',
        [{ text: 'Vector addition', source: 'Page 1' }]
      )
    ).rejects.toThrow('AI Tutor rate limit reached.');
  });
});
