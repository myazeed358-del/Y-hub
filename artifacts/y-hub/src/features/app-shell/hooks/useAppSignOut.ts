import { useCallback } from 'react';

import {
  signOutAndRedirect,
  type SignOutAction,
  type LoginNavigator,
} from '../application/signOutAndRedirect';

export function useAppSignOut(
  signOut: SignOutAction,
  navigate?: LoginNavigator
) {
  return useCallback(
    () => signOutAndRedirect(signOut, navigate),
    [signOut, navigate]
  );
}
