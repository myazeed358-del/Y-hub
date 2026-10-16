import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StudentEnrollmentGate } from './StudentEnrollmentGate';

vi.mock('wouter', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}));
afterEach(cleanup);

describe('Student course enrollment gate', () => {
  it('does not allow new registration when closed', () => {
    const handleEnroll = vi.fn(async () => undefined);
    render(<StudentEnrollmentGate
      course={{ title: 'Calculus', enrollment_open: false }}
      enrolling={false} handleEnroll={handleEnroll}
    />);
    const button = screen.getByRole('button', { name: 'التسجيل مغلق' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(handleEnroll).not.toHaveBeenCalled();
  });

  it('allows student enrollment when open', () => {
    const handleEnroll = vi.fn(async () => undefined);
    render(<StudentEnrollmentGate
      course={{ title: 'Calculus', enrollment_open: true }}
      enrolling={false} handleEnroll={handleEnroll}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'سجّل الآن' }));
    expect(handleEnroll).toHaveBeenCalledOnce();
  });
});
