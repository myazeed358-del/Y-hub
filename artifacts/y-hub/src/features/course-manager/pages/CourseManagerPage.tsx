import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@workspace/y-hub-ds/components/ui/tabs';
import { ArrowRight, Loader2, BrainCircuit } from 'lucide-react';
import { CourseMaterialsTab } from '../components/CourseMaterialsTab';
import { CourseExamsTab } from '../components/CourseExamsTab';
import { useCourseManager } from '../hooks/useCourseManager';

export default function CourseManagerPage({ renderSyllabus }: { renderSyllabus?: (courseId: string, editable: boolean) => ReactNode }) {
  const { user, role } = useAuth();
  const {
    course,
    courseId,
    examTimeLimit,
    examTitle,
    exams,
    handleAddMaterial,
    handleAddQuestion,
    handleCreateExam,
    handleDeleteExam,
    handleDeleteMaterial,
    handleDeleteQuestion,
    handleToggleExamPublish,
    isAddExamOpen,
    isAddOpen,
    isAddQuestionOpen,
    isUploading,
    loadQuestions,
    loading,
    materials,
    newTitle,
    newType,
    newUrl,
    qContent,
    qCorrect,
    qOptions,
    qType,
    questions,
    selectedExam,
    setExamTimeLimit,
    setExamTitle,
    setIsAddExamOpen,
    setIsAddOpen,
    setIsAddQuestionOpen,
    setNewTitle,
    setNewType,
    setNewUrl,
    setQContent,
    setQCorrect,
    setQOptions,
    setQType,
    setSelectedExam,
    setUploadFile
  } = useCourseManager();

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

      {renderSyllabus?.(courseId, course?.instructor_id === user?.id && !!role && ['instructor','admin','super_admin'].includes(role))}
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
