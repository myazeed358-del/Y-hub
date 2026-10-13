import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@workspace/y-hub-ds/components/ui/tabs';
import { ArrowRight, Loader2, BrainCircuit } from 'lucide-react';
import { CourseMaterialsTab } from '@/components/course-manager/CourseMaterialsTab';
import { CourseExamsTab } from '@/components/course-manager/CourseExamsTab';
import { createLoadQuestions } from '@/features/course-manager/handlers/createLoadQuestions';
import { createLoadData } from '@/features/course-manager/handlers/createLoadData';
import { createHandleCreateExam } from '@/features/course-manager/handlers/createHandleCreateExam';
import { createHandleToggleExamPublish } from '@/features/course-manager/handlers/createHandleToggleExamPublish';
import { createHandleDeleteExam } from '@/features/course-manager/handlers/createHandleDeleteExam';
import { createHandleAddQuestion } from '@/features/course-manager/handlers/createHandleAddQuestion';
import { createHandleDeleteQuestion } from '@/features/course-manager/handlers/createHandleDeleteQuestion';
import { createHandleAddMaterial } from '@/features/course-manager/handlers/createHandleAddMaterial';
import { createHandleDeleteMaterial } from '@/features/course-manager/handlers/createHandleDeleteMaterial';

export default function CourseManager() {
  const [, params] = useRoute('/course/:id');
  const courseId = params?.id || '';

  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add material states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'pdf' | 'video' | 'link'>('pdf');
  const [newUrl, setNewUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Exam states
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examTimeLimit, setExamTimeLimit] = useState(30);

  // Question states
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [qType, setQType] = useState<'mcq' | 'tf' | 'math'>('mcq');
  const [qContent, setQContent] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']); // For MCQ

  const loadData = createLoadData({
    courseId,
    setCourse,
    setMaterials,
    setExams,
    setLoading,
  });

  const loadQuestions = createLoadQuestions({
    setQuestions,
  });

  useEffect(() => {
    if (courseId) loadData();
  }, [courseId]);

  const handleAddMaterial = createHandleAddMaterial({
    courseId,
    newTitle,
    newType,
    newUrl,
    uploadFile,
    setIsUploading,
    setNewTitle,
    setNewUrl,
    setUploadFile,
    setIsAddOpen,
    loadData,
  });
  const handleDeleteMaterial = createHandleDeleteMaterial({
    materials,
    loadData,
  });
  const handleCreateExam = createHandleCreateExam({
    courseId,
    examTitle,
    examTimeLimit,
    setExamTitle,
    setIsAddExamOpen,
    loadData,
  });
  const handleToggleExamPublish = createHandleToggleExamPublish({
    loadData,
  });
  const handleDeleteExam = createHandleDeleteExam({
    selectedExam,
    setSelectedExam,
    loadData,
  });
  const handleAddQuestion = createHandleAddQuestion({
    courseId,
    selectedExam,
    qType,
    qContent,
    qCorrect,
    qOptions,
    setQContent,
    setQCorrect,
    setQOptions,
    setIsAddQuestionOpen,
    loadQuestions,
  });
  const handleDeleteQuestion = createHandleDeleteQuestion({
    selectedExam,
    loadQuestions,
  });
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="mx-auto max-w-6xl py-10 px-5" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="outline" size="icon"><ArrowRight size={16} /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{course?.title}</h1>
          <p className="text-muted-foreground mt-1">إدارة مسار التعليم والاختبارات</p>
        </div>
        <Link href={`/course/${courseId}/ai-tutor`} className="mr-auto">
          <Button variant="outline" className="gap-2">
            <BrainCircuit size={18} />
            تجربة المعلم الذكي
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2 h-12">
          <TabsTrigger value="materials">المواد التعليمية</TabsTrigger>
          <TabsTrigger value="exams">الاختبارات والتمارين</TabsTrigger>
        </TabsList>

        {/* MATERIALS TAB */}
        <CourseMaterialsTab
          materials={materials}
          isAddOpen={isAddOpen}
          setIsAddOpen={setIsAddOpen}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          newType={newType}
          setNewType={setNewType}
          newUrl={newUrl}
          setNewUrl={setNewUrl}
          setUploadFile={setUploadFile}
          isUploading={isUploading}
          handleAddMaterial={handleAddMaterial}
          handleDeleteMaterial={handleDeleteMaterial}
        />

        {/* EXAMS TAB */}
        <CourseExamsTab
          exams={exams}
          selectedExam={selectedExam}
          setSelectedExam={setSelectedExam}
          loadQuestions={loadQuestions}
          handleDeleteExam={handleDeleteExam}
          handleToggleExamPublish={handleToggleExamPublish}
          isAddExamOpen={isAddExamOpen}
          setIsAddExamOpen={setIsAddExamOpen}
          examTitle={examTitle}
          setExamTitle={setExamTitle}
          examTimeLimit={examTimeLimit}
          setExamTimeLimit={setExamTimeLimit}
          handleCreateExam={handleCreateExam}
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
      </Tabs>
    </div>
  );
}
