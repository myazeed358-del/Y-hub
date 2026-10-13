export type SignOutAction =
  () => Promise<unknown> | void;

export type LoginNavigator =
  (path: string) => void;

function redirectToLogin(path: string): void {
  window.location.href = path;
}

/**
 * Keep the original sign-out order:
 * 1. Complete sign-out.
 * 2. Navigate to the login page.
 *
 * If sign-out throws or rejects, navigation is
 * not performed, matching the previous behavior.
 */
export async function signOutAndRedirect(
  signOut: SignOutAction,
  navigate: LoginNavigator = redirectToLogin
): Promise<void> {
  await signOut();
  navigate('/login');
}
