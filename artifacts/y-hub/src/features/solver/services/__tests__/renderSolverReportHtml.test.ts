import { describe, it, expect } from 'vitest';
import { renderSolverReportHtml, escapeHtml } from '../renderSolverReportHtml';

describe('solver report rendering and transport isolation', () => {
  it('escapes all untrusted data without losing printable content', () => {
    const html = renderSolverReportHtml({
      title: '</title><script>alert(1)</script>',
      userName: 'Sam <b>Test</b>',
      operation: 'min & max',
      inputs: { '<img src=x>': '"hello"' },
      result: '<svg onload=alert(1)>',
      proof: '</script><script>evil()</script>',
    }, new Date('2026-01-01T12:00:00Z'));
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(html).not.toContain('<script>evil()');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&quot;hello&quot;');
    expect(html).toContain('min &amp; max');
  });
  it('handles quotes and ampersands without double interpretation', () => {
    expect(escapeHtml(`A & B < C > D "hi" 'bye'`)).toBe('A &amp; B &lt; C &gt; D &quot;hi&quot; &#39;bye&#39;');
  });
});
