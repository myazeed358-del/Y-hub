import { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage } from '../ai-chat/chat.types';
import type { SemanticChunk } from '../document-analysis/document.types';
import { createHandleSend } from '../handlers/createHandleSend';
import { createHandleBookmark } from '../handlers/createHandleBookmark';
import { createHandleTestKnowledge } from '../handlers/createHandleTestKnowledge';
import { createLoadAITutorCourse } from '../course/createLoadAITutorCourse';

export function useAITutor() {
  const [, params] = useRoute('/course/:id/ai-tutor');
  const courseId = params?.id || '';
  const { user } = useAuth();

  const [course, setCourse] = useState<any | null>(null);
  const [bookFile, setBookFile] = useState<any | null>(null);
  const [savedBookmarks, setSavedBookmarks] = useState<Set<string>>(new Set());
  const [showScratchpad, setShowScratchpad] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);

  // Knowledge Base State
  const [isIndexing, setIsIndexing] = useState(false);
  const [chunks, setChunks] = useState<SemanticChunk[]>([]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = createLoadAITutorCourse({
      courseId,
      user,
      setCourse,
      setBookFile,
      setSavedBookmarks,
      setIsLoading,
      setErrorState,
      setIsEnrolled,
      setIsIndexing,
      setChunks,
      setMessages,
    });
    load();
  }, [courseId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = createHandleSend({
    courseId,
    input,
    bookFile,
    isIndexing,
    isThinking,
    chunks,
    setMessages,
    setInput,
    setIsThinking,
  });
  const handleBookmark = createHandleBookmark({
    setSavedBookmarks,
  });
  const handleTestKnowledge = createHandleTestKnowledge({
    messages,
    setMessages,
    setIsThinking,
  });

  return {
    course,
    bookFile,
    savedBookmarks,
    showScratchpad,
    setShowScratchpad,
    isLoading,
    errorState,
    isEnrolled,
    isIndexing,
    messages,
    input,
    setInput,
    isThinking,
    scrollRef,
    handleSend,
    handleBookmark,
    handleTestKnowledge,
  };
}
