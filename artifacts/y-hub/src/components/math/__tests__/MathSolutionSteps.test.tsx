import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathSolutionSteps } from '../MathSolutionSteps';
import type { MathStep } from '@/services/math/types/step';

describe('MathSolutionSteps', () => {
  it('renders derivative notation as valid LaTeX', () => {
    const steps: MathStep[] = [{
      id: 'simple_derivative',
      title: 'Derivative',
      explanation: 'Differentiate x.',
      derivation: {
        kind: 'derivative',
        variable: 'x',
        input: { type: 'Symbol', name: 'x' },
        output: { type: 'Number', value: '1' },
        verification: 'not_proven'
      }
    }];

    const html = renderToStaticMarkup(
      <MathSolutionSteps steps={steps} language="en" />
    );

    expect(html).toContain('katex');
    expect(html).not.toContain('katex-error');

    const normalizedHtml = html.replace(/\s+/g, '');

    expect(normalizedHtml).toContain(
      String.raw`\frac{d}{dx}\left(x\right)=1`
    );
  });
});
