import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';

import {
  useAppSignOut,
} from '../hooks/useAppSignOut';

afterEach(() => {
  cleanup();
});

describe('useAppSignOut', () => {
  it('does not sign out during initial rendering', () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();

    renderHook(() =>
      useAppSignOut(signOut, navigate)
    );

    expect(signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('performs sign-out when invoked', async () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useAppSignOut(signOut, navigate)
    );

    await act(async () => {
      await result.current();
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('keeps a stable callback with unchanged inputs', () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();

    const { result, rerender } = renderHook(() =>
      useAppSignOut(signOut, navigate)
    );

    const originalCallback = result.current;

    rerender();

    expect(result.current).toBe(originalCallback);
  });

  it('uses the latest sign-out action', async () => {
    const firstAction = vi.fn(async () => undefined);
    const secondAction = vi.fn(async () => undefined);
    const navigate = vi.fn();

    const { result, rerender } = renderHook(
      ({ signOut }) => useAppSignOut(
        signOut,
        navigate
      ),
      {
        initialProps: {
          signOut: firstAction,
        },
      }
    );

    rerender({
      signOut: secondAction,
    });

    await act(async () => {
      await result.current();
    });

    expect(firstAction).not.toHaveBeenCalled();
    expect(secondAction).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('propagates failures without redirecting', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('Authentication failure');
    });

    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useAppSignOut(signOut, navigate)
    );

    await act(async () => {
      await expect(
        result.current()
      ).rejects.toThrow('Authentication failure');
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('preserves repeated invocation behavior', async () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();

    const { result } = renderHook(() =>
      useAppSignOut(signOut, navigate)
    );

    await act(async () => {
      await result.current();
      await result.current();
    });

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
