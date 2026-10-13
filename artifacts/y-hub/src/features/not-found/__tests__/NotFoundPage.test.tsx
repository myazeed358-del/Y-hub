import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('wouter', () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{
    href: string;
    'data-testid'?: string;
  }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import NotFoundPage from '../pages/NotFoundPage';

describe('NotFoundPage', () => {
  it('displays the 404 indicator', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);
    expect(html).toContain('404');
  });

  it('preserves the Arabic error message', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);
    expect(html).toContain('هذه الصفحة خارج المسار');
  });

  it('preserves navigation back home', () => {
    const html = renderToStaticMarkup(<NotFoundPage />);

    expect(html).toContain('href="/"');
    expect(html).toContain(
      'data-testid="link-not-found-home"'
    );
    expect(html).toContain('العودة إلى المكتب');
  });
});
