import { supabase } from '@/utils/supabaseClient';
import type { CourseDefinition, CourseSection } from '@/shared/academic/contracts';
import { definitionInput, sectionInput, pageSize, type Instructor, type DefinitionInput, type SectionInput } from '../domain/contracts';
// Treat search symbols as text, not wildcard patterns.
const filter = (search: string) => `%${search.replace(/[\\%_]/g, '\\$&')}%`;
function page(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid page'); return value * pageSize; }
// A write only counts when the server returns the expected ID.
async function confirmed(request: PromiseLike<{ data: unknown; error: unknown }>, expected: string) {
  const { data, error } = await request;
  if (error) throw error;
  if (data !== expected) throw Error('Mutation not confirmed');
}
export const academicRepository = {
  async definitions(search: string, index: number) {
    const offset = page(index);
    const { data, error } = await supabase.from('course_definitions').select('*').ilike('title', filter(search))
      .order('title').order('id').range(offset, offset + pageSize - 1).returns<CourseDefinition[]>();
    if (error) throw error;
    return data ?? [];
  },
  async sections(search: string, index: number) {
    const offset = page(index);
    const { data, error } = await supabase.from('course_sections').select('*').ilike('title', filter(search))
      .order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1).returns<CourseSection[]>();
    if (error) throw error;
    return data ?? [];
  },
  async instructors(search: string, index: number) {
    const { data, error } = await supabase.rpc('list_assignable_instructors', { p_search: search, p_offset: page(index) });
    if (error) throw error;
    return (data ?? []) as Instructor[];
  },
  createDefinition(raw: DefinitionInput) {
    const v = definitionInput.parse(raw);
    return confirmed(supabase.rpc('create_course_definition', { p_id: v.id, p_title: v.title, p_code: v.code,
      p_description: v.description, p_department: v.department, p_major: v.major }), v.id);
  },
  createSection(raw: SectionInput) {
    const v = sectionInput.parse(raw);
    return confirmed(supabase.rpc('create_academic_section', { p_id: v.id, p_definition: v.definition,
      p_instructor: v.instructor, p_label: v.label, p_term: v.term }), v.id);
  },
  assign(section: CourseSection, instructor: string) {
    return confirmed(supabase.rpc('assign_academic_section', { p_section: section.id,
      p_expected_instructor: section.instructor_id, p_instructor: instructor }), section.id);
  },
};
