import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';

export const SECTION_PAGE_SIZE = 25;
const sectionSchema = z.object({ id: z.string().uuid(), title: z.string(), section_label: z.string().nullable(), academic_term: z.string().nullable() });
export type LearningSection = z.infer<typeof sectionSchema>;
export type LearningRole = 'student' | 'instructor' | 'admin' | 'super_admin';

/** Directory filtering is a convenience; both this query and syllabus RPC enforce database permissions. */
export async function listLearningSections(actorId: string, role: LearningRole, page: number, signal: AbortSignal) {
  if (!z.string().uuid().safeParse(actorId).success || !['student', 'instructor', 'admin', 'super_admin'].includes(role)
    || !Number.isSafeInteger(page) || page < 0 || page > 10000) throw new Error('Invalid learning directory request');
  const fields = 'id,title,section_label,academic_term';
  let query = supabase.from('courses').select(role === 'student' ? `${fields},course_enrollments!inner(student_id,status)` : fields);
  if (role === 'student') query = query.eq('course_enrollments.student_id', actorId).eq('course_enrollments.status', 'active').eq('is_published', true);
  if (role === 'instructor') query = query.eq('instructor_id', actorId);
  const { data, error } = await query.order('title').order('id').range(page * SECTION_PAGE_SIZE, (page + 1) * SECTION_PAGE_SIZE).abortSignal(signal);
  if (error) throw new Error('Learning directory unavailable');
  const rows = z.array(sectionSchema).max(SECTION_PAGE_SIZE + 1).parse(data);
  return { sections: rows.slice(0, SECTION_PAGE_SIZE), hasNext: rows.length > SECTION_PAGE_SIZE };
}
