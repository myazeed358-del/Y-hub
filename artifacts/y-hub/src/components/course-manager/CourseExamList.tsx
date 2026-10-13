import type {
  Dispatch,
  MouseEvent,
  SetStateAction,
} from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  Clock,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CourseExamListProps {
  exams: any[];
  selectedExam: any | null;
  setSelectedExam: Dispatch<SetStateAction<any | null>>;
  loadQuestions: (examId: string) => Promise<void>;
  handleDeleteExam: (id: string) => Promise<void>;
  handleToggleExamPublish: (exam: any) => Promise<void>;
}

export function CourseExamList({
  exams,
  selectedExam,
  setSelectedExam,
  loadQuestions,
  handleDeleteExam,
  handleToggleExamPublish,
}: CourseExamListProps) {
  return (
            <div className="md:col-span-1 space-y-4">
              {exams.length === 0 ? (
                <Card className="bg-muted/30 border-dashed text-center py-8">
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Clock className="text-muted-foreground opacity-50 mb-2" size={36} />
                    <p className="text-sm font-semibold text-muted-foreground">لا يوجد اختبارات حتى الآن</p>
                  </CardContent>
                </Card>
              ) : exams.map(ex => (
                <Card key={ex.id} className={`cursor-pointer border-2 transition-colors ${selectedExam?.id === ex.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => { setSelectedExam(ex); loadQuestions(ex.id); }}>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg flex justify-between">
                      {ex.title}
                      <span className={`text-[10px] px-2 py-1 rounded-full ${ex.is_published ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{ex.is_published ? 'منشور' : 'مسودة'}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2"><Clock size={12}/> {ex.time_limit_minutes} دقيقة</div>
                  </CardHeader>
                  <CardFooter className="p-2 bg-muted/20 flex justify-between border-t">
                    <Button variant="ghost" size="icon" onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDeleteExam(ex.id); }} className="text-destructive h-8 w-8" aria-label="Delete Exam"><Trash2 size={14}/></Button>
                    <Button variant="ghost" size="icon" onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleToggleExamPublish(ex); }} className="h-8 w-8" aria-label={ex.is_published ? "Unpublish Exam" : "Publish Exam"}>{ex.is_published ? <EyeOff size={14}/> : <Eye size={14}/>}</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
  );
}
