import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ChatMessageContent,
  normalizeMathDelimiters,
} from '../ChatMessageContent';

describe('Academic chat message renderer', () => {
  it('renders Markdown emphasis and lists', () => {
    const html = renderToStaticMarkup(
      <ChatMessageContent
        content={'**Fuzzy set**\n\n- Membership\n- Classical'}
      />
    );

    expect(html).toContain(
      '<strong>Fuzzy set</strong>'
    );
    expect(html).toContain('<li>Membership</li>');
    expect(html).toContain('<li>Classical</li>');
  });

  it('renders inline and block LaTeX', () => {
    const content = String.raw`
Membership is \( \mu_A(x) \).

\[
M:X\longrightarrow[0,1]
\]
`;

    const html = renderToStaticMarkup(
      <ChatMessageContent content={content} />
    );

    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });

  it('supports Arabic and automatic text direction', () => {
    const html = renderToStaticMarkup(
      <ChatMessageContent
        content="المجموعة الضبابية **Fuzzy Set**"
      />
    );

    expect(html).toContain('dir="auto"');
    expect(html).toContain('المجموعة الضبابية');
    expect(html).toContain(
      '<strong>Fuzzy Set</strong>'
    );
  });

  it('preserves math delimiters inside code', () => {
    const inline = 'Use `\\(x\\)` as code.';
    const fenced = '```tex\n\\[x\\]\n```';

    expect(normalizeMathDelimiters(inline))
      .toBe(inline);

    expect(normalizeMathDelimiters(fenced))
      .toBe(fenced);
  });

  it('does not render raw script tags as HTML', () => {
    const html = renderToStaticMarkup(
      <ChatMessageContent
        content={'<script>alert(1)</script>\n\n**Safe**'}
      />
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('<strong>Safe</strong>');
  });
});
