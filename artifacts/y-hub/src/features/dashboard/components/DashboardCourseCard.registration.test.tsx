import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DashboardCourseCard } from './DashboardCourseCard';
import { getDashboardCopy } from '@/i18n/dashboardCopy';

vi.mock('wouter', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}));
afterEach(cleanup);

const copy = getDashboardCopy(false);
const base = { id: 'course-1', title: 'Calculus', is_published: true,
  instructor_id: 'instructor-1', enrollment_open: false };

function show(open: boolean, canManage: boolean, busy = false) {
  const handleToggleEnrollmentOpen = vi.fn(async () => undefined);
  render(<DashboardCourseCard
    course={{ ...base, enrollment_open: open }}
    copy={copy} enrollmentCount={1} isArabic={false} canManage={canManage}
    onShowStudents={vi.fn()} handleDelete={vi.fn()}
    handleToggleStatus={vi.fn()} handleToggleEnrollmentOpen={handleToggleEnrollmentOpen}
    updatingEnrollmentId={busy ? 'course-1' : null}
  />);
  return handleToggleEnrollmentOpen;
}

describe('Instructor registration control', () => {
  it('offers to open closed registration', () => {
    const change = show(false, true);
    fireEvent.click(screen.getByRole('button', { name: 'Open registration' }));
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ id: 'course-1' }));
  });

  it('offers to close open registration', () => {
    const change = show(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Close registration' }));
    expect(change).toHaveBeenCalledOnce();
  });

  it('does not offer controls to nonowners', () => {
    show(true, false);
    expect(screen.queryByRole('button', { name: 'Close registration' })).toBeNull();
  });

  it('prevents repeat clicks while updating', () => {
    const change = show(true, true, true);
    const button = screen.getByRole('button', { name: 'Close registration' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(change).not.toHaveBeenCalled();
  });
});
