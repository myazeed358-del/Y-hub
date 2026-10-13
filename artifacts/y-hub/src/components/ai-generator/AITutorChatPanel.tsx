import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
import { Card } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  BrainCircuit, Loader2, Send, User,
  GraduationCap, BookmarkPlus, Check,
} from 'lucide-react';
import { ChatMessageContent } from '@/features/ai-generator/ai-chat/ChatMessageContent';
import { QuizComponent } from '@/features/ai-generator/quiz/QuizComponent';

interface Props {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isThinking: boolean;
  isIndexing: boolean;
  bookFile: unknown;
  savedBookmarks: Set<string>;
  handleSend: () => Promise<void>;
  handleBookmark: (id: string, content: string) => Promise<void>;
  handleTestKnowledge: (index: number, context: string) => Promise<void>;
}

export function AITutorChatPanel({
  scrollRef,
  messages,
  input,
  setInput,
  isThinking,
  isIndexing,
  bookFile,
  savedBookmarks,
  handleSend,
  handleBookmark,
  handleTestKnowledge,
}: Props) {
  return (
        <Card className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg, index) => (
              <div key={msg.id} className={`flex gap-4 min-w-0 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <BrainCircuit size={16} />}
                </div>

                <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full min-w-0`}>
                  <div className={`min-w-0 px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-tr-sm' : 'bg-[hsl(var(--muted)/.5)] border border-[hsl(var(--border))] rounded-tl-sm w-full'}`}>
                    <ChatMessageContent content={msg.content} />

                    {msg.quiz && (
                      <div className="mt-4">
                        <QuizComponent questions={msg.quiz} />
                      </div>
                    )}
                  </div>

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {msg.citations.map((citation, i) => (
                        <span key={i} className="text-[10px] font-mono px-2 py-1 rounded bg-[hsl(var(--accent)/.1)] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--accent)/.2)]">
                          Retrieved context: {citation}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.canTestKnowledge && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs"
                        onClick={() => handleTestKnowledge(index, msg.content)}
                      >
                        <GraduationCap size={14} /> Test My Knowledge
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`gap-2 text-xs ${savedBookmarks.has(msg.id) ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/.3)]' : ''}`}
                        onClick={() => handleBookmark(msg.id, msg.content)}
                        disabled={savedBookmarks.has(msg.id)}
                      >
                        {savedBookmarks.has(msg.id) ? (
                          <><Check size={14} /> Saved</>
                        ) : (
                          <><BookmarkPlus size={14} /> Save to Bookmarks</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-4 mr-auto">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--sidebar))] flex items-center justify-center text-[hsl(var(--sidebar-foreground))]">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[hsl(var(--muted)/.5)] border border-[hsl(var(--border))] rounded-tl-sm">
                  <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Searching knowledge base...
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2 relative"
            >
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question about the course material..."
                className="flex-1 pr-12 rounded-full"
                disabled={!bookFile || isIndexing || isThinking}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 bottom-1 h-auto rounded-full"
                disabled={!input.trim() || !bookFile || isIndexing || isThinking}
                aria-label="Send message"
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        </Card>
  );
}
