import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StudentDashboardMain } from './StudentDashboardMain';

afterEach(cleanup);

const t = (key: string) => ({
  welcomeBack: 'Welcome', digitalHub: 'Study', enrolledCourses: 'Enrolled',
  currentObjectives: 'Objectives', noObjectives: 'None', availableCourses: 'Courses',
  notEnrolled: 'Not enrolled', enrolled: 'Enrolled', enrollNow: 'Enroll now',
  registrationClosed: 'Registration closed', enterCourse: 'Enter course',
  completeAssignments: 'Assignments', weeklyLectures: 'Lectures',
  enrolling: 'Enrolling',
} as Record<string, string>)[key] ?? key;

function show(enrollment_open: boolean, enrolled: boolean) {
  const handleEnroll = vi.fn(async () => undefined);
  const setLocation = vi.fn();
  render(<StudentDashboardMain
    t={t as any} firstName="Student"
    enrolledIds={new Set(enrolled ? ['course-1'] : [])}
    courses={[{ id: 'course-1', title: 'Calculus', enrollment_open }]}
    enrollingId={null} handleEnroll={handleEnroll} setLocation={setLocation}
  />);
  return { handleEnroll, setLocation };
}

describe('Student enrollment availability', () => {
  it('blocks registration for nonmembers when closed', () => {
    const { handleEnroll } = show(false, false);
    const button = screen.getByRole('button', { name: 'Registration closed' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(handleEnroll).not.toHaveBeenCalled();
  });

  it('allows enrollment when open', () => {
    const { handleEnroll } = show(true, false);
    fireEvent.click(screen.getByRole('button', { name: 'Enroll now' }));
    expect(handleEnroll).toHaveBeenCalledWith('course-1');
  });

  it('keeps course access for enrolled students when closed', () => {
    const { setLocation } = show(false, true);
    fireEvent.click(screen.getByRole('button', { name: 'Enter course' }));
    expect(setLocation).toHaveBeenCalledWith('/course/course-1/view');
  });
});
