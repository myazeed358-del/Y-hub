import { useState, useEffect, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { analyzeDocument, generateChatResponse, type ChatMessage, type SemanticChunk } from '@/utils/pdfEngine';
import { searchChunks } from '@/features/ai-generator/document-search/searchChunks';
import { generateQuiz } from '@/features/ai-generator/quiz/generation/generateQuiz';
import { Card, CardContent } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { ArrowLeft, BrainCircuit, Loader2, Send, User, BookOpen, GraduationCap, BookmarkPlus, Check, PenTool } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import { QuizComponent } from '@/features/ai-generator/quiz/QuizComponent';
import { Scratchpad } from '@/features/ai-generator/scratchpad/Scratchpad';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet, SheetContent } from '@workspace/y-hub-ds/components/ui/sheet';

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
    async function load() {
      setIsLoading(true);
      setErrorState(null);
      try {
        if (!courseId || !user) throw new Error("Invalid course or session");
        
        // Enrollment gate — must be checked before fetching any protected content
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('student_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!enrollment) {
          setIsEnrolled(false);
          setIsLoading(false);
          return;
        }
        setIsEnrolled(true);

        const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
        if (courseError || !courseData) {
          setErrorState("Course not found or Supabase error.");
          setIsLoading(false);
          return;
        }
        setCourse(courseData);

        const { data: files } = await supabase.from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .eq('type', 'pdf');
          
        const book = files?.[0]; // Pick first PDF as the reference
        if (book) {
          // Extract filename from URL
          const fileName = book.url.split('/').pop();
          if (fileName) {
            setIsIndexing(true);
            const { data: blobData, error: downloadError } = await supabase.storage.from('materials').download(fileName);
            if (!downloadError && blobData) {
              const fileObj = { name: book.title, data: blobData };
              setBookFile(fileObj);
              analyzeDocument(fileObj as any, () => {}).then(res => {
                setChunks(res.chunks);
                setIsIndexing(false);
                setMessages([{
                  id: crypto.randomUUID(),
                  role: 'ai',
                  content: `I have read and indexed **${book.title}**. I am ready to answer your questions and test your knowledge based on this material.`
                }]);
              });
            } else {
              setIsIndexing(false);
            }
          }
        }
        // Bookmarks were from IndexedDB, they cannot be safely migrated as there is no bookmarks table.
        setSavedBookmarks(new Set());
      } catch (e: any) {
        setErrorState(e.message || "An error occurred.");
      }
      setIsLoading(false);
    }
    load();
  }, [courseId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || !bookFile || isIndexing) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const relevantChunks = searchChunks(input, chunks);
      const aiResponse = await generateChatResponse(messages.concat(userMsg), relevantChunks, course.domain);
      setMessages(prev => [...prev, aiResponse]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ai',
        content: 'Sorry, I encountered an error while processing your request.'
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleBookmark = async (msgId: string, content: string) => {
    try {
      console.warn('Bookmarks are not supported yet. Supabase schema missing.');
      setSavedBookmarks(prev => new Set(prev).add(msgId));
    } catch (e) {
      console.error('Failed to save bookmark', e);
    }
  };

  const handleTestKnowledge = async (msgIndex: number, context: string) => {
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

  const renderTextWithMath = (text: string) => {
    const parts = text.split(/(\$\$.+?\$\$|\$.+?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={i} math={part.slice(2, -2)} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-primary mb-4" size={48} /><p>Loading course data...</p></div>;
  if (errorState) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><div className="text-destructive mb-4 font-bold text-xl">Error Loading Course</div><p className="text-muted-foreground">{errorState}</p><Link href="/dashboard"><Button className="mt-6">Return to Dashboard</Button></Link></div>;
  if (!isEnrolled) return <div className="flex flex-col items-center justify-center min-h-[50vh] text-center"><div className="font-bold text-xl mb-3">التسجيل مطلوب</div><p className="text-muted-foreground mb-6 max-w-sm">يجب أن تكون مسجّلاً في هذا المساق للوصول إلى المعلم الذكي.</p><Link href="/dashboard"><Button>العودة للوحة القيادة</Button></Link></div>;
  if (!course) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><div className="font-bold text-xl mb-4">Course not found</div><Link href="/dashboard"><Button>Return to Dashboard</Button></Link></div>;

  return (
    <div className="mx-auto max-w-7xl py-10 px-5 flex flex-col h-[100dvh]">
      <Link href={`/course/${course.id}`} className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] mb-4 w-fit">
        <ArrowLeft size={16} /> Back to Course Manager
      </Link>
      
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AI Tutor: {course.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            <BookOpen size={14} />
            {bookFile ? (isIndexing ? 'Indexing textbook...' : `Knowledge Base: ${bookFile.name}`) : 'No textbook uploaded'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={() => {
            const element = scrollRef.current;
            if (element) {
              import('html2pdf.js').then(html2pdf => {
                const opt = {
                  margin: 10,
                  filename: `${course.title.replace(/\s+/g, '_')}_Notes.pdf`,
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2 },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf.default().set(opt).from(element).save();
              });
            }
          }} title="Export to PDF">
            <BookOpen size={16} />
          </Button>
          <Button 
            variant={showScratchpad ? 'default' : 'outline'} 
            className="gap-2"
            onClick={() => setShowScratchpad(!showScratchpad)}
          >
            <PenTool size={16} /> <span className="hidden sm:inline">{showScratchpad ? 'Close Scratchpad' : 'Open Scratchpad'}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map((msg, index) => (
              <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <BrainCircuit size={16} />}
                </div>
                
                <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                  <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-tr-sm' : 'bg-[hsl(var(--muted)/.5)] border border-[hsl(var(--border))] rounded-tl-sm w-full'}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-x-auto">
                      {renderTextWithMath(msg.content)}
                    </div>
                    
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
                          Source: {citation}
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

        {/* Scratchpad (Desktop) */}
        {showScratchpad && (
          <div className="hidden md:flex md:w-[40%] flex-col min-h-0 border-l border-[hsl(var(--border))]">
            <Scratchpad />
          </div>
        )}

        {/* Scratchpad (Mobile) */}
        <Sheet open={showScratchpad} onOpenChange={setShowScratchpad}>
          <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col md:hidden">
            <Scratchpad />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
