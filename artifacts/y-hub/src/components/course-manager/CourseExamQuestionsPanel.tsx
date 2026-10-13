import type {
  Dispatch,
  SetStateAction,
} from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
} from '@workspace/y-hub-ds/components/ui/card';
import { CourseAddQuestionDialog } from './CourseAddQuestionDialog';
import { CourseQuestionList } from './CourseQuestionList';

type QuestionType = 'mcq' | 'tf' | 'math';

interface CourseExamQuestionsPanelProps {
  selectedExam: any | null;
  questions: any[];
  isAddQuestionOpen: boolean;
  setIsAddQuestionOpen: Dispatch<SetStateAction<boolean>>;
  qType: QuestionType;
  setQType: Dispatch<SetStateAction<QuestionType>>;
  qContent: string;
  setQContent: Dispatch<SetStateAction<string>>;
  qCorrect: string;
  setQCorrect: Dispatch<SetStateAction<string>>;
  qOptions: string[];
  setQOptions: Dispatch<SetStateAction<string[]>>;
  handleAddQuestion: () => Promise<void>;
  handleDeleteQuestion: (id: string) => Promise<void>;
}

export function CourseExamQuestionsPanel({
  selectedExam,
  questions,
  isAddQuestionOpen,
  setIsAddQuestionOpen,
  qType,
  setQType,
  qContent,
  setQContent,
  qCorrect,
  setQCorrect,
  qOptions,
  setQOptions,
  handleAddQuestion,
  handleDeleteQuestion,
}: CourseExamQuestionsPanelProps) {
  return (
            <div className="md:col-span-2">
              {selectedExam ? (
                <Card className="border-2 border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
                    <div>
                      <CardTitle>{selectedExam.title} - الأسئلة</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">يحتوي على {questions.length} أسئلة</p>
                    </div>
                    <CourseAddQuestionDialog
                      isAddQuestionOpen={isAddQuestionOpen}
                      setIsAddQuestionOpen={setIsAddQuestionOpen}
                      qType={qType}
                      setQType={setQType}
                      qContent={qContent}
                      setQContent={setQContent}
                      qCorrect={qCorrect}
                      setQCorrect={setQCorrect}
                      qOptions={qOptions}
                      setQOptions={setQOptions}
                      handleAddQuestion={handleAddQuestion}
                    />
                  </CardHeader>
                  <CourseQuestionList
                    questions={questions}
                    handleDeleteQuestion={handleDeleteQuestion}
                  />
                </Card>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-10 text-muted-foreground">
                  اختر اختباراً من القائمة الجانبية لعرض وتعديل أسئلته
                </div>
              )}
            </div>
  );
}
