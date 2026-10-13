import type { Dispatch, SetStateAction } from 'react';
import type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
import { generateQuiz } from '@/features/ai-generator/quiz/generation/generateQuiz';

interface KnowledgeTestDependencies {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsThinking: Dispatch<SetStateAction<boolean>>;
}

export function createHandleTestKnowledge({
  messages,
  setMessages,
  setIsThinking,
}: KnowledgeTestDependencies) {
  return async (msgIndex: number, context: string) => {
    // Remove the button from the message so they can't click it twice
    const newMessages = [...messages];
    newMessages[msgIndex].canTestKnowledge = false;

    const loadingId = crypto.randomUUID();
    newMessages.push({
      id: loadingId,
      role: 'ai',
      content: 'Generating a quick knowledge check...'
    });
    setMessages(newMessages);
    setIsThinking(true);

    try {
      const quiz = await generateQuiz(context);
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? { ...m, content: 'Here is a quick quiz to test your understanding:', quiz } : m
      ));
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? { ...m, content: 'Sorry, I could not generate a quiz.' } : m
      ));
    } finally {
      setIsThinking(false);
    }
  };
}
