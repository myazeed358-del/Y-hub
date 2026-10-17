import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repository } from './repository';

const mocks = vi.hoisted(() => {
  const response = { data: null as unknown, error: null as unknown };
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn(), returns: vi.fn(), insert: vi.fn(),
  };
  return { response, query, from: vi.fn(), getUser: vi.fn() };
});
vi.mock('@/utils/supabaseClient', () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.response.data = null; mocks.response.error = null;
  mocks.from.mockReturnValue(mocks.query);
  for (const method of ['select', 'eq', 'order'] as const) mocks.query[method].mockReturnValue(mocks.query);
  for (const method of ['single', 'returns', 'insert'] as const) mocks.query[method].mockImplementation(async () => mocks.response);
  mocks.getUser.mockImplementation(async () => ({ data: { user: null }, error: mocks.response.error }));
});

describe('student dashboard repository boundary', () => {
  it.each(['profile', 'publishedCourses', 'activeEnrollments', 'currentUser'] as const)(
    'propagates %s errors', async operation => {
      const error = new Error('Permission denied');
      mocks.response.error = error;
      await expect(repository[operation]('student-id')).rejects.toBe(error);
    },
  );
  it('retains stable student/course identities and active-enrollment filtering', async () => {
    mocks.response.data = [{ course_id: 'course-uuid' }];
    expect(await repository.activeEnrollments('student-uuid')).toEqual([{ course_id: 'course-uuid' }]);
    expect(mocks.from).toHaveBeenCalledWith('course_enrollments');
    expect(mocks.query.eq.mock.calls).toEqual([['student_id', 'student-uuid'], ['status', 'active']]);
  });
  it('preserves enrollment error codes and payload for the existing duplicate handling', async () => {
    mocks.response.error = { code: '23505' };
    expect(await repository.enroll('course-uuid', 'student-uuid')).toEqual({ code: '23505' });
    expect(mocks.query.insert).toHaveBeenCalledWith({ course_id: 'course-uuid', student_id: 'student-uuid', status: 'active' });
  });
  it('reads only published courses in the existing order', async () => {
    mocks.response.data = [{ id: 'uuid', title: 'Course' }];
    expect(await repository.publishedCourses()).toEqual(mocks.response.data);
    expect(mocks.query.eq).toHaveBeenCalledWith('is_published', true);
    expect(mocks.query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
