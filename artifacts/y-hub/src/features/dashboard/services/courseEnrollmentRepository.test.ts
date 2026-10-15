import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/utils/supabaseClient', () => ({
  supabase: { rpc },
}));

import { courseEnrollmentRepository } from './courseEnrollmentRepository';

beforeEach(() => rpc.mockReset());

describe('Course enrollment repository', () => {
  it('loads counts, including zero and Postgres bigint strings', async () => {
    rpc.mockResolvedValue({
      data: [
        { course_id: 'course-1', enrollment_count: '3' },
        { course_id: 'course-2', enrollment_count: 0 },
      ],
      error: null,
    });

    expect(await courseEnrollmentRepository.listCounts()).toEqual([
      { course_id: 'course-1', enrollment_count: 3 },
      { course_id: 'course-2', enrollment_count: 0 },
    ]);

    expect(rpc).toHaveBeenCalledWith(
      'list_managed_course_enrollment_counts'
    );
  });

  it('rejects invalid counts', async () => {
    rpc.mockResolvedValue({
      data: [{ course_id: 'course-1', enrollment_count: '-2' }],
      error: null,
    });

    await expect(courseEnrollmentRepository.listCounts()).rejects.toThrow();
  });

  it('loads the roster for a selected course', async () => {
    const students = [{
      student_id: 'student-1',
      full_name: 'Example Student',
      enrolled_at: '2026-10-15T00:00:00Z',
    }];

    rpc.mockResolvedValue({ data: students, error: null });

    expect(await courseEnrollmentRepository.getRoster('course-1'))
      .toEqual(students);

    expect(rpc).toHaveBeenCalledWith(
      'get_managed_course_enrollment_roster',
      { p_course_id: 'course-1' }
    );
  });

  it('propagates authorization errors', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error('Not authorized'),
    });

    await expect(
      courseEnrollmentRepository.getRoster('course-1')
    ).rejects.toThrow('Not authorized');
  });

  it('rejects empty course IDs without calling Supabase', async () => {
    await expect(
      courseEnrollmentRepository.getRoster(' ')
    ).rejects.toThrow('Course ID is required');

    expect(rpc).not.toHaveBeenCalled();
  });
});
