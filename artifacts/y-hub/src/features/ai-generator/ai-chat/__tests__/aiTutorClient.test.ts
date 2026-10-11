import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askAiTutor } from '../aiTutorClient';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

const request = {
  courseId: '123e4567-e89b-12d3-a456-426614174000',
  question: 'Explain linear algebra',
  chunks: [{ text: 'Vector spaces', source: 'Page 1' }],
};

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe('AI Tutor API Client', () => {
  it('sends the correct request and returns an answer', async () => {
    mocks.invoke.mockResolvedValue({
      data: { answer: '  A vector space is...  ' },
      error: null,
    });

    await expect(askAiTutor(request)).resolves.toBe(
      'A vector space is...'
    );

    expect(mocks.invoke).toHaveBeenCalledWith(
      'ai-tutor-chat',
      { body: request }
    );
  });

  it('rejects missing document excerpts', async () => {
    await expect(
      askAiTutor({ ...request, chunks: [] })
    ).rejects.toThrow('1 to 4');

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('rejects oversized questions before API calls', async () => {
    await expect(
      askAiTutor({ ...request, question: 'A'.repeat(1501) })
    ).rejects.toThrow('2–1500');

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('handles rate limits without exposing server details', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: { status: 429 } },
    });

    await expect(askAiTutor(request)).rejects.toMatchObject({
      name: 'AiTutorClientError',
      status: 429,
    });
  });

  it('rejects malformed server responses', async () => {
    mocks.invoke.mockResolvedValue({
      data: { answer: '   ' },
      error: null,
    });

    await expect(
      askAiTutor(request)
    ).rejects.toThrow('Invalid AI Tutor response');
  });

  it('handles network failures', async () => {
    mocks.invoke.mockRejectedValue(new Error('Network failed'));

    await expect(
      askAiTutor(request)
    ).rejects.toThrow('Cannot connect');
  });
});
