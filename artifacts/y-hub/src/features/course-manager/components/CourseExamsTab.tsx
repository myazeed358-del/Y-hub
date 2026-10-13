import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { TabsContent } from '@workspace/y-hub-ds/components/ui/tabs';
import { CourseCreateExamDialog } from './CourseCreateExamDialog';
import { CourseExamList } from './CourseExamList';
import { CourseExamQuestionsPanel } from './CourseExamQuestionsPanel';

type QuestionType = 'mcq' | 'tf' | 'math';

interface CourseExamsTabProps {
  exams: any[];
  selectedExam: any | null;
  setSelectedExam: Dispatch<SetStateAction<any | null>>;
  loadQuestions: (examId: string) => Promise<void>;
  handleDeleteExam: (id: string) => Promise<void>;
  handleToggleExamPublish: (exam: any) => Promise<void>;
  isAddExamOpen: boolean;
  setIsAddExamOpen: Dispatch<SetStateAction<boolean>>;
  examTitle: string;
  setExamTitle: Dispatch<SetStateAction<string>>;
  examTimeLimit: number;
  setExamTimeLimit: Dispatch<SetStateAction<number>>;
  handleCreateExam: () => Promise<void>;
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

export function CourseExamsTab({
  exams,
  selectedExam,
  setSelectedExam,
  loadQuestions,
  handleDeleteExam,
  handleToggleExamPublish,
  isAddExamOpen,
  setIsAddExamOpen,
  examTitle,
  setExamTitle,
  examTimeLimit,
  setExamTimeLimit,
  handleCreateExam,
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
}: CourseExamsTabProps) {
  return (
        <TabsContent value="exams" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">الاختبارات والبنك</h2>
            <CourseCreateExamDialog
              isAddExamOpen={isAddExamOpen}
              setIsAddExamOpen={setIsAddExamOpen}
              examTitle={examTitle}
              setExamTitle={setExamTitle}
              examTimeLimit={examTimeLimit}
              setExamTimeLimit={setExamTimeLimit}
              handleCreateExam={handleCreateExam}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <CourseExamList
              exams={exams}
              selectedExam={selectedExam}
              setSelectedExam={setSelectedExam}
              loadQuestions={loadQuestions}
              handleDeleteExam={handleDeleteExam}
              handleToggleExamPublish={handleToggleExamPublish}
            />

            <CourseExamQuestionsPanel
              selectedExam={selectedExam}
              questions={questions}
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
              handleDeleteQuestion={handleDeleteQuestion}
            />
          </div>
        </TabsContent>
  );
}
