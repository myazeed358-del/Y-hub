import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentDashboard } from './useStudentDashboard';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(), profile: vi.fn(), publishedCourses: vi.fn(), activeEnrollments: vi.fn(), enroll: vi.fn(),
  setLocation: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn(),
}));
vi.mock('../services/repository', () => ({ repository: mocks }));
vi.mock('wouter', () => ({ useLocation: () => ['/', mocks.setLocation] }));
vi.mock('sonner', () => ({ toast: mocks }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'en' }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: 'student-uuid' });
  mocks.profile.mockResolvedValue({ full_name: 'Student Name', major: 'mathematics' });
  mocks.publishedCourses.mockResolvedValue([{ id: 'course-uuid', title: 'Course' }]);
  mocks.activeEnrollments.mockResolvedValue([{ course_id: 'course-uuid' }]);
  mocks.enroll.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('student dashboard controller', () => {
  it('uses manifest contributions while retaining existing tool labels and order', async () => {
    const { result } = renderHook(useStudentDashboard);
    await waitFor(() => expect(result.current.firstName).toBe('Student'));
    await waitFor(() => expect(result.current.tools.map(tool => tool.name)).toEqual(['Graphing', 'Equations', 'Statistics']));
    expect(result.current.tools.map(tool => tool.path)).toEqual(['/calculus', '/solver', '/lab']);
    expect(result.current.enrolledIds.has('course-uuid')).toBe(true);
  });
  it('hides math tools for a student in another major', async () => {
    mocks.profile.mockResolvedValue({ full_name: 'Medicine Student', major: 'medicine' });
    const { result } = renderHook(useStudentDashboard);
    await waitFor(() => expect(result.current.firstName).toBe('Medicine'));
    expect(result.current.tools).toEqual([]);
  });
  it('reports failed data loads instead of unhandled rejections', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.publishedCourses.mockRejectedValue(new Error('Permission denied'));
    renderHook(useStudentDashboard);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  });
  it('does not update or report errors after unmount', async () => {
    let reject!: (reason: Error) => void;
    mocks.currentUser.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const hook = renderHook(useStudentDashboard);
    hook.unmount();
    await act(async () => { reject(new Error('Late failure')); });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it('retains duplicate-enrollment handling without replacing identifiers', async () => {
    mocks.enroll.mockResolvedValue({ code: '23505' });
    const { result } = renderHook(useStudentDashboard);
    await waitFor(() => expect(result.current.courses).toHaveLength(1));
    await act(async () => { await result.current.handleEnroll('another-course-uuid'); });
    expect(mocks.enroll).toHaveBeenCalledWith('another-course-uuid', 'student-uuid');
    expect(mocks.info).toHaveBeenCalledWith('alreadyEnrolled');
    expect(result.current.enrolledIds.has('another-course-uuid')).toBe(true);
  });
});
