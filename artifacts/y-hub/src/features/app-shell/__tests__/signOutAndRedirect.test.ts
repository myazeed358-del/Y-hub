import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  signOutAndRedirect,
} from '../application/signOutAndRedirect';

describe('signOutAndRedirect', () => {
  it('redirects to login after sign-out', async () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();

    await signOutAndRedirect(signOut, navigate);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('waits for sign-out before redirecting', async () => {
    let completeSignOut!: () => void;

    const signOut = vi.fn(
      () => new Promise<void>((resolve) => {
        completeSignOut = resolve;
      })
    );

    const navigate = vi.fn();

    const operation = signOutAndRedirect(
      signOut,
      navigate
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();

    completeSignOut();
    await operation;

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('does not redirect after async failure', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('Sign-out failed');
    });

    const navigate = vi.fn();

    await expect(
      signOutAndRedirect(signOut, navigate)
    ).rejects.toThrow('Sign-out failed');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect after synchronous failure', async () => {
    const signOut = vi.fn(() => {
      throw new Error('Immediate failure');
    });

    const navigate = vi.fn();

    await expect(
      signOutAndRedirect(signOut, navigate)
    ).rejects.toThrow('Immediate failure');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('supports synchronous sign-out actions', async () => {
    const signOut = vi.fn(() => undefined);
    const navigate = vi.fn();

    await signOutAndRedirect(signOut, navigate);

    expect(signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
