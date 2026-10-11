import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { generateChatResponse } from '../mockChatResponse';
import {
  generateChatResponse as legacyGenerateChatResponse,
} from '@/utils/pdfEngine';

import type { ChatMessage } from '../chat.types';
import type { SemanticChunk } from '../../document-analysis/document.types';

const userMessages: ChatMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    content: 'Explain linear algebra',
  },
];

async function respond(
  chunks: SemanticChunk[],
  domain = 'general',
  messages = userMessages
) {
  const pending = generateChatResponse(
    messages,
    chunks,
    domain
  );

  await vi.advanceTimersByTimeAsync(1500);

  return pending;
}

describe('AI Chat mock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves the legacy export', () => {
    expect(legacyGenerateChatResponse).toBe(
      generateChatResponse
    );
  });

  it('handles missing document context', async () => {
    const result = await respond([]);

    expect(result.role).toBe('ai');
    expect(result.content).toContain(
      'could not find any information'
    );
    expect(result.citations).toEqual([]);
  });

  it('uses engineering context and unique citations', async () => {
    const chunks: SemanticChunk[] = [
      { text: 'Structural analysis', source: 'Page 1' },
      { text: 'Material strength', source: 'Page 1' },
      { text: 'Force vectors', source: 'Page 2' },
    ];

    const result = await respond(
      chunks,
      'engineering'
    );

    expect(result.role).toBe('ai');
    expect(result.content).toContain(
      'Engineering & Math Derivation'
    );
    expect(result.content).toContain(
      'Structural analysis'
    );
    expect(result.citations).toEqual([
      'Page 1',
      'Page 2',
    ]);
    expect(result.canTestKnowledge).toBe(true);
  });

  it('uses the fuzzy sets response branch', async () => {
    const messages: ChatMessage[] = [
      {
        id: 'user-fuzzy',
        role: 'user',
        content: 'Explain fuzzy intersection',
      },
    ];

    const result = await respond(
      [{ text: 'Membership functions', source: 'Page 3' }],
      'general',
      messages
    );

    expect(result.content).toContain(
      'membership function'
    );
    expect(result.citations).toEqual(['Page 3']);
    expect(result.canTestKnowledge).toBe(true);
  });
});
