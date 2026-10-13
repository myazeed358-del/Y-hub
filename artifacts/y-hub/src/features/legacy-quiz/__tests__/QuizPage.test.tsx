import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuizPage from '../pages/QuizPage';

describe('QuizPage', () => {
  it('renders the original quiz heading', () => {
    const html = renderToStaticMarkup(<QuizPage />);

    expect(html).toContain('اختبر بوصلتك');
    expect(html).toContain('مساحة التمرين');
  });

  it('renders all six questions and answer buttons', () => {
    const html = renderToStaticMarkup(<QuizPage />);

    const buttons =
      html.match(/data-testid="button-answer-/g) ?? [];

    expect(buttons).toHaveLength(24);
    expect(html).toContain(
      'data-testid="button-answer-0-0"'
    );
    expect(html).toContain(
      'data-testid="button-answer-5-3"'
    );
  });

  it('does not display the final result initially', () => {
    const html = renderToStaticMarkup(<QuizPage />);

    expect(html).not.toContain('اكتملت الجولة');
    expect(html).not.toContain(
      'data-testid="button-reset-quiz"'
    );
  });
});
