import { supabase } from '@/utils/supabaseClient';
import { snapshotSchema, type SyllabusSnapshot } from '../domain/syllabus';
export class SyllabusError extends Error {
  constructor(readonly kind: 'conflict' | 'denied' | 'unavailable' | 'invalid') { super(kind); }
}
export const syllabusRepository = {
  async read(courseId: string): Promise<SyllabusSnapshot> {
    const { data, error } = await supabase.rpc('read_course_syllabus', { p_course_id: courseId });
    if (error) throw new SyllabusError(error.code === '42501' ? 'denied' : 'unavailable');
    if (!data) throw new SyllabusError('denied');
    const result = snapshotSchema.safeParse(data);
    if (!result.success || result.data.courseId !== courseId) throw new SyllabusError('invalid');
    return result.data;
  },
  async save(snapshot: SyllabusSnapshot): Promise<SyllabusSnapshot> {
    const result = snapshotSchema.safeParse(snapshot);
    if (!result.success) throw new SyllabusError('invalid');
    // Let the server check the revision before saving new units.
    const { data, error } = await supabase.rpc('save_course_syllabus', {
      p_course_id: snapshot.courseId, p_expected_revision: snapshot.revision, p_units: result.data.units,
    });
    if (error) throw new SyllabusError(['PT409', '40001'].includes(error.code) ? 'conflict' : error.code === '42501' ? 'denied' : 'unavailable');
    if (!Number.isSafeInteger(data) || data < snapshot.revision) throw new SyllabusError('invalid');
    return { ...result.data, revision: data };
  },
};
