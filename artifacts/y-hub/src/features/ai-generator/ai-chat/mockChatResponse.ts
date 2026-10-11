import type { ChatMessage } from './chat.types';
import type { SemanticChunk } from '../document-analysis/document.types';

export async function generateChatResponse(
  messages: ChatMessage[],
  retrievedChunks: SemanticChunk[],
  domain: string = 'general'
): Promise<ChatMessage> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM processing

  if (retrievedChunks.length === 0) {
    return {
      id: crypto.randomUUID(),
      role: 'ai',
      content: 'I could not find any information about that in the uploaded textbook. Please try asking about a different topic.',
      citations: []
    };
  }

  // Determine dynamic prompt response based on domain
  const primaryChunk = retrievedChunks[0];
  const query = messages[messages.length - 1].content.toLowerCase();

  let prefix = '';
  if (domain === 'medicine') {
    prefix = `**Clinical Analysis:** Based on the medical textbook context:\n\n`;
  } else if (domain === 'engineering') {
    prefix = `**Engineering & Math Derivation:** Based on the textbook proofs:\n\n`;
  } else if (domain === 'humanities') {
    prefix = `**Historical/Logical Context:** According to the referenced text:\n\n`;
  } else if (domain === 'cs') {
    prefix = `**Algorithmic Breakdown:** According to the textbook structure:\n\n`;
  } else {
    prefix = `Based on the textbook, here is the answer to your question:\n\n`;
  }

  let content = `${prefix}> "${primaryChunk.text.substring(0, 150)}..."\n\n`;

  const isFuzzy = query.includes('fuzzy') || primaryChunk.text.toLowerCase().includes('fuzzy');

  if (isFuzzy) {
    content += `When dealing with fuzzy sets, we often represent the membership function as $ \mu_A(x) $. For intersection, the standard operation is the minimum T-norm:\n$$ \mu_{A \cap B}(x) = \min(\mu_A(x), \mu_B(x)) $$\nThis guarantees bounded membership.`;
  } else {
    content += `The text explains that this concept is fundamental to the topic. For example, if we consider a generic formula $ x^2 + y^2 = z^2 $, it forms the basis of the structural integrity.`;
  }

  const uniqueCitations = Array.from(new Set(retrievedChunks.map(c => c.source)));

  return {
    id: crypto.randomUUID(),
    role: 'ai',
    content,
    citations: uniqueCitations,
    canTestKnowledge: true
  };
}
