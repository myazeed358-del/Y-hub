import type { Dispatch, SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import type { ChatMessage } from '@/features/ai-generator/ai-chat/chat.types';
import type { SemanticChunk } from '@/features/ai-generator/document-analysis/document.types';
import { supabase } from '@/utils/supabaseClient';
import { analyzeDocument } from '@/features/ai-generator/document-analysis/analyzeDocument';

interface CourseLoaderDependencies {
  courseId: string;
  user: User | null;
  setCourse: Dispatch<SetStateAction<any | null>>;
  setBookFile: Dispatch<SetStateAction<any | null>>;
  setSavedBookmarks: Dispatch<SetStateAction<Set<string>>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setErrorState: Dispatch<SetStateAction<string | null>>;
  setIsEnrolled: Dispatch<SetStateAction<boolean>>;
  setIsIndexing: Dispatch<SetStateAction<boolean>>;
  setChunks: Dispatch<SetStateAction<SemanticChunk[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export function createLoadAITutorCourse({
  courseId,
  user,
  setCourse,
  setBookFile,
  setSavedBookmarks,
  setIsLoading,
  setErrorState,
  setIsEnrolled,
  setIsIndexing,
  setChunks,
  setMessages,
}: CourseLoaderDependencies) {
    async function load() {
      setIsLoading(true);
      setErrorState(null);
      try {
        if (!courseId || !user) throw new Error("Invalid course or session");

        // Load course metadata before authorizing protected content.
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();

        if (courseError || !courseData) {
          setErrorState("Course not found or Supabase error.");
          setIsLoading(false);
          return;
        }

        // The course owner can preview AI Tutor without student enrollment.
        // Other users must have an active enrollment.
        const isCourseInstructor = courseData.instructor_id === user.id;

        if (!isCourseInstructor) {
          const { data: enrollment, error: enrollmentError } = await supabase
            .from('course_enrollments')
            .select('id')
            .eq('course_id', courseId)
            .eq('student_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (enrollmentError) throw enrollmentError;

          if (!enrollment) {
            setIsEnrolled(false);
            setIsLoading(false);
            return;
          }
        }

        setIsEnrolled(true);
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
  return load;
}
