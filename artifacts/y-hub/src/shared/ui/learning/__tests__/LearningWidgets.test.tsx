import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  SectionKicker,
  ProgressRing,
  MiniCurve,
} from '../index';

import {
  SectionKicker as LegacySectionKicker,
  ProgressRing as LegacyProgressRing,
  MiniCurve as LegacyMiniCurve,
} from '@/components/legacy/LegacyLearningWidgets';

describe('Shared learning UI', () => {
  it('renders SectionKicker content', () => {
    const html = renderToStaticMarkup(
      <SectionKicker>المسار التعليمي</SectionKicker>
    );

    expect(html).toContain('المسار التعليمي');
  });

  it('renders ProgressRing percentage', () => {
    const html = renderToStaticMarkup(
      <ProgressRing value={37} />
    );

    expect(html).toContain('37٪');
    expect(html).toContain('<svg');
  });

  it('keeps progress SVG properties', () => {
    const html = renderToStaticMarkup(
      <ProgressRing value={100} />
    );

    expect(html).toContain('viewBox="0 0 58 58"');
    expect(html).toContain('stroke-dasharray=');
    expect(html).toContain('stroke-dashoffset=');
  });

  it('renders the triangular curve', () => {
    const html = renderToStaticMarkup(
      <MiniCurve type="triangle" />
    );

    expect(html).toContain(
      'M 8 100 L 48 100 L 108 22'
    );
  });

  it('renders the trapezoidal curve', () => {
    const html = renderToStaticMarkup(
      <MiniCurve type="trapezoid" />
    );

    expect(html).toContain(
      'M 8 100 L 34 100 L 74 25'
    );
  });

  it('renders the gaussian curve', () => {
    const html = renderToStaticMarkup(
      <MiniCurve type="gaussian" />
    );

    expect(html).toContain(
      'M 8 100 C 45 99'
    );
  });

  it('preserves the coral tone', () => {
    const html = renderToStaticMarkup(
      <MiniCurve type="gaussian" tone="coral" />
    );

    expect(html).toContain('hsl(var(--chart-4))');
  });

  it('preserves original imports', () => {
    expect(LegacySectionKicker).toBe(SectionKicker);
    expect(LegacyProgressRing).toBe(ProgressRing);
    expect(LegacyMiniCurve).toBe(MiniCurve);
  });
});
