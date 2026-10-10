import { useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Card, CardContent } from '@workspace/y-hub-ds/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { QuizQuestion } from './quiz.types';
import { BlockMath, InlineMath } from 'react-katex';

interface QuizComponentProps {
  questions: QuizQuestion[];
}

export function QuizComponent({ questions }: QuizComponentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
    setShowResult(true);
    
    if (index === currentQuestion.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setIsFinished(true);
    }
  };

  const renderTextWithMath = (text: string) => {
    const parts = text.split(/(\\$\\$.+?\\$\\$|\\$.+?\\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={i} math={part.slice(2, -2)} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isFinished) {
    return (
      <Card className="bg-[hsl(var(--muted)/.3)] border-2 border-[hsl(var(--primary)/.5)] mt-4 shadow-sm w-full">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-bold mb-2">Quiz Completed!</h3>
          <p className="text-[hsl(var(--muted-foreground))] mb-4">
            You scored {score} out of {questions.length}
          </p>
          <div className="flex justify-center gap-1">
            {Array.from({ length: questions.length }).map((_, i) => (
              <div key={i} className={`h-2 w-8 rounded-full ${i < score ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive))]'}`} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[hsl(var(--background))] border-[hsl(var(--border))] mt-4 shadow-sm w-full">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4 text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>
        
        <h4 className="font-semibold text-base mb-5">
          {renderTextWithMath(currentQuestion.question)}
        </h4>

        <div className="space-y-2">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQuestion.correctIndex;
            
            let btnClass = "w-full justify-start text-left h-auto py-3 px-4 font-normal whitespace-normal ";
            
            if (showResult) {
              if (isCorrect) btnClass += "bg-[hsl(var(--primary)/.15)] border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.2)] ";
              else if (isSelected) btnClass += "bg-[hsl(var(--destructive)/.15)] border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.2)] ";
              else btnClass += "opacity-50 ";
            }

            return (
              <Button
                key={idx}
                variant={showResult && (isCorrect || isSelected) ? "outline" : "secondary"}
                className={btnClass}
                onClick={() => handleSelect(idx)}
                disabled={showResult}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{renderTextWithMath(option)}</span>
                  {showResult && isCorrect && <CheckCircle2 size={16} className="text-[hsl(var(--primary))]" />}
                  {showResult && isSelected && !isCorrect && <XCircle size={16} className="text-[hsl(var(--destructive))]" />}
                </div>
              </Button>
            );
          })}
        </div>

        {showResult && (
          <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] animate-in fade-in slide-in-from-top-2">
            <h5 className="text-xs font-bold uppercase mb-1">Explanation</h5>
            <p className="text-sm">{renderTextWithMath(currentQuestion.explanation)}</p>
            
            <Button className="w-full mt-4" onClick={handleNext}>
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
