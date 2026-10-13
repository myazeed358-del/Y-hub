import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen, PenTool } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Props {
  course: { id: string; title: string };
  bookFile: { name: string } | null;
  isIndexing: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  showScratchpad: boolean;
  setShowScratchpad: Dispatch<SetStateAction<boolean>>;
}

export function AITutorHeader({
  course,
  bookFile,
  isIndexing,
  scrollRef,
  showScratchpad,
  setShowScratchpad,
}: Props) {
  return (
    <>
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
    </>
  );
}
