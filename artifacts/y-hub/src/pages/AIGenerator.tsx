import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
import type { SemanticChunk } from '@/features/ai-generator/document-analysis/document.types';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Loader2 } from 'lucide-react';
import { AITutorHeader } from '@/components/ai-generator/AITutorHeader';
import { AITutorChatPanel } from '@/components/ai-generator/AITutorChatPanel';
import { AITutorScratchpadPanels } from '@/components/ai-generator/AITutorScratchpadPanels';
import { createHandleSend } from '@/features/ai-generator/handlers/createHandleSend';
import { createHandleBookmark } from '@/features/ai-generator/handlers/createHandleBookmark';
import { createHandleTestKnowledge } from '@/features/ai-generator/handlers/createHandleTestKnowledge';
import { createLoadAITutorCourse } from '@/features/ai-generator/course/createLoadAITutorCourse';

export default function AIGenerator() {
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
  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-primary mb-4" size={48} /><p>Loading course data...</p></div>;
  if (errorState) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><div className="text-destructive mb-4 font-bold text-xl">Error Loading Course</div><p className="text-muted-foreground">{errorState}</p><Link href="/dashboard"><Button className="mt-6">Return to Dashboard</Button></Link></div>;
  if (!isEnrolled) return <div className="flex flex-col items-center justify-center min-h-[50vh] text-center"><div className="font-bold text-xl mb-3">التسجيل مطلوب</div><p className="text-muted-foreground mb-6 max-w-sm">يجب أن تكون مسجّلاً في هذا المساق للوصول إلى المعلم الذكي.</p><Link href="/dashboard"><Button>العودة للوحة القيادة</Button></Link></div>;
  if (!course) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><div className="font-bold text-xl mb-4">Course not found</div><Link href="/dashboard"><Button>Return to Dashboard</Button></Link></div>;

  return (
    <div className="mx-auto max-w-7xl py-10 px-5 flex flex-col h-[100dvh]">
      <AITutorHeader
        course={course}
        bookFile={bookFile}
        isIndexing={isIndexing}
        scrollRef={scrollRef}
        showScratchpad={showScratchpad}
        setShowScratchpad={setShowScratchpad}
      />
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Area */}
        <AITutorChatPanel
          scrollRef={scrollRef}
          messages={messages}
          input={input}
          setInput={setInput}
          isThinking={isThinking}
          isIndexing={isIndexing}
          bookFile={bookFile}
          savedBookmarks={savedBookmarks}
          handleSend={handleSend}
          handleBookmark={handleBookmark}
          handleTestKnowledge={handleTestKnowledge}
        />

        <AITutorScratchpadPanels
          showScratchpad={showScratchpad}
          setShowScratchpad={setShowScratchpad}
        />
      </div>
    </div>
  );
}
