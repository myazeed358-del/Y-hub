import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ from: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), abortSignal: vi.fn() } }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { from: state.from } }));
import { listLearningSections } from '../services/learningPathRepository';
const id = '00000000-0000-4000-8000-000000000001';
const section = { id, title: 'Calculus', section_label: '01', academic_term: 'Fall' };
beforeEach(() => { vi.resetAllMocks(); state.from.mockReturnValue(state.query); for (const fn of ['select', 'eq', 'order', 'range'] as const) state.query[fn].mockReturnValue(state.query); state.query.abortSignal.mockResolvedValue({ data: [section], error: null }); });
it('uses the actual active-enrollment join and published filter with a bounded directory page', async () => {
  const signal = new AbortController().signal;
  expect(await listLearningSections(id, 'student', 2, signal)).toEqual({ sections: [section], hasNext: false });
  expect(state.query.select).toHaveBeenCalledWith('id,title,section_label,academic_term,course_enrollments!inner(student_id,status)');
  expect(state.query.eq.mock.calls).toEqual([['course_enrollments.student_id', id], ['course_enrollments.status', 'active'], ['is_published', true]]);
  expect(state.query.range).toHaveBeenCalledWith(50,75); expect(state.query.abortSignal).toHaveBeenCalledWith(signal);
});
it.each(['instructor','admin','super_admin'] as const)('retains staff RLS scope for %s', async role => {
  await listLearningSections(id, role, 0, new AbortController().signal);
  expect(state.query.select).toHaveBeenCalledWith('id,title,section_label,academic_term');
  expect(state.query.eq.mock.calls).toEqual(role === 'instructor' ? [['instructor_id',id]] : []);
});
it('uses lookahead without duplicating it in displayed sections', async () => {
  state.query.abortSignal.mockResolvedValue({ data: Array.from({length:26},()=>section), error:null });
  const result = await listLearningSections(id,'student',0,new AbortController().signal);
  expect(result.sections).toHaveLength(25); expect(result.hasNext).toBe(true);
});
it('does not turn permission/transport failures into an empty directory', async () => {
  state.query.abortSignal.mockResolvedValue({data:null,error:{message:'private details'}});
  await expect(listLearningSections(id,'student',0,new AbortController().signal)).rejects.toThrow('Learning directory unavailable');
});
it('rejects malformed rows and invalid pagination/identity', async () => {
  await expect(listLearningSections('invalid','student',0,new AbortController().signal)).rejects.toThrow();
  await expect(listLearningSections(id,'student',-1,new AbortController().signal)).rejects.toThrow();
  expect(state.from).not.toHaveBeenCalled();
  state.query.abortSignal.mockResolvedValue({data:[{...section,id:'not-uuid'}],error:null});
  await expect(listLearningSections(id,'student',0,new AbortController().signal)).rejects.toThrow();
});
