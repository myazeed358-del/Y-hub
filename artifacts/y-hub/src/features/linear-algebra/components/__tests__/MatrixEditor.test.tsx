import * as React from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { MatrixEditor } from '../MatrixEditor';

function TestHarness({
  maxDimension = 10,
}: {
  maxDimension?: number;
}) {
  const [matrix, setMatrix] = useState<string[][]>([
    ['1', '2'],
    ['3', '4'],
  ]);

  return (
    <MatrixEditor
      value={matrix}
      onChange={setMatrix}
      maxDimension={maxDimension}
    />
  );
}

describe('Linear Algebra - MatrixEditor', () => {
  it('renders the matrix and its dimensions', () => {
    render(<TestHarness />);

    expect(screen.getByText('2 × 2')).toBeDefined();
    expect(screen.getAllByRole('textbox')).toHaveLength(4);

    const first = screen.getByRole('textbox', {
      name: 'صف 1, عمود 1',
    }) as HTMLInputElement;

    expect(first.value).toBe('1');
  });

  it('updates a cell through controlled state', () => {
    render(<TestHarness />);

    const cell = screen.getByRole('textbox', {
      name: 'صف 1, عمود 2',
    });

    fireEvent.change(cell, {
      target: { value: '7/3' },
    });

    expect((cell as HTMLInputElement).value).toBe('7/3');
  });

  it('adds rows and columns with zero values', () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('button', {
      name: 'إضافة صف',
    }));

    expect(screen.getByText('3 × 2')).toBeDefined();

    fireEvent.click(screen.getByRole('button', {
      name: 'إضافة عمود',
    }));

    expect(screen.getByText('3 × 3')).toBeDefined();

    const newCell = screen.getByRole('textbox', {
      name: 'صف 3, عمود 3',
    }) as HTMLInputElement;

    expect(newCell.value).toBe('0');
  });

  it('removes rows and columns safely', () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('button', {
      name: 'حذف صف',
    }));

    fireEvent.click(screen.getByRole('button', {
      name: 'حذف عمود',
    }));

    expect(screen.getByText('1 × 1')).toBeDefined();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    expect(
      (screen.getByRole('button', {
        name: 'حذف صف',
      }) as HTMLButtonElement).disabled
    ).toBe(true);

    expect(
      (screen.getByRole('button', {
        name: 'حذف عمود',
      }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('enforces the maximum dimensions', () => {
    render(<TestHarness maxDimension={2} />);

    expect(
      (screen.getByRole('button', {
        name: 'إضافة صف',
      }) as HTMLButtonElement).disabled
    ).toBe(true);

    expect(
      (screen.getByRole('button', {
        name: 'إضافة عمود',
      }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('disables all controls when requested', () => {
    render(
      <MatrixEditor
        value={[['1', '2']]}
        onChange={vi.fn()}
        disabled
      />
    );

    for (const input of screen.getAllByRole('textbox')) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }

    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('supports English labels', () => {
    render(
      <MatrixEditor
        value={[['5']]}
        onChange={vi.fn()}
        language="en"
      />
    );

    expect(screen.getByText('Matrix')).toBeDefined();

    expect(screen.getByRole('textbox', {
      name: 'Row 1, Column 1',
    })).toBeDefined();

    expect(screen.getByRole('button', {
      name: 'Add row',
    })).toBeDefined();
  });

  it('does not mutate its input matrix', () => {
    const original = [
      ['1', '2'],
      ['3', '4'],
    ];

    const onChange = vi.fn();

    render(
      <MatrixEditor
        value={original}
        onChange={onChange}
      />
    );

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'صف 1, عمود 1',
      }),
      { target: { value: '99' } }
    );

    expect(original[0][0]).toBe('1');

    expect(onChange).toHaveBeenCalledWith([
      ['99', '2'],
      ['3', '4'],
    ]);
  });
});
