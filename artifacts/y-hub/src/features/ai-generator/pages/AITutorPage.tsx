import { KnowledgeSources } from "../knowledge/KnowledgeSources";
import { Link } from "wouter";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { Loader2 } from "lucide-react";
import { AITutorHeader } from "../components/AITutorHeader";
import { AITutorChatPanel } from "../components/AITutorChatPanel";
import { AITutorScratchpadPanels } from "../components/AITutorScratchpadPanels";
import { useAITutor } from "../hooks/useAITutor";

export default function AITutorPage() {
  const {
    language,
    setLanguage,
    sources,
    selected,
    setSelected,
    manage,
    handleIndex,
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
  } = useAITutor();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p>Loading course data...</p>
      </div>
    );
  }
  if (errorState && !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-destructive mb-4 font-bold text-xl">
          Error Loading Course
        </div>
        <p className="text-muted-foreground">{errorState}</p>
        <Link href="/dashboard">
          <Button className="mt-6">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }
  if (!isEnrolled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="font-bold text-xl mb-3">التسجيل مطلوب</div>
        <p className="text-muted-foreground mb-6 max-w-sm">
          يجب أن تكون مسجّلاً في هذا المساق للوصول إلى المعلم الذكي.
        </p>
        <Link href="/dashboard">
          <Button>العودة للوحة القيادة</Button>
        </Link>
      </div>
    );
  }
  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="font-bold text-xl mb-4">Course not found</div>
        <Link href="/dashboard">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

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
      <KnowledgeSources
        sources={sources}
        selected={selected}
        onSelect={setSelected}
        manage={manage}
        busy={isIndexing || isThinking}
        onIndex={handleIndex}
      />
      {errorState && (
        <p role="alert" className="text-destructive">{errorState}</p>
      )}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Area */}
        <AITutorChatPanel
          language={language}
          setLanguage={setLanguage}
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
