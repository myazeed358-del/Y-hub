import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';
import { DashboardCourseCard } from './DashboardCourseCard';

vi.mock('wouter', () => ({
  Link: ({
    href, children, className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => <a href={href} className={className}>{children}</a>,
}));

afterEach(cleanup);

const copy = {
  publishedBadge: 'Published',
  draftBadge: 'Draft',
  noDescription: 'No description',
  delete: 'Delete',
  publish: 'Publish',
  unpublish: 'Unpublish',
  manage: 'Manage',
} as unknown as ReturnType<typeof getDashboardCopy>;

const course = {
  id: 'course-1',
  title: 'Calculus',
  instructor_id: 'instructor-1',
  is_published: true,
};

describe('Course enrollment card', () => {
  it('shows count and opens the students list', () => {
    const onShowStudents = vi.fn();

    render(
      <DashboardCourseCard
        course={course}
        copy={copy}
        enrollmentCount={3}
        isArabic={false}
        canManage={true}
        onShowStudents={onShowStudents}
        handleDelete={vi.fn()}
        handleToggleStatus={vi.fn()}
      />
    );

    const button = screen.getByRole('button', {
      name: /View names/,
    });

    expect(button.textContent).toContain('3');
    fireEvent.click(button);
    expect(onShowStudents).toHaveBeenCalledOnce();
  });

  it('does not show editing controls to nonowners', () => {
    render(
      <DashboardCourseCard
        course={course}
        copy={copy}
        enrollmentCount={0}
        isArabic={false}
        canManage={false}
        onShowStudents={vi.fn()}
        handleDelete={vi.fn()}
        handleToggleStatus={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Delete')).toBeNull();
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.getByRole('button', {
      name: /View names/,
    }).textContent).toContain('0');
  });
});
