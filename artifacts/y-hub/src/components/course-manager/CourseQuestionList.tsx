import {
  CardContent,
} from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { BrainCircuit, Trash2 } from 'lucide-react';

interface CourseQuestionListProps {
  questions: any[];
  handleDeleteQuestion: (id: string) => Promise<void>;
}

export function CourseQuestionList({
  questions,
  handleDeleteQuestion,
}: CourseQuestionListProps) {
  return (
                  <CardContent className="p-0">
                    {questions.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground"><BrainCircuit size={48} className="mx-auto mb-4 opacity-50"/> ابدأ في إضافة أسئلة للاختبار</div>
                    ) : (
                      <div className="divide-y">
                        {questions.map((q, i) => (
                          <div key={q.id} className="p-4 hover:bg-muted/10 flex justify-between items-start">
                            <div>
                              <span className="font-bold text-primary ml-2">{i+1}.</span>
                              <span className="font-semibold">{q.content}</span>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {q.type === 'mcq' && q.options?.map((opt: string) => <span key={opt} className={`inline-block border px-2 py-1 rounded ml-2 mb-2 ${opt === q.correct_answer ? 'bg-primary/20 border-primary/40 text-primary' : ''}`}>{opt}</span>)}
                                {q.type === 'tf' && <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded">الجواب: {q.correct_answer}</span>}
                                {q.type === 'math' && <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded">الجواب الرياضي: {q.correct_answer}</span>}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} className="text-destructive"><Trash2 size={16}/></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
  );
}
