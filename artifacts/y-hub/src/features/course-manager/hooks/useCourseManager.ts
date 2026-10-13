import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { createLoadQuestions } from '../handlers/createLoadQuestions';
import { createLoadData } from '../handlers/createLoadData';
import { createHandleCreateExam } from '../handlers/createHandleCreateExam';
import { createHandleToggleExamPublish } from '../handlers/createHandleToggleExamPublish';
import { createHandleDeleteExam } from '../handlers/createHandleDeleteExam';
import { createHandleAddQuestion } from '../handlers/createHandleAddQuestion';
import { createHandleDeleteQuestion } from '../handlers/createHandleDeleteQuestion';
import { createHandleAddMaterial } from '../handlers/createHandleAddMaterial';
import { createHandleDeleteMaterial } from '../handlers/createHandleDeleteMaterial';

export function useCourseManager() {
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
  return {
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
  };
}
