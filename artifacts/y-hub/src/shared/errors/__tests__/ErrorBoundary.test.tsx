import * as React from 'react';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { renderToStaticMarkup } from 'react-dom/server';

import {
  ErrorBoundary,
} from '../index';

import {
  DefaultFallback,
} from '../DefaultErrorFallback';

import {
  ErrorBoundary as LegacyErrorBoundary,
} from '@/components/error-boundary';

describe('ErrorBoundary', () => {
  it('preserves the legacy public export', () => {
    expect(LegacyErrorBoundary).toBe(ErrorBoundary);
  });

  it('renders children in the healthy state', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <div>Healthy application</div>
      </ErrorBoundary>
    );

    expect(html).toContain('Healthy application');
  });

  it('normalizes thrown values into Error state', () => {
    const state = ErrorBoundary.getDerivedStateFromError(
      'Example failure'
    );

    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('Example failure');
  });

  it('renders the original fallback UI', () => {
    const html = renderToStaticMarkup(
      <DefaultFallback
        error={new Error('Example failure')}
        resetError={() => undefined}
      />
    );

    expect(html).toContain('Something went wrong');
    expect(html).toContain('Try again');
    expect(html).toContain('type="button"');
  });

  it('supports a custom fallback component', () => {
    const boundary = new ErrorBoundary({
      children: <div>Healthy</div>,
      FallbackComponent: ({ error }) => (
        <p>{error.message}</p>
      ),
    });

    boundary.state = {
      error: new Error('Custom fallback works'),
    };

    const html = renderToStaticMarkup(
      <>{boundary.render()}</>
    );

    expect(html).toContain('Custom fallback works');
  });

  it('requests recovery when the route key changes', () => {
    const boundary = new ErrorBoundary({
      children: <div>Application</div>,
      resetKey: '/new',
    });

    boundary.state = {
      error: new Error('Route failed'),
    };

    const reset = vi.spyOn(boundary, 'resetError')
      .mockImplementation(() => undefined);

    boundary.componentDidUpdate({
      children: <div>Application</div>,
      resetKey: '/old',
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does not reset for an unchanged route key', () => {
    const boundary = new ErrorBoundary({
      children: <div>Application</div>,
      resetKey: '/same',
    });

    boundary.state = {
      error: new Error('Route failed'),
    };

    const reset = vi.spyOn(boundary, 'resetError')
      .mockImplementation(() => undefined);

    boundary.componentDidUpdate({
      children: <div>Application</div>,
      resetKey: '/same',
    });

    expect(reset).not.toHaveBeenCalled();
  });

  it('does not reset when there is no error', () => {
    const boundary = new ErrorBoundary({
      children: <div>Application</div>,
      resetKey: '/new',
    });

    const reset = vi.spyOn(boundary, 'resetError')
      .mockImplementation(() => undefined);

    boundary.componentDidUpdate({
      children: <div>Application</div>,
      resetKey: '/old',
    });

    expect(reset).not.toHaveBeenCalled();
  });
});
