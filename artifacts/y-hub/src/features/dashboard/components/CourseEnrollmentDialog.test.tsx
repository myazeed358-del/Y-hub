import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CourseEnrollmentDialog } from './CourseEnrollmentDialog';

afterEach(cleanup);

describe('Course roster numbers', () => {
  it('displays student name and Y-Hub number', () => {
    render(
      <CourseEnrollmentDialog
        course={{
          id: 'course-1',
          title: 'Calculus 1',
          is_published: true,
          enrollment_open: true,
        }}
        students={[{
          student_id: 'student-1',
          full_name: 'Ahmad Mohammad',
          user_number: '261000001',
          enrolled_at: '2026-10-16T00:00:00Z',
        }]}
        loading={false}
        error={false}
        isArabic={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Ahmad Mohammad')).toBeTruthy();
    expect(screen.getByText('261000001')).toBeTruthy();
  });
});
